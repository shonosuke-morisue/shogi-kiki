import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// 評価値エンジン (やねうら王 WebAssembly 版) のファイルを engine/ に置く。
// emscripten の出力はバンドルせず、そのままのファイル名で読み込む必要がある。
const ENGINE_FILES = ['yaneuraou.k-p.js', 'yaneuraou.k-p.worker.js', 'yaneuraou.k-p.wasm']
const engineDir = dirname(createRequire(import.meta.url).resolve('@mizarjp/yaneuraou.k-p'))

function shogiEngine(): Plugin {
  return {
    name: 'shogi-engine',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].match(/\/engine\/([^/]+)$/)?.[1]
        if (!name || !ENGINE_FILES.includes(name)) return next()
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        res.end(readFileSync(join(engineDir, name)))
      })
    },
    generateBundle() {
      for (const name of ENGINE_FILES) {
        this.emitFile({ type: 'asset', fileName: `engine/${name}`, source: readFileSync(join(engineDir, name)) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), shogiEngine()],
})
