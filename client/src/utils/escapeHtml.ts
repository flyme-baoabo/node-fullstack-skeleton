import { t } from '../i18n/i18n';

/**
 * 转义 HTML，避免外部文本（用户输入 / 待办标题等）把 DOM 结构搞乱（防注入）。
 * @param str 需要转义的原始字符串
 * @param defaultKey 可选：str 为空时回退到该 i18n key（取词条作为兜底文案）
 */
export function escapeHtml(str?: string, defaultKey?: string): string {
    if (!str) {
        return defaultKey ? escapeHtml(t(defaultKey)) : '';
    }
    return str.replace(
        /[&<>"']/g,
        (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
    );
}