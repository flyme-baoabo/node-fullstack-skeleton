/**
 * 零依赖结构化日志。
 *
 * 为什么不用第三方库（pino / winston）：
 *  - 本项目是研究/演示性质，日志量级很小，内置 console + JSON 序列化已足够。
 *  - 结构化体现在「每行是一个 JSON 对象」，便于 grep 单个 requestId / 字段定位问题。
 *  - 若要升级（文件、轮转、按级别过滤），再低成本替换成本文件即可，不影响调用方。
 */

type LogMeta = Record<string, unknown>;


/**
 * 本地时间的人类可读文案（供日志的 tsLocal 字段）。
 *
 * 目标格式：`2026-08-27 11:44:51 GMT+0800 (中国标准时间)`，一眼可读且带时区偏移+区名。
 * 日期部分用 `'sv-SE'`：默认恰是 `YYYY-MM-DD HH:mm:ss`，与 `ts`（ISO 8601）风格统一、
 * 可排序、易 grep。
 * 偏移 + 区名没有单一 Intl 选项一次给全，故拆两次：
 *  - 偏移：`en-US` + `timeZoneName:'longOffset'` → `GMT+08:00`，去掉冒号得 `GMT+0800`
 *  - 区名：`zh-CN` + `timeZoneName:'long'` → `中国标准时间`（英文环境给 China Standard Time）
 *
 * 注意：`.env` 里 `TZ` 只决定时区值（如 Asia/Shanghai）；时区名是中文还是英文由这里
 * 的 locale 决定，与 `TZ` 无关。
 */
function localTs(): string {
    const shellDefaultTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tz = process.env.TZ || shellDefaultTZ;
    const dateTimeFormat= new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
    const datePart = dateTimeFormat.format(new Date());
    const timeZonePart = (loc: string, tzName: 'longOffset' | 'long'): string => {
        const part = new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: tzName })
            .formatToParts(new Date())
            .find((p) => p.type === 'timeZoneName');
        return part ? part.value : '';
    };
    const offset = timeZonePart('en-US', 'longOffset').replace(':', '');      // GMT+0800
    const zoneName = timeZonePart('zh-CN', 'long');                           // 中国标准时间
    return `${datePart} ${offset} (${zoneName})`;
}

function write(level: string, method: string, msg: string, meta: LogMeta = {}): void {
    const line = JSON.stringify({
        ts: new Date().toISOString(),
        tsLocal: localTs(),
        level,
        msg,
        ...meta,
    });
    if (method === 'error' || method === 'warn') {
        console[method](line);
    } else {
        console.log(line);
    }
}

export const logger = {
    info: (msg: string, meta: LogMeta = {}): void => write('info', 'log', msg, meta),
    warn: (msg: string, meta: LogMeta = {}): void => write('warn', 'warn', msg, meta),
    error: (msg: string, meta: LogMeta = {}): void => write('error', 'error', msg, meta),
};