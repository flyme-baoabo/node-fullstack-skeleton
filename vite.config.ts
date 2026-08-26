import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// 该项目的角色：为服务端渲染的 Express 应用编译前端资源（htmx 入口、CSS）
// - dev: 由 Express 通过 middleware 模式挂载，提供 HMR
// - build: 产出固定命名的 assets，供 EJS 布局直接引用
// 采用函数形式接收 mode（Vite 由 CLI --mode / NODE_ENV 注入），据此在构建时决定是否输出 sourcemap，
// 使生产产物（mode === 'production'）不带 sourcemap，开发/预览构建则保留以利调试。
export default defineConfig(({ mode }) => {
    const isProdMode = mode === 'production';
    return {
        plugins: [tailwindcss()],
        appType: 'custom',
        // sourcemap: 生产关闭、非生产开启（开发调试友好）
        sourcemap: !isProdMode,
        // 静态资源目录：Vite dev（middleware 模式）与 build 都会把它暴露/复制到站点根路径 /。
        // 项目把 favicon 放在 client/public/，默认 publicDir 是 <root>/public，故需显式指定，否则 dev 下 /favicon.ico 会 404。
        publicDir: 'client/public',
        build: {
            sourcemap: !isProdMode, // production 无 map，其余有 map
            outDir: 'dist-client',
            emptyOutDir: true,
            // 关闭 css code-split，让样式汇总为单一 main.css，便于 EJS 布局 <link> 引用
            cssCodeSplit: false,
            rollupOptions: {
                // 把 client/src/main.ts 作为唯一构建入口
                input: 'client/src/main.ts',
                output: {
                    // 构建唯一入口固定落在 dist-client/js/main.js（不带 hash），与 EJS 布局生产态引用完全对应：
                    //   <script type="module" src="/js/main.js">  （dev 态则走 /client/src/main.ts）
                    // 全局约定：改动此处须同步 server/src/views/layouts/layout.ejs 与 Dockerfile 中对该路径的引用。
                    entryFileNames: 'js/main.js',
                    // 样式与其余资源统一进 dist-client/assets/<原名>.<ext>，布局按 <link href="/assets/style.css"> 静态引用。
                    assetFileNames: 'assets/[name][extname]',
                },
            },
        },
    };
});
