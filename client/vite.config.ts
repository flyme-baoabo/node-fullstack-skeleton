import dotenv from 'dotenv';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// 常量(扩展名分组/大正则)与工具函数(public 静态检测)分别独立，keep vite.config.ts 干净
// import { ASSET_EXT_RE } from './vite.constants.ts';
// import { publicFileExists } from './vite.utils.ts';

// NODE_ENV 由【进程环境】决定（docker/cli 注入），不从 .env 读
const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
    // 开发环境：读取 .env，加载到 process.env，不覆盖 已有的环境变量（例如 docker-compose.yml 注入的），避免覆盖掉 compose 注入的端口等配置
    dotenv.config({ path: '.env.development', override: false });
}
// env 驱动端口：VITE_PORT(前端默认5173)、 SERVER_PORT(代理目标/后端默认3006)
const vitePort = Number(process.env.VITE_PORT) || 5173;
const serverPort = Number(process.env.SERVER_PORT) || 3006;

let reqId = 0; // 用于给每个请求分配唯一 id，便于日志追踪

// 该项目的角色：为服务端渲染的 Express 应用编译前端资源（htmx 入口、CSS）
// - dev: 独立 dev server（双端口），把「SSR 页面路由」代理到 Express 后端，前端模块交给 Vite transform
// - build: 产出固定命名的 assets，供 EJS 布局直接引用
//   · JS → dist-client/js/main.js（entryFileNames）
//   · CSS → dist-client/style.css（cssCodeSplit:false，assets 资源位于 assets目录）

// defineConfig 支持函数形式，Vite 会回调 { mode, command }（ConfigEnv）。
// 构建时脚本 scripts/build-client.js 传入的 --mode 会作为这里的 mode，
// 因此源 sourcemap 等可按构建模式动态控制。
export default defineConfig(({ mode }) => {
    const isProdMode = mode === 'production';
    return {
        plugins: [tailwindcss()],
        appType: 'spa',
        // 静态资源目录：Vite dev（middleware 模式）与 build 都会把它暴露/复制到站点根路径 /。
        // 开发模式双端口：
        //   - Vite 监听 VITE_PORT，是浏览器唯一入口
        //   - '/' 代理把「页面 / 片段 / API」SSR 路由转发到 Express(SERVER_PORT)
        //   - bypass 语义（Vite 源码确认）：返回「原 url 字符串」= 交给 Vite 中间件 transform；返回 undefined = 代理到后端；返回 false = 直接 404（勿用）
        server: {
            port: vitePort,
            proxy: {
                // '/': {
                //     target: `http://localhost:${serverPort}`,
                //     changeOrigin: true,
                //     // 属于 Vite 的模块资源：返回原 url 字符串 → 交由 Vite transform / HMR
                //     // 其余 SSR 页面路由：返回 undefined → 转发到 Express 后端
                //     bypass(req) {
                //         const url = (req.url ?? '').split('?')[0];
                //         console.log(`[vite.proxy.bypass] reqId=${++reqId} url=${url}`);
                //         // Vite 应处理的路径判定（前缀 / 扩展名 / 存在的 public 静态文件）：
                //         //   - 前缀：Vite 虚拟模块(@vite/@fs/@id…)、依赖预构建、前端源码树
                //         //   - 扩展名：源码及其 import 引用的同目录资源（图片/字体/map/worker…）
                //         //   - public/ 静态资源：内容以根路径暴露，fs 存在则交给 Vite
                //         // 其余（SSR 页面路由 /、/list、/todos、/api/*…）代理给 Express 后端


                //         const isVitePath =
                //             url.startsWith('/@vite') ||
                //             url.startsWith('/@fs/') ||
                //             url.startsWith('/@id/') ||
                //             url.startsWith('/@react-refresh') ||
                //             url.startsWith('/node_modules/') ||
                //             url.startsWith('/client/src/') ||
                //             ASSET_EXT_RE.test(url);
                //         const isPublicAsset = !isVitePath && url !== '/' && publicFileExists(url);
                //         if (isVitePath || isPublicAsset) return url; // 交给 Vite

                //         // 目前 只提供 /page/*、/api/* 代理给后端，其他全部交给 Vite, 上面的先注释
                //         if (url.startsWith('/api') || url.startsWith('/page')) { // 交给 Express SSR 后端
                //             // /api/* /page/* 由后端处理，返回 undefined → 代理到后端
                //             return undefined;
                //         }
                //         return url; // 交给 Vite
                //     },
                // },
                '/api': { target: `http://localhost:${serverPort}`, changeOrigin: true },
                '/page': { target: `http://localhost:${serverPort}`, changeOrigin: true },
            },
        },
        build: {
            sourcemap: !isProdMode,   // production 无 map，其余有 map
            emptyOutDir: true,
            // 关闭 css code-split，让样式汇总为单一 style.css，便于 EJS 布局 <link> 引用
            cssCodeSplit: false,
            rollupOptions: {
                // 以 index.html 为 HTML 入口（Vite 自动解析其中 <script src="/src/main.ts"> 作 JS 入口），
                // 产物才会正确输出 index.html + js/main.js + assets。
                // ⚠️ 不能改成 'src/main.ts'：那样会丢掉 HTML 壳（index.html 不进产物，express.static 无壳可回退）。
                // input 默认就是 index.html，显式写出以免误删。
                input: 'index.html',
                output: {
                    //  产物布局：JS 进 js/，CSS 等资源进 assets/ 
                    entryFileNames: 'js/main.js',
                    // 与 entryFileNames / assetFileNames 一致：固定名、不带 contenthash，
                    // 保证文件名可预测、EJS 布局可直接写死引用（本项目无动态 import，实际不产出 chunk）
                    chunkFileNames: 'js/[name].js',
                    assetFileNames: 'assets/[name][extname]',
                },
            },
        },
    };
});