import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

// package.json 의 type 이 module 이라 __dirname 이 없다.
// 지금은 vite 가 CJS 로 트랜스파일해서 우연히 도는 것이고, 설정을 바꾸면 터진다.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// figmaAssetResolver 는 지웠다. figma:asset/ 로 시작하는 import 가 한 곳도 없어서
// 아무 일도 하지 않는 플러그인이었다. 원래 Figma Make 가 넣어 둔 것이다.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
