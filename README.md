# node-fullstack-skeleton

前后端不分离小型项目：**Node + Express** 服务端渲染，**htmx** 提供前端交互能力，**Vite + Tailwind CSS** 负责前端构建与 HMR。

> 💡 开发/提交/版本同步规范请看 [**docs/development-standards.md**](docs/development-standards.md)（GitHub 为主仓库、Gitee 为镜像的同步约定）。
>
> 💡 Docker 镜像构建 / 本地启停 / 日常运维命令请看 [**docs/docker.md**](docs/docker.md)。

本工程是 **Express + Vite** 的实践项目，完整串起「后端 Express 渲染视图 + 前端 Vite 构建/HMR」的典型开发链路。

## 技术栈选型

| 层 | 选型 | 说明 |
|---|---|---|
| 后端框架 | Express 5 | 服务端渲染 API，返回完整页面或局部片段 |
| 模板引擎 | EJS + express-ejs-layouts | 布局 / partial 拆分 |
| 前端交互 | htmx 2 | 通过 `hx-*` 属性做局部交换 |
| 样式 | Tailwind CSS | utility-first，按需生成，和模板类名兼容 |
| 构建 / HMR | Vite 8 | 双端口 dev server；Vite 提供 SPA shell、模块 transform 与 HMR |
| 国际化 | i18next + i18next-http-middleware | URL 参数 / Cookie / Accept-Language 三层语言探测 |

## 目录结构

```
project-root/                       # 当前仓库根目录（占位名，取决于 clone 目录名）
├─ server/                          # Node 后端业务
│  └─ src/
│     ├─ adapter/                   # 基础设施适配层（把外部能力接入业务）
│     ├─ controller/                # HTTP 控制器
│     ├─ service/                   # 业务服务层
│     ├─ repository/                # 纯业务数据 CRUD 封装（本地 JSON 文件读写）
│     │  └─ todo.repository.ts      #   待办数据读 / 写 / 查，暂用 data/todos.json，无 Prisma 底层基建
│     ├─ db/                        # 后端数据库底层基建目录
│     │  ├─ prisma/                 # Prisma 专属目录
│     │  │  ├─ schema.prisma        #   数据表模型、关联关系、数据库数据源配置
│     │  │  └─ migrations/          #   数据库版本迁移脚本集合
│     │  ├─ index.ts                # 数据库主实例初始化、连接池统一管理
│     │  ├─ redis.ts                # Redis 底层连接与配置
│     │  └─ db.config.ts            # 数据库全局参数配置
│     ├─ dto/                       # 数据传输对象
│     ├─ routes/                    # 业务路由
│     ├─ utils/                     # 通用工具
│     ├─ views/                     # 服务端视图模板层
│     │  ├─ layouts/                #   global 布局骨架
│     │  ├─ pages/                  #   业务页面模板
│     │  └─ partials/               #   公共片段组件
│     └─ …其余既有文件（app.ts / index.ts / i18n / middleware / runtime / locales…）
├─ client/                          # 前端源码：html / Sass / TS / 组件
│  ├─ src/
│  └─ public/
├─ dist-client/                     # Vite 构建产物，供 server 读取
├─ dist-server/                     # TSC 编译产物，服务端生产运行目录
├─ Dockerfile                       # 后端服务镜像构建文件（仅用于后端部署）
├─ vite.config.ts                   # 全局 Vite 构建配置（前后端不分离共用）
├─ tsconfig.json                    # 全局 TS 基础配置（前后端共用）
├─ tsconfig.server.json             # 服务端 TS 独立编译配置
├─ scripts/
│  └─ build-server.mjs              # 服务端编译后置处理脚本（拷贝 .ejs/.json 等静态资源）
├─ .env                             # 本地环境变量（已 gitignore，不入库）
├─ .env.example                     # 环境变量模板
├─ docker-compose.yml               # 全局容器编排（仅中间件）
└─ package.json
```

> 💡 **数据库目录说明**：`server/src/db/`（含 `prisma/`、`index.ts`、`redis.ts`、`db.config.ts`）目前是**预留的基础模板骨架**，尚未接入真实数据库。当前待办数据仍走 JSON 文件存储（`repository/todo.repository.ts` 读写 `data/todos.json`）；上述骨架不导入任何业务代码、不进入启动链路，`typecheck` 零副作用，待接入 PostgreSQL / Redis 时按配置内注释填充即可。

## 启动方式（双端口，env 驱动）

开发模式采用**双端口双进程**架构，端口由 `.env` 中的环境变量驱动（`BACKEND_PORT` / `VITE_PORT`，缺省 `3006` / `5173`）：

- **后端 Express**：端口 `BACKEND_PORT`，渲染 EJS、提供 `/api/*` 与 htmx 局部片段，并托管构建产物静态资源
- **前端 Vite**：端口 `VITE_PORT`，浏览器唯一入口；开发时只把 `/api/*`、`/page/*` 代理到 Express，其余模块请求、静态资源与 `index.html` 均由 Vite 自身处理

`server/src/index.ts` 不再以 middleware 方式加载 Vite，Node(Express) 只做后端、不负责启动前端开发进程。

### 纯 SPA 边界（命名空间约定）

开发态采用纯 SPA 分工：

- **Express 后端保留**：`/api/*`、`/page/*`
- **Vite 前端负责**：`/`、`/src/*`、`/@vite/*`、`/node_modules/*`、`/public/*` 暴露出的静态资源，以及其它所有前端模块/资源请求

这条边界的重点不是“前端不能请求后端接口”，而是：

- 前端静态资源目录、public 文件、源码访问路径**不要使用** `/api` 或 `/page` 作为前缀
- 新增前端资源时，避免出现 `/api/logo.svg`、`/page/app.css` 这类路径
- 因为开发态 Vite 已把这两个前缀保留给后端代理，若前端占用它们，请求会被转发到 Express 而不是由 Vite 提供

一句话：`/api`、`/page` 是**后端保留命名空间**，不是前端静态资源命名空间。

### Vite 代理分流：前缀代理

双端口下浏览器只访问 `VITE_PORT`。当前分流策略很直接：只代理后端保留前缀，其余请求全部留在 Vite。

实际配置（`client/vite.config.ts`）：

```ts
server: {
    port: vitePort,
    proxy: {
        '/api': { target: `http://localhost:${backendPort}`, changeOrigin: true },
        '/page': { target: `http://localhost:${backendPort}`, changeOrigin: true },
    },
},
appType: 'spa',
```

> ⚠️ **易踩坑**：由于 `/api`、`/page` 已被保留给后端代理，前端不要把静态资源、public 文件或源码访问路径设计成这两个前缀，否则开发态会被错误代理到 Express。

```bash
npm install        # 首次安装依赖（含 dotenv）
npm run dev        # 同时启动后端(Express:BACKEND_PORT)，Vite 端口就绪后再拉起
npm run dev:server # 仅启动后端
npm run dev:client # 仅启动前端（Node 脚本：读 .env → 等 BACKEND_PORT → 拉 vite）
npm run build      # 仅构建前端产物到 dist-client/
npm start          # 生产模式：服务 dist-client 静态资源
npm test           # 运行测试
```

> `npm run dev` 由 `concurrently -k` 并发拉起两个进程；其中 `dev:client` 用 `scripts/dev-client.mjs`（而非 shell 变量，兼顾 Windows）加载 `.env` 并轮询等待后端端口就绪，因此**严格先起 server 再起 client**。开发时浏览器访问 **http://localhost:${VITE_PORT}**；Express 由 `node --watch-path=server` 在文件变更时自行重启，Vite 由自己的 dev server 做前端热更。

### 开发态进程生命周期（退场 / 入场）

开发模式是**两个独立进程**：Express 只做后端，Vite dev server 由 `concurrently` 拉起。这里描述的退场/入场只针对 Express 进程。

服务端文件变更时，Express 由 `node --watch-path=server` 重启，旧进程退场、新进程入场之间存在一个短暂交接窗口：

1. **退场**：旧进程收到 `SIGTERM`（watch 重启）或 `SIGINT`（用户 `Ctrl+C`）后，尽快关闭 HTTP server 与现有 socket。
2. **入场**：新进程启动时，若旧进程还没完全释放端口，新的 `server.listen(port)` 可能先遇到 `EADDRINUSE`，此时需要短暂重试。

本项目把这两个阶段拆成两个独立 util：

| 阶段 | 文件 | 作用 |
|---|---|---|
| 退场 | `server/src/utils/gracefulShutdown.ts` | 关闭旧进程的 HTTP 监听与 socket，尽量缩短旧进程占端口时间 |
| 入场 | `server/src/utils/listenWithRetry.ts` | 新进程监听端口时若遇到 `EADDRINUSE`，稍等后重试，避免因为旧进程晚几百毫秒释放端口而直接崩掉 |

`server/src/runtime/shutdownRuntime.ts` 只负责把 Express 的退场逻辑注册到进程信号；Vite 已独立成前端进程，不再由 Express 管理它的资源。

可以把它理解为：

- `createGracefulShutdown` 负责让旧进程**尽快放手**
- `node --watch-path=server ...` 负责把新进程**重新拉起来**
- `listenWithRetry` 负责让新进程在旧进程还没完全放手时**先别崩**

注意：`listenWithRetry` 重试的是当前新进程里的 `server.listen(port)`，不是进程重启本身。真正结束旧进程并拉起新进程的，是 `node --watch-path=server ...` 这条启动链路。

其中 `SIGINT` 只代表“用户手动结束当前进程”，通常不会自动拉起新进程，所以一般不会进入 `listenWithRetry` 的重试链路；`SIGTERM` 则更常见于 watch 重启，后续才会有新进程入场。

## 国际化（i18n）方案

语言切换与翻译由 **i18next + i18next-http-middleware** 在服务端完成，模板里通过 `<%= t('key') %>` 取翻译，语言包放在 `server/locales/` 下的 JSON 文件。

### 语言探测优先级

`i18next-http-middleware` 的 LanguageDetector 按以下顺序探测当前语言（顺序可通过 `detection.order` 配置）：

1. **URL 查询参数** `?lang=`（如 `/?lang=en-US`）——最高优先级，来自语言切换链接
2. **Cookie**（`lang`）——探测到语言后自动写回 cookie，保证后续 htmx 局部刷新时语言一致
3. **请求头** `Accept-Language`——浏览器默认语言

以上都探测不到或语言包缺失时，回退到 `fallbackLng`（`zh-CN`）。

### 语言码归一化

浏览器发送的 `Accept-Language` 写法五花八门（小写、缺区域、乱序），通过 `supportedLngs` + `nonExplicitSupportedLngs` 把它们统一归一到应用支持的语言：

```js
supportedLngs: ['zh-CN', 'en-US'],  // 白名单：只允许这两种语言码，其余一律回退 fallbackLng
nonExplicitSupportedLngs: true,     // 允许“纯语言码”（如 zh / en）按前缀匹配到列表内的完整码
```

| 请求语言 | 匹配机制 | 结果 |
|---|---|---|
| `zh-CN` / `zh-cn` | 大小写不敏感精确匹配（默认行为） | `zh-CN` |
| `zh`（无区域） | `nonExplicitSupportedLngs` 前缀匹配 | `zh-CN` |
| `en` / `en-US` / `en-us` | 同上 | `en-US` |
| `zh-TW` / `ja-JP` 等 | 被 `supportedLngs` 白名单拦下 | 回退 `zh-CN` |

> ⚠️ 前缀匹配按数组顺序取「第一个以该码开头的完整码」。**如果将来同时加入 `zh-CN` 与 `zh-TW`，`supportedLngs` 里谁排在前，纯 `zh` 就归谁**，请把想作为默认中文的放前面。

### 语言切换如何工作

页头导航通过自定义语言下拉菜单（`src/language.ts`）切换语言，**全程无刷新、无页面跳转**：

1. 点击菜单项 → 拦截 `<a>` 默认跳转，SDK 层调用 `switchLanguage(lang)`；
2. **POST `/api/change-language`**：服务端把新的 `lang` 写入 cookie，并返回该语言的语言包 `{ i18nJson, isSuccess }`；前端同步更新 `window.I18n`；
3. **GET `/page/body`（htmx.ajax）**：利用 htmx 取回当前页面主体片段，以 `innerHTML` 整块换进 `#root`（不重载整页、不重新执行脚本，只替换页面内已翻译的文本）；
4. 同步 `<html lang>` 属性；
5. 重新绑定语言下拉菜单（`initLanguageSwitcher()`，因为 `#root` 已是新 DOM）。

### 页内结构约定

得益于 `app-layout.ejs` + `#root` 的页面结构，语言切换只需让服务端用对应语言包重渲染当前页面的带壳片段（`/page/body` 路由，`pageLayout:false` 不套最外层 `layout`），取下整块 `#root` 内容替换即可，无需刷新浏览器。

> 语言包以 `window.I18n` 注入供前端使用；页面正文由 htmx 局部替换，其余脚本（htmx、样式）不重复加载。

### 传统跳转式（备选）

若不需要无感换语言，可退化为 URL query 方式：

- 选择语言后跳转到 `/?lang=...`，语言随 URL 参数请求发送到服务端；
- 服务端据此确定语言，并写入 `lang` cookie，同时用对应语言包渲染整页（此方式会整页刷新）。

### 模板中的用法

在任意视图（含 partials）中直接使用：

```ejs
<%- t('nav.home') %>
<%= t('todos.count', { count: 12 }) %>   <!-- 支持插值 -->
```

`res.locals.t` 与 `res.locals.currentLocale` 在中间件中按 `req.t / req.i18n.language` 注入，`html lang` 等场景直接取 `currentLocale`。

## 渲染与片段中间件

页面组装由安装于 `server/src/middleware/` 的渲染中间件完成，业务路由只关心「要整页还是片段」：

- **整页**：`res.renderPage(meta.view, { ... })` —— 内容 + `app-layout` 外壳 + 全局 `layout`。
- **片段（无刷新重绘，如语言切换）**：`res.renderPage(..., { pageLayout: false })` —— 保留 `app-layout` 外壳但不套全局 `layout`。
- **局部元素片段**（待办增删改）：`res.render('partials/…', ...)` —— 由 `fragment` 中间件**自动注入 `layout:false`**，无需手写。

相关文件与中间件：

| 文件 | 导出 | 作用 |
|---|---|---|
| `middleware/fragment.middleware.ts` | `injectFragmentFlagMiddleware` / `fragmentRenderMiddleware` / `protectPartialsRoute` | htmx 标记注入、`res.render` 片段重写、`/partials·` 防直访 |
| `middleware/render.middleware.ts` | `renderPageMiddleware` | 挂载 `res.renderPage` 多层布局组装 |
| `middleware/i18n.middleware.ts` | `i18nRequest` / `localeBridge` | i18n 语言解析与 `res.locals` 桥接 |

> ⚠️ **挂载顺序不可颠倒**：`injectFragmentFlag → fragmentRender → protectPartials('/partials/*') → renderPage`。详细约定见 [**docs/development-standards.md**](docs/development-standards.md)。

## HMR 说明

- **前端**：`client/src/main.ts` / `client/src/main.css` 改动 → Vite HMR 热更新，不刷新。
- **后端视图**：`server/src/views/*.ejs` 在开发模式（view cache 关闭）下每次请求重新读盘，保存后刷新页面即可看到变化；路由等 `.js` 改动由 `node --watch` 自动重启。

## 请求链路与日志

从请求进来到错误出口，全链路靠 **`requestId` 串联**，日志按它分组排查。

### requestId 中间件（`middleware/requestId.middleware.ts`）

每个请求用 `crypto.randomUUID()` 生成唯一 `req.id`，并回写 `X-Request-Id` 响应头，供前端/日志按请求追溯。需在业务路由**之前**挂载（`app.ts` 放在 body 解析之后）。

### 结构化日志（`utils/logger.ts`）

零依赖（不引 pino/winston）的 JSON 结构化日志——每行一个 JSON 对象 `{ ts, level, msg, ...meta }`，便于 grep 或按字段过滤：

```ts
import { logger } from '../utils/logger.js';
logger.info('create todo', { requestId: req.id, title });
logger.error('[unhandledRejection]', { name, message, stack });
```

`error` / `warn` 走 `console.error/warn`，其余走 `console.log`。若后期要升级文件/级别/轮转，只需改本文件，不影响调用方。

### 进程级兜底（`runtime/processErrors.ts`）

`main()` 之前调用 `installProcessErrorGuard()`（`index.ts` 顶部）：

- `unhandledRejection`：异步 promise 被拒没人 catch，记日志但不立刻退出（可能是单个请求故障，仍可恢复）。
- `uncaughtException`：同步异常冒到顶层、进程状态可能已损坏，记日志后置 `process.exitCode = 1`，交给 `node --watch` / Docker 重启，避免带病运行产生更难排查的问题。

## 控制器与 WebContext 适配层

controller 既可用**传统 `req/res`**（局部片段 `res.render('partials/…')`），也可走**标准化 `WebContext`**（`adapter/webCtx.ts`）。

`createWebCtx(req, res)` 把请求侧（`params/query/body/locals`）与响应侧（`status/send/json/sendHtml/render/renderPage/setHeader/cookie/end`）包装成统一上下文对象，controller 只依赖 `WebContext` 类型而不直接摸 `req/res`，将来替换 Web 框架（Hono / Fastify / Koa…）只需换 `createWebCtx` 一个实现。

## 统一错误处理

**业务错误只在 controller 层 `throw new HttpError({ status, code })`**，由全局中间件统一映射成响应；service / repository 只返回可空结果（`null` / `undefined` / `boolean`），middleware 只发响应，均不抛 HTTP 错误。

错误码集中在 `i18n/error-codes.ts` 的 `ERROR_CODES` 单一词典：`HttpError` 构造时按 `code` 反查得到 `message`（i18n key）与 `status`，格式 `xxyyy`（3 位 HTTP 状态 + 2 位序号，如 `40001`）。controller 只需 `new HttpError({ status, code })`，无需自带文案。

controller 若为 **async**，路由须用 `asyncHandler` 包裹：async 抛错会变成 rejected Promise，Express 捕获不到；`asyncHandler` 用 `.catch(next)` 把错误转进错误管道。async handler 里**任何** `throw`（含 `HttpError`、`await` 失败、`render`/`renderPage` 内部异常）都由它兜转，无需为渲染单独处理。同步路由的渲染错误则走 Express 原生 `next(err)` 链路，不需要 asyncHandler。`asyncHandler` 是路由装配工具，放在 `utils/`（不在 error.middleware），属于错误发生前的上游转运。

- `errorHandler`：唯一错误出口——`HttpError` 按其 `status` 发响应，未知异常记日志 + `500`。
- `notFoundHandler`：路由未命中的 `404` 兜底；业务「资源不存在」的 `HttpError(404)` 走 `errorHandler`，不落入此层。
- 挂载位置：`mountRoutes` 末尾（`notFoundHandler` → `errorHandler`），二者是整条请求管道的兜底。
- 响应形态：htmx / 浏览器导航 → 纯文本片段；fetch 等 API → `JSON { error }`。客户端 `client/src/handleError.ts` 通过 `beforeSwap` 放行 4xx/5xx，让错误体按 `hx-swap` 就地替换 `hx-target`。

详见 [docs/development-standards.md](docs/development-standards.md) §8「统一错误处理」。