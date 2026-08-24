/**
 * 等价原生命令：vite dev
 * 实现：手写 Vite 启动流程、自定义配置合并、命令行参数覆写
 * 配置优先级：命令行传参 > client/vite.config.ts
 */
import { createServer } from 'vite'
import { setupWorkDir, getCliArgs } from './vite-utils.js'

; (async function main() {
    let server
    try {
        const { clientDir } = setupWorkDir()
        process.chdir(clientDir); // 切换工作区 替代 root设置
        console.log(`📂 Vite 前端根目录: ${clientDir}`)
        const args = getCliArgs()

        // 基础覆盖配置：指定 Vite 工作根目录
        const configOverrides = {
            // root: clientDir,
            server: {}
        }

        // 解析命令行自定义参数
        for (const arg of args) {
            if (arg.startsWith('--port=')) {
                configOverrides.server.port = Number(arg.split('=')[1])
            } else if (arg === '--host') {
                configOverrides.server.host = true
            } else if (arg.startsWith('--host=')) {
                configOverrides.server.host = arg.split('=')[1]
            } else if (arg.startsWith('--mode=')) {
                configOverrides.mode = arg.split('=')[1]
            }
        }

        // 启动 Vite 服务，自动读取 client/vite.config.ts 并合并配置
        server = await createServer(configOverrides)
        await server.listen()

        const urls = server.resolvedUrls
        if (urls?.local?.length) {
            console.log('\n🚀 Vite Dev 服务启动成功：')
            urls.local.forEach(u => console.log('  -', u))
        }

    } catch (err) {
        console.error('\n💥 启动开发服务失败：', err.message)
        process.exit(1)
    }

    // 优雅关闭服务
    process.on('SIGINT', async () => {
        if (server) await server.close()
        console.log('\n👋 Vite 服务已正常关闭')
        process.exit(0)
    })
})()
