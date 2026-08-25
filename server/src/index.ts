import dotenv from 'dotenv';
import http from 'node:http';
import express from 'express';
import type { ViteDevServer } from 'vite';
import { createApp } from './app.js';
import { mountRoutes } from './routes.js';
import { clientDistDir } from './paths.js';
import { registerShutdown } from './runtime/shutdownRuntime.js';
import { installProcessErrorGuard } from './runtime/processErrors.js';
import { listenWithRetry } from './utils/listenWithRetry.js';

// NODE_ENV 由【进程环境】决定（docker/cli 注入），不从 .env 读
const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
    dotenv.config({ path: '.env', override: false });
    // 开发环境：读取 .env，加载到 process.env，不覆盖 已有的环境变量（例如 docker-compose.yml 注入的），避免覆盖掉 compose 注入的端口等配置
    dotenv.config({ path: '.env.development', override: false });
}
// 生成 环境 CI注入 和 docker-compose.yml 注入，而且生成环境 也没有 .env 文件

// 生产环境固定监听 3000（与 Dockerfile 公开端口 / compose 内部端口强绑定）
// 开发环境才读取 SERVER_PORT，便于本地灵活换端口
const port = isProd ? 3000 : Number(process.env.SERVER_PORT) || 3000;

// 进程级兜底：接管 unhandledRejection / uncaughtException，须在任何异步逻辑之前注册
installProcessErrorGuard();

async function main(): Promise<void> {
    const app = await createApp();
    const server = http.createServer(app);
    let devViteServer: ViteDevServer | undefined;

    if (!isProd) {
        // 开发模式：把 Vite 作为 Express 中间件挂载，复用 HMR 管线
        // 注意：vite 是 devDependency，生产镜像 --omit=dev 不会装它，必须在开发分支内动态导入
        const { createServer: createViteServer } = await import('vite');
        devViteServer = await createViteServer({
            server: { middlewareMode: true, hmr: { server } as never },
            appType: 'custom',
        });
        app.locals.isDev = true;
        app.use(devViteServer.middlewares);
    } else {
        // 生产模式：直接服务构建产物
        app.locals.isDev = false;
        app.use(express.static(clientDistDir));
    }

    mountRoutes(app);

    // 带自动重试的 listen，遇端口占用稍等后自愈，消灭随机 EADDRINUSE（见 utils/listenWithRetry.ts）
    listenWithRetry(server, port, () => {
        console.log(`htmx-study → http://localhost:${port} (${isProd ? 'production' : 'dev'})`);
    });

    // 把旧进程退场逻辑注册到 SIGTERM / SIGINT，收到信号时尽快释放 server 和开发环境下的 vite 资源
    registerShutdown({
        server,
        devViteServer,
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});