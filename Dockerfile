# 单镜像构建整个项目（SPA 模式，单端口部署）：
#   - build:server —— tsc 编译 TS → dist-server，build-server.js 把 .ejs/.json 等静态资源拷进 dist-server
#   - build:client —— vite build 产出 dist-client 作为唯一浏览器入口
#
# SPA 单端口运行时形态（唯一进程 node dist-server/index.js 承担全部）：
#   · express.static(dist-client)  托管 index.html / js / assets 静态资源
#   · /api/*、/page/*              后端路由（业务接口 + 页面路由/片段渲染）
#   浏览器首页 index.html → main.ts → htmx/spaRouter 拉取 /page/<path> 片段与 /api/* 数据。
#
# 说明：
#   - i18n 字典（.json）经 const import 静态编译进 dist-server，运行阶段无需再拷；
#   - EJS 视图由 build-server.js 自动从 server/src 复制进 dist-server/views，也无需单独 COPY。
FROM node:20-alpine AS builder
WORKDIR /app
# 先装依赖，利用包缓存
COPY package*.json ./
RUN npm ci
# 拷贝根级配置。vite.*.ts 均在 client/ 下，由下方 COPY client ./client 带入 /app/client/，根目录不存在、勿在此再拷。
COPY tsconfig.base.json tsconfig.json tsconfig.server.json ./
COPY server ./server
COPY client ./client
COPY scripts ./scripts
# 同时编译后端 + 构建前端（产出 dist-server 与 dist-client）。
# mode 由 Docker build 时经 ARG MODE 注入（命中 build 时间）：
#   docker build --build-arg MODE=development …
# 默认 production（vite build 默认即 production，无 sourcemap）。
ARG MODE=production
RUN npm run build:server && npx vite build --mode $MODE

# ——— 运行阶段：全新的空白镜像，只保留「能跑起来的东西」———
#   · 首个 FROM 阶段（builder）里的源码、devDependencies、node_modules 全部带不到这里，
#     新阶段从干净的 node:20-alpine 重新开始，仅通过 COPY --from=builder 取回两个产物。
#   · node_modules 不是拷贝来的，而是重新 npm ci --omit=dev 安装得到的：
#     单独装运行依赖，跳过 tsc/vite/tsx 等 devDependencies，让最终镜像更小。
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# 只拷贝运行清单并安装运行时依赖（不含 dev），供后端 import express/ejs/i18next 等使用
COPY package*.json ./
RUN npm ci --omit=dev
# 后端编译产物（含被 build-server.js 拷入的 views 静态资源）
COPY --from=builder /app/dist-server ./dist-server
# 前端构建产物（index.html/js/css），供后端 express.static(dist-client) 静态托管
COPY --from=builder /app/dist-client ./dist-client
# 待办持久化数据目录（server.dataDir 默认指向项目根下 data）
# 必须 chown 给 node（uid 1000）：下面会切 USER node 以非 root 运行，若不授权，
# node 用户对 root 属主的 data 目录没有写权限，落盘 todos.json 会抛 EACCES。
RUN mkdir -p data && chown -R node:node data


# 安全规范：不使用root运行Node进程，使用官方普通node用户，规避容器权限风险
USER node
EXPOSE 3000
CMD ["node", "dist-server/index.js"]
