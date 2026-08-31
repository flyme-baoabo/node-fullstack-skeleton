/**
 * 页面注册表：URL 路径 -> 页面内容视图 + 标题。
 * 渲染链由 res.renderPage 统一处理（内容 -> app-layout -> layout.ejs）。
 *
 * 语言切换 /body 靠它按当前 path 找到对应视图，从而触发无感切换后重绘的是"当前页"。
 * 新增页面（/signin、/signup…）只需在此登记，整页路由与 /body 重绘自动生效。
 */

export interface PageMeta {
    view: string;
    title: string;
}

const INDEX_PATH = '/';
const LIST_PATH = '/list';

export const PAGE_META: Record<string, PageMeta> = {
    [INDEX_PATH]: { view: 'pages/index', title: 'htmx Study' },
    [LIST_PATH]: { view: 'pages/listPage', title: '待办清单 - htmx Study' },
};

/** 按 path 取页面元信息；未知 path 兜底到首页。 */
export function metaForPath(path: unknown): PageMeta {
    const _path = String(path || INDEX_PATH);
    return PAGE_META[_path] ?? PAGE_META[_path.replace(/\/$/, '')] ?? PAGE_META[INDEX_PATH];
}