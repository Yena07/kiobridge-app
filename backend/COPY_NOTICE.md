# 이 폴더는 사본입니다

팀 저장소 [`watTHEBUG/kioBridge`](https://github.com/watTHEBUG/kioBridge) 의 `backend/` 를
로컬에서 프론트와 붙여 보려고 그대로 복사해 둔 것입니다.

```
원본   watTHEBUG/kioBridge  dev  9c9e014  [FEAT] recommendation ruleevaluator (#38)
복사   2026-08-07
```

## 여기서 고치지 마세요

**원본은 팀원들의 코드입니다.** 이 사본을 고쳐도 팀 저장소에는 반영되지 않고,
다음에 새로 받아오면 조용히 사라집니다.

백엔드를 고쳐야 하면 팀 저장소에 이슈나 PR 로 올려 주세요.
프론트에서 발견한 것들은 [`docs/BACKEND_INTEGRATION.md`](../docs/BACKEND_INTEGRATION.md) 에
질문으로 적어 두었습니다.

## 새로 받아오기

```bash
git -C <팀레포> fetch origin
git -C <팀레포> worktree add --detach C:\Users\bubut\kb\dev origin/dev
robocopy C:\Users\bubut\kb\dev\backend backend /MIR /XD .git
```

`robocopy /MIR` 은 지워진 파일까지 맞춰 줍니다. 이 파일은 지워지므로 다시 두세요.

## 로컬에서 돌리기

JDK 21 과 시뮬레이션 킷(`:4000`)이 있어야 합니다.

```bash
cd backend
./gradlew bootRun          # :8080
```

킷을 먼저 띄워야 합니다. 백엔드가 `SIMULATION_API_BASE_URL`(기본 `http://localhost:4000`)
로 시뮬레이션 API 를 부릅니다.

프론트는 `KIOBRIDGE_API_BASE=http://localhost:8080` 을 주면 `/api/bff` 프록시가
그리로 넘겨 줍니다.
