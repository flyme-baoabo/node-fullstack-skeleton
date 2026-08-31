import { escapeHtml } from '../utils/escapeHtml';

/**
 * 确认弹窗 + htmx:confirm 拦截模块。
 *
 * 只负责：
 *  - openConfirm：打开确认弹窗，resolve(true/false)
 *  - handleConfirm：htmx:confirm 事件处理器（带 data-confirm 就弹框拦截，确认后放行请求）
 *  - closeModal：内部工具
 * 拦截由 mountHtmxLifecycle.ts 触发注册（document 上委托监听，兼容动态渲染按钮）。
 */

/** htmx:confirm 事件对象：elt 为触发元素，issueRequest 确认后放行请求 */
export type ConfirmEvent = CustomEvent<{
    elt: HTMLElement;
    issueRequest: (skipConfirmation?: boolean) => void;
}>;

/** 确认框是否已存在（避免重复创建） */
let modalRoot: HTMLElement | null = null;

/** 弹窗配置：标题、确认文案、配色、图标 */
interface ConfirmOptions {
    title?: string;
    confirmText?: string;
    cancelText?: string;
    /** danger = 红色（删除）；info = 蓝色/常规（切换等） */
    variant?: 'danger' | 'info';
}

/** 打开确认框，resolve(true) 表示确认，resolve(false) 表示取消 */
export function openConfirm(
    message: string,
    options: ConfirmOptions = {},
): Promise<boolean> {
    const { title, confirmText, cancelText, variant = 'info' } = options;
    const isDanger = variant === 'danger';
    // 图标与按钮的配色随变体切换
    const badgeClass = isDanger
        ? 'bg-rose-50 ring-rose-100 text-rose-500'
        : 'bg-emerald-50 ring-emerald-100 text-emerald-600';
    const confirmBtnClass = isDanger ? 'btn-danger' : 'btn-primary';
    const iconPath = isDanger
        ? 'M12 9v4m0 4h.01M10.29 3.86l-8.12 14.18A2 2 0 0 0 4 21h16a2 2 0 0 0 1.84-2.96L17.71 7.86a2 2 0 0 0-1.71-3h-.08a2 2 0 0 0-1.72 1z'
        : 'M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z';

    return new Promise((resolve) => {
        closeModal();

        // 遮罩 + 弹窗容器
        // 用 w-screen h-screen = 100vw × 100vh 铺满视口；flex 居中让卡片对准中心
        const overlay = document.createElement('div');
        overlay.className =
            'fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm';
        overlay.id = 'confirm-overlay';

        const panel = document.createElement('div');
        panel.className =
            'card w-full max-w-sm p-6 text-center'; // card 自带 shadow-card

        panel.innerHTML = `
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full ring-1 ${badgeClass}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="${iconPath}" />
                </svg>
            </div>
            <h3 class="mt-4 text-center text-lg font-semibold text-gray-900">${escapeHtml(title, 'confirm.title')}</h3>
            <p class="mt-2 text-center text-sm leading-relaxed text-gray-500">${escapeHtml(message)}</p>
            <div class="mt-6 flex items-center justify-end gap-3">
                <button type="button" data-action="cancel" class="btn-ghost">${escapeHtml(cancelText, 'confirm.cancel_btn')}</button>
                <button type="button" data-action="confirm" class="${confirmBtnClass}">${escapeHtml(confirmText, 'confirm.confirm_btn')}</button>
            </div>
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // 关闭函数（仅关闭 UI，不含 resolve，供取消/遮罩点击用）
        const resolveAndClose = (value: boolean) => {
            closeModal();
            resolve(value);
        };

        // 事件绑定放在 close 之后，确保只绑定一次
        panel
            .querySelector<HTMLButtonElement>('[data-action="confirm"]')!
            .addEventListener('click', () => resolveAndClose(true));
        panel
            .querySelector<HTMLButtonElement>('[data-action="cancel"]')!
            .addEventListener('click', () => resolveAndClose(false));
        // 点击遮罩(100vw×100vh 的 mask)不关闭弹窗，只能通过"取消"按钮或 Esc 关闭
        // Esc 关闭
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') resolveAndClose(false);
        };
        document.addEventListener('keydown', onKey);
    });
}

/** 移除弹窗 DOM */
function closeModal(): void {
    const old = document.getElementById('confirm-overlay');
    if (old) old.remove();
    modalRoot = null;
}
/**
 * htmx:confirm 拦截处理器：带 data-confirm 的操作弹出确认框。
 * 由 mountHtmxLifecycle.ts 在 document 上委托注册，兼容动态渲染的按钮。
 *
 * 注意：该版本 htmx 派发的事件名是 `htmx:confirm`（在 elt 上派发并冒泡到 document），
 *      不是旧版的 `htmx:confirmRequest`，用错事件名会导致监听永不触发。
 */
export function handleConfirm(e: Event): void {
    const evt = e as ConfirmEvent;
    const elt = evt.detail.elt;
    const getAttr = (name: string) =>
        elt.getAttribute(name) ??
        elt.closest('[data-confirm]')?.getAttribute(name);

    const message = getAttr('data-confirm');

    // 没有确认标记（切换/新增等）→ 放行，htmx 正常发请求
    if (!message) return;

    // 有确认标记 → 拦下来，做异步确认
    e.preventDefault();
    void openConfirm(message, {
        title: getAttr('data-confirm-title') || undefined,
        confirmText: getAttr('data-confirm-confirm') || undefined,
        cancelText: getAttr('data-confirm-cancel') || undefined,
        variant:
            (getAttr('data-confirm-variant') as 'danger' | 'info' | null) ??
            undefined,
    }).then((ok) => {
        if (ok) evt.detail.issueRequest();
    });
}