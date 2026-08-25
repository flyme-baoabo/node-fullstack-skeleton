/**
 * 等价原生命令：vite build
 * 实现：手写 Vite 打包流程、自定义配置合并、命令行参数覆写
 * 配置优先级：命令行传参 > client/vite.config.ts
 */
import { build } from 'vite'
import path from 'path'
import { setupWorkDir, getCliArgs } from './vite-utils.js'

;(async function main() {
  try {
    const { clientDir, rootDir } = setupWorkDir()
    process.chdir(clientDir) // 切换工作区 替代 root设置
    const args = getCliArgs()

    const buildConfig = {
      // root: clientDir,
      build: {
        // 产物输出到项目根目录 dist-client ，不在client内部
        outDir: path.resolve(rootDir, './dist-client'),
        emptyOutDir: true
      }
    }

    for (const arg of args) {
      if (arg.startsWith('--mode=')) {
        buildConfig.mode = arg.split('=')[1]
      }
    }

    await build(buildConfig)
    console.log(`✅ 打包完成，产物目录：${buildConfig.build.outDir}`)
  } catch (e) {
    console.error('💥打包失败', e)
    process.exit(1)
  }
})()
