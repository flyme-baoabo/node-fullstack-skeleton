import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { createApp } from './app.js';
import { mountRoutes } from './routes.js';
import { clientDistDir } from './paths.js';
import { registerShutdown } from './runtime/shutdownRuntime.js';
import { installProcessErrorGuard } from './runtime/processErrors.js';
import { listenWithRetry } from './utils/listenWithRetry.js';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.SERVER_PORT) || 3000;

// 进程级兜底：接管 unhandledRejection / uncaughtException，须在任何异步逻辑之前注册
installProcessErrorGuard();

async function main(): Promise<void> {
    const app = await createApp();
    const server = http.createServer(app);
    let devViteServer: ViteDevServer | undefined;

    if (!isProd) {
        // 开发模式：把 Vite 作为 Express 中间件挂载，复用 HMR 管线
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