import { handleConfirm } from '../components/confirm';
import { showToast, ToastVariant } from '../components/toast';
import { t } from '../i18n/i18n';
import { initLanguageSwitcher } from '../i18n/language';
import { logger } from '../utils/logger';
/**
 * HTMX 2.x 完整生命周期事件（权威定稿·生产无坑全覆盖）
 * 对齐官方源码 + 生产踩坑修正 + 全特殊状态码规则 + 422专属特例
 * 完整覆盖：正常渲染、网络错误、4xx/5xx业务错误、渲染异常、204/304空响应、422表单校验、3xx重定向场景
 *  * 【全局强制前置规范】
 * 1. 所有请求头、URL、请求参数动态修改，仅可在 configRequest 执行
 * 2. beforeRequest 阶段修改网络配置不生效，禁止在此处修改请求配置
 *
 * 【状态码核心固定规则】
 * 1. 204 NoContent / 304 NotModified：成功响应、无报错、跳过全套Swap渲染链路，直达afterRequest
 * 2. 4xx/5xx：默认触发responseError、禁止DOM Swap
 * 3. 422 为全局唯一可手动放行的4xx状态码，可强制渲染DOM片段
 * 4. 301/302/303/307：XHR底层自动跟随重定向，HTMX无法捕获，业务跳转只用HX-Redirect响应头
 * htmx:confirm                         👉 请求生命周期第一层钩子，hx-confirm弹窗确认阶段
 *                                      👉 可通过event.preventDefault()终止整条请求，后续所有事件不运行
 *    ...
 */

/**
 * 挂载 htmx 生命周期事件处理器。
 * 仅在入口（main.ts bootstrap）显式调用一次；所有监听用 document/body 委托，
 * 兼容动态渲染的内容（htmx swap 进的新 DOM 无需重挂）。
 */
export function mountHtmxLifecycle(): void {
    /** htmx:confirm 拦截已提取到 components/confirm 的 handleConfirm（单一职责，这里只负责注册）。 */
    document.addEventListener('htmx:confirm', handleConfirm);

    /** configRequest 阶段：唯一合法钩子，用于注入动态请求头、URL、Query/Body 参数与 Token。 */
    document.body.addEventListener('htmx:configRequest', (event: Event) => {
        const detail = (event as CustomEvent).detail as {
            headers: Record<string, string>;
            path: string;
            parameters: Record<string, string>;
        };
        void detail;
    });

    /** beforeRequest 阶段：请求即将发起。错误反馈改用全局 toast，无需清空容器；loading 靠 hx-indicator。 */
    document.body.addEventListener('htmx:beforeRequest', (event: Event) => {
        const detail = (event as CustomEvent).detail as { elt: HTMLElement };
        void detail;
    });

    /** 从 4xx/5xx 响应里尽量提取可读消息：JSON {message} → 纯文本 → 状态码兜底。 */
    function extractErrorMessage(xhr: XMLHttpRequest): string {
        const contentType = xhr.getResponseHeader('content-type') ?? '';
        if (contentType.includes('application/json')) {
            try {
                const body = JSON.parse(xhr.responseText);
                if (typeof body?.message === 'string' && body.message.trim()) {
                    return body.message.trim();
                }
            } catch { /* 解析失败走兜底 */ }
        }
        if (xhr.responseText && !xhr.responseText.includes('<')) {
            const plain = xhr.responseText.trim();
            if (plain) return plain.slice(0, 120);
        }
        return String(xhr.status);
    }

    /** 把 XHR 错误标准化成结构化 meta，供 logger.error 使用：status + 可读 message + 错误详情。 */
    const errorMeta = (detail: {
        xhr: XMLHttpRequest;
        error: Error;
    }): Record<string, unknown> => {
        const { xhr, error } = detail;
        return {
            status: xhr.status,
            message: extractErrorMessage(xhr),
            error: error instanceof Error ? error.message : String(error || 'unknown'),
        };
    };

    /** sendError 阶段：纯网络层异常（断网 / 超时 / CORS / 被拦截 / 手动 abort），无响应体可显示。 */
    document.body.addEventListener('htmx:sendError', (event: Event) => {
        const detail = (event as CustomEvent).detail as {
            xhr: XMLHttpRequest;
            error: Error;
        };
        logger.error('网络请求失败', errorMeta(detail));
        showToast(t('toast.network_error'), ToastVariant.Error);
    });

    /** beforeSwap 阶段：核心放行逻辑。
     *  规则：422（表单校验）强制放行渲染、isError=false 静默 responseError → 表单回显错误；
     *        其余 4xx/5xx 保持 htmx 默认不 swap，交由 responseError 弹全局 toast。 */
    document.body.addEventListener('htmx:beforeSwap', (event: Event) => {
        const detail = (event as CustomEvent).detail as {
            xhr: XMLHttpRequest;
            shouldSwap: boolean;
            isError: boolean;
        };
        // 422 表单校验：放行渲染（把服务端错误 HTML swap 进原 target），且 isError=false
        if (detail.xhr.status === 422) {
            detail.shouldSwap = true;
            detail.isError = false;
            return;
        }
        // 其余 4xx/5xx：保持默认（shouldSwap=false），交给 responseError 弹全局 toast
    });

    /** responseError 阶段：网络正常返回 4xx/5xx（422 已在 beforeSwap 置 isError=false，天然不会进来）。 */
    document.body.addEventListener('htmx:responseError', (event: Event) => {
        const detail = (event as CustomEvent).detail as {
            xhr: XMLHttpRequest;
            error: Error;
        };
        // 兜底过滤：万一 422 仍到这里（配置差异）也静默，不弹全局 toast
        if (detail.xhr.status === 422) return;
        logger.error('htmx responseError', errorMeta(detail));
        showToast(
            t('toast.request_failed', {
                status: detail.xhr.status,
                message: extractErrorMessage(detail.xhr),
            }),
            ToastVariant.Error,
        );
        void detail.error;
    });

    /** swapError 阶段：DOM 替换失败（多为 2xx 但 HTML 解析/渲染异常），走不到 afterSwap，直接弹 toast。 */
    document.body.addEventListener('htmx:swapError', (event: Event) => {
        const detail = (event as CustomEvent).detail as {
            xhr: XMLHttpRequest;
            error: Error;
        };
        logger.error('htmx swap failed', errorMeta(detail));
        showToast(t('toast.swap_failed'), ToastVariant.Error);
    });

    /** afterSwap 阶段：DOM 已插入完成（带 htmx-added/htmx-settling 临时 class），适合 focus/简单初始化。
     *  路由/语言切换会用 AJAX 整块替换 DOM，故这里对语言菜单做幂等重绑（INITIALIZED 守卫防重）。 */
    document.body.addEventListener('htmx:afterSwap', (event: Event) => {
        const detail = (event as CustomEvent).detail as { elt: HTMLElement };
        void detail;
        // 页面级路由跳转（hx-boost 会用 AJAX 替换整个 body，原先挂在 #root 内的语言菜单会被换成新 DOM）。
        // 监听 htmx:afterSwap（任何 swap 完成后触发，含 boost 的 body 替换），对新 DOM 重新绑定。
        initLanguageSwitcher();
    });

    /** afterSettle 阶段：默认延时 20ms 后触发，布局与动画稳定。读尺寸、滚动定位放这里。 */
    document.body.addEventListener('htmx:afterSettle', (event: Event) => {
        const detail = (event as CustomEvent).detail as { elt: HTMLElement };
        void detail;
    });

    /** afterRequest 阶段：无论成功 / 失败 / 204 / 网络错误，必触发。统一收尾：关闭 loading、解锁交互。 */
    document.body.addEventListener('htmx:afterRequest', (event: Event) => {
        const detail = (event as CustomEvent).detail as { elt: HTMLElement };
        void detail;
    });
}