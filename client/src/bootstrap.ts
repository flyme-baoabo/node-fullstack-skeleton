/**
 * 应用启动装配入口。
 *
 * 在 DOMContentLoaded 里按顺序执行启动步骤：
 *
 *  1. initLanguageSwitcher()  绑定语言菜单（幂等，swap 后自动重绑）
 *  2. initHtmx()              加载 htmx.org → window.htmx，并挂载生命周期事件
 */
import { initLanguageSwitcher } from './i18n/language';
import { initHtmx } from './htmx/htmx';

async function bootstrap(): Promise<void> {
    initLanguageSwitcher();
    await initHtmx();
}

window.addEventListener('DOMContentLoaded', () => {
    void bootstrap();
});