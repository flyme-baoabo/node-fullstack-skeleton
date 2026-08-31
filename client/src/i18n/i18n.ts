/**
 * 客户端 i18n 取词条工具。
 * 词条定义在服务端（server/src/locales/*.json），由 layout.ejs / change-language
 * 注入到 window.I18n；本节根据点号 key（如 "toast.network_error"）从该对象取值，
 * 支持 {{var}} 插值，找不到时回退返回 key 本身。
 */

/**
 * 从 window.I18n 取词条。
 * @param key 点号路径，如 "toast.network_error"
 * @param params 插值参数，模板里用 {{name}} 占位
 */
export function t(
    key: string,
    params: Record<string, string | number> = {},
): string {
    const source = window.I18n as Record<string, unknown> | undefined;
    let value: unknown = key
        .split('.')
        .reduce<unknown>((acc, seg) => {
            if (acc && typeof acc === 'object') {
                return (acc as Record<string, unknown>)[seg];
            }
            return undefined;
        }, source);

    if (typeof value !== 'string') return key; // 兜底：返回 key，便于发现缺失词条

    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
        params[name] != null ? String(params[name]) : '',
    );
}