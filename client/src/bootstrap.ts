/**
 * 应用启动装配入口。
 *
 * 在 DOMContentLoaded 里按顺序执行启动步骤：
 *
 *  1. initLanguageSwitcher()  绑定语言菜单（幂等，swap 后自动重绑）
 *  2. initLanguagePack()      拉取当前语言包注入 window.I18n（供前端 t() 用）
 *  3. initHtmx()              加载 htmx.org → window.htmx，并挂载生命周期事件
 *  4. setupSpaRouter(htmx)    启动 SPA 路由（点击拦截 + pushState 补丁 + 首屏加载）
 *
 * 依赖：先有 window.htmx，才能初始化路由。
 */
import { initLanguagePack, initLanguageSwitcher } from './i18n/language';
import { initHtmx } from './htmx/htmx';
import { setupSpaRouter } from './router/spaRouter';

async function bootstrap(): Promise<void> {
    initLanguageSwitcher();
    await initLanguagePack();

    const htmx = await initHtmx();
    setupSpaRouter(htmx);
}

window.addEventListener('DOMContentLoaded', () => {
    void bootstrap();
});