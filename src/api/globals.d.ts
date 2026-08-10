/**
 * 빌드할 때 값이 박히는 이름.
 *
 * vite.config.ts 의 define 이 개발 서버와 빌드 양쪽에서 이 이름을 그대로
 * 참/거짓으로 바꿔 놓는다. 목으로 돌지 실서버로 붙을지를 정하는 유일한 스위치다.
 *
 *   npm run dev         false   목
 *   npm run dev:team    true    팀 백엔드 (/api/bff → KIOBRIDGE_API_BASE)
 *   npm run build       false   목
 *   npm run build:team  true    팀 백엔드  ← 배포는 이걸 쓴다
 *
 * import.meta.env.VITE_BACKEND 로 두지 않는다. Vite 가 import.meta.env 를 자기가
 * 만들어 넣기 때문에 define 으로 그 안의 키를 덮는 것은 빌드에서만 통하고,
 * 개발 서버에서는 무시되어 조용히 목으로 돈다.
 */
declare const __TEAM_BACKEND__: boolean;
