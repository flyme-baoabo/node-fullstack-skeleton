declare type StringMap<T = any> = Record<string, T>;

interface Window {
    I18n: StringMap;
    htmx: typeof import('htmx.org').default;
}

declare let I18n: StringMap;