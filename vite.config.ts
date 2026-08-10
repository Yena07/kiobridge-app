import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// package.json 의 type 이 module 이라 __dirname 이 없다.
// 지금은 vite 가 CJS 로 트랜스파일해서 우연히 도는 것이고, 설정을 바꾸면 터진다.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// figmaAssetResolver 는 지웠다. figma:asset/ 로 시작하는 import 가 한 곳도 없어서
// 아무 일도 하지 않는 플러그인이었다. 원래 Figma Make 가 넣어 둔 것이다.

/**
 * 저작자 표시 문서를 배포물에 넣는다.
 *
 * 사진 중 일부가 CC BY-SA 다. 이 라이선스는 저작자 표시를 저작물과 함께
 * 배포할 것을 요구한다. ATTRIBUTIONS.md 는 src/assets 에 있어서 번들에
 * 들어가지 않았고, 정작 문서 자신은 "이 문서는 배포물에도 포함된다" 라고
 * 적혀 있었다. 문서가 스스로에 대해 거짓말하고 있던 셈이다.
 *
 * public/ 으로 옮기는 대신 여기서 복사한다. 두 벌을 두면 언젠가 갈라지고,
 * 갈라진 쪽이 배포되면 고지 의무를 지키지 못한다. 원본은 한 곳만 둔다.
 */
function 저작자표시복사() {
  const 원본 = path.resolve(__dirname, './src/assets/ATTRIBUTIONS.md')
  return {
    name: 'copy-attributions',
    apply: 'build' as const,
    closeBundle() {
      // 없으면 조용히 넘어가지 않는다. 고지 의무를 못 지킨 채로 배포된다.
      if (!fs.existsSync(원본)) throw new Error('ATTRIBUTIONS.md 가 없습니다. CC BY-SA 고지가 배포물에서 빠집니다.')
      fs.copyFileSync(원본, path.resolve(__dirname, './dist/ATTRIBUTIONS.md'))
    },
  }
}

/*
 * mode 는 npm 스크립트가 정한다.
 *   npm run dev       →  기본 — 목으로 돈다
 *   npm run dev:team  →  --mode team — 팀 백엔드로 붙는다
 *
 * .env 파일에 두지 않는다. 팀 저장소는 .env* 를 통째로 무시해서 그 파일이
 * 따라가지 못하고, 그러면 거기서는 dev:team 이 조용히 목으로 돈다.
 * 어느 구현을 쓸지 고르는 스위치일 뿐이라 비밀값도 아니다.
 */
export default defineConfig(({ mode }) => ({
  define: {
    /*
     * 맨 이름(__TEAM_BACKEND__)으로 둔다. import.meta.env.VITE_BACKEND 로 두면
     * 개발 서버에서 조용히 목으로 돈다.
     *
     * Vite 는 import.meta.env 를 자기가 만들어 넣는다. define 으로 그 안의 키를
     * 덮는 것은 빌드에서만 통하고, 개발 서버에서는 무시된다. 그래서 .env 파일을
     * 없애고 이리로 옮긴 뒤부터 npm run dev:team 이 목으로 돌고 있었다 —
     * 화면은 그럴듯하게 답하니 아무도 눈치채지 못한다. 이 파일이 막으려던
     * 바로 그 상황이었다.
     *
     * 맨 이름은 개발.빌드 양쪽에서 똑같이 치환된다. 확인은 이렇게 한다.
     *   curl -s localhost:5199/src/api/devlog.ts | grep 팀백엔드모드
     */
    __TEAM_BACKEND__: JSON.stringify(mode === 'team'),
  },
  plugins: [react(), tailwindcss(), 저작자표시복사()],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  server: {
    /*
     * 개발 서버에서도 /api/bff 가 백엔드로 가게 한다.
     *
     * 배포본에서는 Vercel 서버 함수(api/bff.ts)가 이 일을 한다. 개발 서버는
     * 그 함수를 돌리지 않으므로 여기서 같은 모양으로 넘겨 준다. 브라우저는
     * 양쪽 모두 같은 출처로만 요청하게 되어 CORS 가 발생하지 않는다.
     *
     * 주소는 KIOBRIDGE_API_BASE 로 준다. 기본은 로컬 백엔드(:8080)다.
     * 운영 배포(main)에 컨트롤러가 올라가기 전까지는 dev 를 로컬에서 돌려
     * 붙이는 것이 유일한 연동 시험 방법이다.
     */
    proxy: {
      '/api/bff': {
        target: process.env.KIOBRIDGE_API_BASE ?? 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/bff/, ''),
        configure: (proxy) => {
          // 배포본 BFF 는 클라이언트 헤더를 백엔드로 넘기지 않는다. 여기도 맞춘다.
          //
          // 안 떼면 브라우저의 Origin 이 그대로 가서 백엔드 CORS 필터가 403 을 준다.
          // 백엔드는 allowed-origin 을 하나만 받는데(기본 :5173) 우리 개발 서버는
          // 다른 포트다. 서버끼리 주고받는 요청에는 Origin 이 있을 이유가 없다.
          proxy.on('proxyReq', (req) => {
            req.removeHeader('origin')
            req.removeHeader('referer')
            req.removeHeader('cookie')
          })
        },
      },
    },
  },
}))
