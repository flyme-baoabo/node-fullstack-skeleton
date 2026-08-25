import 'dotenv/config';
import http from 'node:http';
import express from 'express';
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

    // 生产：Express 直连服务构建产物（dist-client）。
    // 开发（双端口架构）：前端资源由 Vite:5173 出（transform + HMR），其余请求经 proxy 转发回本服务，故不挂 static。
    if (isProd) {
        app.use(express.static(clientDistDir));
    }

    const server = http.createServer(app);
    mountRoutes(app);

    // 带自动重试的 listen，遇端口占用稍等后自愈，消灭随机 EADDRINUSE（见 utils/listenWithRetry.ts）
    listenWithRetry(server, port, () => {
        console.log(`Node Server backend → http://localhost:${port} (${isProd ? 'production' : 'dev'})`);
    });

    // 把退场逻辑注册到 SIGTERM / SIGINT，收到信号时尽快释放 server（Vite 已独立，由 concurrently 统一管理）
    registerShutdown({ server });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});