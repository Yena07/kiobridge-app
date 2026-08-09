# 이 폴더는 사본입니다

팀 저장소 [`watTHEBUG/kioBridge`](https://github.com/watTHEBUG/kioBridge) 의 `backend/` 를
로컬에서 프론트와 붙여 보려고 그대로 복사해 둔 것입니다.

```
원본   watTHEBUG/kioBridge  dev  c1817fd  [FIX] 통합 테스트 중 버그 수정 (#45)
복사   2026-08-09
```

빌드 산출물(`build/`, `.gradle/`)은 복사하지 않습니다. 만들어지는 것이라
저장소에 둘 이유가 없고, 팀 저장소도 무시합니다. 그래서 이 폴더는 **소스 기준으로**
팀 `dev` 와 같습니다.

## 여기서 고치지 마세요

**원본은 팀원들의 코드입니다.** 이 사본을 고쳐도 팀 저장소에는 반영되지 않고,
다음에 새로 받아오면 조용히 사라집니다.

백엔드를 고쳐야 하면 팀 저장소에 이슈나 PR 로 올려 주세요.
프론트에서 발견한 것들은 [`docs/BACKEND_INTEGRATION.md`](../docs/BACKEND_INTEGRATION.md) 에
질문으로 적어 두었습니다.

## 왜 사본이 필요한가

운영 배포(`main`)는 `dev` 보다 한참 뒤처져 있어서 컨트롤러가 하나도 없습니다.
`main` 이 배포되기 전까지 실제 연동을 시험해 볼 방법이 **로컬에서 `dev` 를 돌리는 것뿐**입니다.

## 새로 받아오기

```bash
git -C <팀레포> fetch origin
git -C <팀레포> worktree add --detach C:\Users\bubut\kb\dev origin/dev
robocopy C:\Users\bubut\kb\dev\backend backend /MIR /XD .git build .gradle
```

`robocopy /MIR` 은 지워진 파일까지 맞춰 줍니다. 이 파일은 지워지므로 다시 두세요.

## 로컬에서 셋 다 띄우기

순서가 있습니다. 킷이 먼저입니다 — 백엔드가 `SIMULATION_API_BASE_URL`(기본
`http://localhost:4000`)로 킷을 부릅니다.

```bash
# 1) 시뮬레이션 킷  :4000
cd C:\KB516\kiobridge-simulation-kit-v5.1.6
npm run start:api

# 2) 백엔드  :8080   (JDK 21 필요)
cd backend
.\gradlew.bat bootRun

# 3) 프론트  :5199 — 목이 아니라 진짜 백엔드로
npm run dev:team
```

`dev:team` 은 두 가지를 한다.

- `--mode team` — `client.ts` 가 목 대신 `createTeamBackend()` 를 쓴다.
- Vite 개발 서버가 `/api/bff` 를 `KIOBRIDGE_API_BASE`(기본 `http://localhost:8080`)로
  넘긴다. 배포본의 BFF 함수가 하는 일을 개발 서버가 대신하는 것이라 CORS 가 없다.

화면 오른쪽 아래에 **실서버에 붙어 있습니다** 패널이 뜨고, 오간 요청이 한 줄씩 쌓입니다.
목으로 돌면 요청이 아예 없으므로 그 패널이 곧 증거입니다.

`npm run dev` 는 그대로 목으로 돕니다.
