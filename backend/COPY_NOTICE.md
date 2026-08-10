# 이 폴더는 사본입니다

팀 저장소 [`watTHEBUG/kioBridge`](https://github.com/watTHEBUG/kioBridge) 의 `backend/` 를
로컬에서 프론트와 붙여 보려고 그대로 복사해 둔 것입니다.

```
원본   watTHEBUG/kioBridge  dev  04b17d0  [FIX] recommendation PASS, SKIP 점수 수정 (#59)
복사   2026-08-10
```

빌드 산출물(`build/`, `.gradle/`)은 복사하지 않습니다. 만들어지는 것이라
저장소에 둘 이유가 없고, 팀 저장소도 무시합니다. 그래서 이 폴더는 **소스 기준으로**
팀 `dev` 와 같습니다.

## 낡으면 무슨 일이 생기나

2026-08-10 에 겪은 일입니다. 사본이 `#45` 시점에 멈춰 있었는데,
그 사이 팀이 `#48`·`#50`·`#52`·`#54` 를 머지했습니다. 그래서 이 사본으로 띄운
백엔드는 **`member` 모듈 자체가 없어서 로그인 API 가 없었고**, 승인 응답도
`#48` 이전 모양(`{ valid, run, evidence, validation }`)이라 `summary` 가
아예 오지 않았습니다.

프론트는 멀쩡한데 화면에서만 안 되는 것처럼 보입니다. **연동이 안 되는 것 같으면
이 사본이 언제 것인지부터 보세요.** 위의 커밋 해시와 팀 `dev` 를 비교하면 됩니다.

```bash
git -C <팀레포> fetch origin && git -C <팀레포> log --oneline -1 origin/dev
```

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

워크트리가 이미 있으면 `git -C C:\Users\bubut\kb\dev checkout --detach origin/dev` 로
옮기면 됩니다.

`robocopy /MIR` 은 지워진 파일까지 맞춰 줍니다. **이 파일은 지워지므로 다시 두세요.**
받아온 뒤에는 위의 커밋 해시와 날짜도 함께 고칩니다 — 안 고치면 다음 사람이
낡았는지 알 방법이 없습니다.

받아온 뒤 백엔드가 이미 떠 있으면 **다시 띄워야 합니다.** `bootRun` 은 이미
컴파일된 `build/classes` 로 도는 프로세스라, 소스만 바꿔서는 아무것도 달라지지
않습니다. 위에서 겪은 일이 정확히 이것입니다.

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

붙었는지 한 번에 확인하려면 `npm run check:backend` 를 쓰세요. 앱이 부르는 경로를
앱이 부르는 순서로 불러 보고, 200 인지만이 아니라 실제로 담기는지까지 봅니다.

`npm run dev` 는 그대로 목으로 돕니다.
