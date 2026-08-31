/**
 * htmx 装配入口：加载 htmx.org + 挂载生命周期事件。
 */
import { mountHtmxLifecycle } from './mountHtmxLifecycle';

/**
 * 初始化 htmx：动态加载并将实例缓存到 window.htmx，随后挂载生命周期事件。
 * @returns 已加载的 htmx 实例
 */
export async function initHtmx(): Promise<typeof import('htmx.org').default> {
    const htmx = (window.htmx = (await import('htmx.org')).default);
    mountHtmxLifecycle();
    console.log('[htmx] loaded & lifecycle mounted');
    return htmx;
}