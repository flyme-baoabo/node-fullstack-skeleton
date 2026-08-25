# 单镜像构建整个项目：
#   - build:server  —— tsc 编译 TS → dist-server，build-server.js 把 .ejs/.json 等静态资源拷进 dist-server
#   - build         —— vite build 产出 dist-client（EJS 布局直接引用其中的 js/main.js、assets/style.css）
#
# 说明：
#   - i18n 字典（.json）经 const import 静态编译进 dist-server，运行阶段无需再拷；
#   - EJS 视图由 build-server.js 自动从 server/src 复制进 dist-server/views，也无需单独 COPY。
FROM node:20-alpine AS builder
WORKDIR /app
# 先装依赖，利用包缓存
COPY package*.json ./
RUN npm ci
# 拷贝构建所需源码与配置
COPY tsconfig.base.json tsconfig.json tsconfig.server.json vite.config.ts vite.constants.ts vite.utils.ts ./
COPY server ./server
COPY client ./client
COPY scripts ./scripts
# 同时编译后端 + 构建前端（产出 dist-server 与 dist-client）
RUN npm run build:all

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
# 前端构建产物，供后端静态托管 + EJS 布局引用
COPY --from=builder /app/dist-client ./dist-client
# 待办持久化数据目录（server.dataDir 默认指向项目根下 data）
RUN mkdir -p data


# 安全规范：不使用root运行Node进程，使用官方普通node用户，规避容器权限风险
USER node
EXPOSE 3000
CMD ["node", "dist-server/index.js"]
