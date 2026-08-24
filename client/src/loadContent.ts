// import htmx from 'htmx.org';
// import './mountHtmxLifecycle';


window.addEventListener('DOMContentLoaded', async () => {
    const htmx = window.htmx = (await import('htmx.org')).default;
    await import('./mountHtmxLifecycle');
    console.log('[main.ts] htmx loaded', htmx);


    async function loadPageByPath(path: string = window.location.pathname) {
        const rootSelector = '#root';
        const res = await htmx.ajax('get', `/page${path}`, {
            swap: 'innerHTML',
            target: rootSelector,
        });
        console.log('[main.ts] htmx.ajax get', path, res);
        // htmx.process(document.querySelector(rootSelector)!);
    }

    // 1、初始页面加载
    loadPageByPath();

    // 2、监听浏览器 前进/后退按钮 (popstate事件)
    window.addEventListener('popstate', () => {
        loadPageByPath();
    });

    // ========== 重点：拦截 pushState / replaceState，捕获JS代码跳转 ==========
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    // 重写pushState，每次调用就触发我们的回调
    history.pushState = function(...args) {
        originalPushState.apply(this, args);
        // args[2] 就是新的url
        const newUrl = args[2];
        if(newUrl) {
            // const urlObj = new URL(newUrl, window.location.origin);
            loadPageByPath();
        }
    }

    history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        const newUrl = args[2];
        if(newUrl) {
            // const urlObj = new URL(newUrl, window.location.origin);
            loadPageByPath();
        }
    }
});