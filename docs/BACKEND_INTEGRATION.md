# 프론트엔드 ↔ 백엔드 연동 메모

**연동 코드는 이미 다 짜여 있습니다.** 백엔드는 `Backend` 인터페이스 하나만 채우면 되고, 화면 코드는 한 줄도 바뀌지 않습니다.

---

## 실제로 띄워서 붙여 봤습니다 (2026-08-08)

킷(`:4000`) · 백엔드(`:8080`) · 프론트(`:5199`) 셋을 로컬에 올리고 요청을 넣어 봤습니다.
아래는 문서를 읽고 짐작한 게 아니라 **돌려 본 결과**입니다.

### 되는 것

**세션 생성이 실제로 됩니다.**

```text
POST /internal/simulation/session   {"environmentId":"chicken-store","claimCode":"kb_demo"}
→ {"sessionId":"SIM-20260808-001","initialState":"SERVICE_TYPE",
   "submissionEndpoint":"/api/v1/sessions/SIM-20260808-001/submission"}
```

`claimCode` 를 함께 보내도 **400 이 나지 않습니다.** 서버가 조용히 무시할 뿐이라, 받으실 준비가 될 때까지 프론트는 계속 보내 두겠습니다.

**목 카탈로그가 킷 fixture 와 같습니다.** 킷에서 직접 받아 대조했습니다 — `CHICKEN-001`~`008`, 축은 `SERVICE_TYPE`·`SPICY_LEVEL`·`BONE_TYPE`·`CUP`·`QUANTITY`. 화면에만 있는 가짜 메뉴는 없습니다.

### 그때 막혔던 것 — **셋 다 그 뒤에 해결됐습니다** (#41 · #42 · #43)

**① 실행계획 생성이 아직 구현 전입니다.** → **`#42` 로 구현됐습니다.**

```java
// ExecutionPlanService.buildExecutionPlan
if (!userDecision.approved()) return ExecutionPlan.empty();
throw new UnsupportedOperationException(
    "buildExecutionPlan: recommendation 기반 Action 조립이 아직 구현되지 않았습니다. ...");
```

당시에는 승인하면 예외가 났습니다. 빈 계획을 성공으로 돌려주지 않으려고 일부러 실패시켜 두신 것으로 읽었고, 그 판단에 동의합니다. **지금은 구현돼서 실행계획이 나옵니다.**

**② `State` enum 이 닭강정집 상태만 압니다.** → **아직 그대로입니다.**

```text
Cannot deserialize value of type `State` from String "WELCOME":
not one of the values accepted for Enum class:
[STOP, SERVICE_TYPE, MENU_SELECTION_WITH_CART, CART_REVIEW,
 MENU_SELECTION, OPTION_SELECTION, OPTION_CONFIRM]
```

킷이 제공하는 **sandbox 예시 제출이 JSON 파싱 단계에서 400** 으로 막힙니다. sandbox 는 연결 흐름을 연습하라고 있는 환경인데 지금은 쓸 수 없습니다. 병원·관공서도 같은 벽에 걸립니다.

환경마다 상태 집합이 다르니 enum 대신 문자열로 받거나, 환경별로 나눠 주셔야 합니다.

**③ 추천 계열에 HTTP 경로가 없습니다.** → **`#41` 로 생겼습니다.**

### 이걸로 확인된 것

`ExecutionPlanService.submitAndRun` 이 프론트가 가정한 것과 정확히 같습니다.

```java
simulationApiClient.submit(sessionId, submission);
ValidationResult validation = simulationApiClient.validate(sessionId);
if (!validation.valid()) return new ExecuteResult(false, null, null, validation);  // run·evidence 가 null
return simulationApiClient.execute(sessionId);
```

`valid: false` 면 증거가 없고 실행도 없었다는 뜻입니다. 프론트는 이 경우 진행 화면을 그대로 두고 아무것도 지어내지 않습니다. 테스트로 잠가 두었습니다.

---

## 붙이는 방법 — 한 줄입니다

바꾸는 곳은 `src/api/client.ts` 의 마지막 줄 하나입니다. 화면 코드는 손대지 않습니다.

```ts
- export const api: KioBridgeApi = mockApi;
+ export const api = createApi(createTeamBackend());
```

붙일 상대에 따라 둘 중 하나를 씁니다. 둘 다 `src/api/backend.ts` 에 있습니다.

| | 언제 |
| --- | --- |
| **`createTeamBackend()`** | **지금 팀 백엔드에 붙일 때.** 실제 경로와 응답 모양에 맞춰 두었습니다. 주소는 `/api/bff` 가 기본이라 넣지 않아도 됩니다. |
| `createHttpBackend("https://<주소>")` | 명세서대로 구현된 서버에 붙일 때. 명세 경로를 그대로 `fetch` 합니다. |

`getProfile` 을 세 번째 인자로 넘깁니다. 팀 백엔드에는 프로필 저장소가 없어서 후보 필터·추천·승인 때마다 내용을 함께 보내야 하고, 그 내용을 들고 있는 곳이 화면이라서요.

**배포본은 아직 목입니다.** 운영 배포(`main`)가 `dev` 보다 한참 뒤처져 컨트롤러가 하나도 없어서, 지금 바꾸면 배포된 앱이 첫 화면부터 멈춥니다.

대신 **로컬에서 `dev` 를 돌려 붙이는 길**을 열어 두었습니다.

```bash
npm run dev:team
```

`VITE_BACKEND=team` 으로 팀 백엔드를 쓰고, 개발 서버가 `/api/bff` 를 `KIOBRIDGE_API_BASE`(기본 `http://localhost:8080`)로 넘깁니다. 배포본의 BFF 함수가 하는 일을 개발 서버가 대신하는 것이라 CORS 가 없습니다.

`main` 이 배포되면 `client.ts` 의 스위치를 걷어내고 팀 백엔드를 기본으로 삼겠습니다.

둘이 풀리면 이 한 줄만 바꾸면 됩니다.

## 실제 구현과 명세서가 다릅니다 — 먼저 읽어 주세요

팀 백엔드 코드를 직접 확인한 결과입니다.

`dev` 의 컨트롤러를 직접 읽고 맞췄습니다. (2026-08-09 기준)

| 명세서 | 실제 구현 |
| --- | --- |
| `POST /api/v1/sessions` | `POST /internal/simulation/session` |
| `submission` → `validate` → `execute` (3단계) | `POST /internal/simulation/submit-and-run` (일괄) |
| `GET /internal/simulation/evidence/{id}` | 없음 — **필요 없습니다** (아래) |
| `POST /api/v1/candidate-filters` | 같음 (`#41` 로 생김) |
| `POST /api/v1/recommendations` | 같음 (`#41` 로 생김) |
| — | `POST /internal/orchestrator/approve` (`#43`, 프론트가 승인에 쓰는 경로) |

**`createTeamBackend`** 를 `src/api/backend.ts` 에 실제 응답 모양(`ExecuteResult` · `Evidence`)에 맞춰 구현해 두었습니다. 테스트도 그 모양 그대로 넣어 검사합니다.

### 코드를 보고 스스로 풀린 것 두 가지

**`submit-and-run` 응답에 증거가 같이 옵니다.** 따로 조회할 필요가 없었습니다.

```java
public record ExecuteResult(boolean valid, JsonNode run, JsonNode evidence, ValidationResult validation) {}
```

- `valid: false` → 검증에서 막힌 것이고 **키오스크에는 아무것도 하지 않았습니다.** 컨트롤러 주석대로 "제출 → 검증 → (통과 시) 실행" 이라 실행 단계로 가지 않습니다. 앞서 물어본 "키오스크를 건드렸는지" 가 이 한 비트입니다.
- `valid: true` → `evidence.result`(PASS/FAIL) · `evidence.stopType`(SAFETY_STOP 등) · `evidence.executedActions` · `evidence.reviewSnapshot` 을 그대로 화면 값으로 옮깁니다.

장바구니 개수·금액은 `reviewSnapshot.cartItems` 와 `total` 에서 만듭니다(킷 `simulation-driver` 의 `reviewOf`). `cartItems` 가 없는 환경에서는 **비워 둡니다 — 지어내지 않습니다.**

### 새 경로에 맞춰 붙여 두었습니다 (2026-08-09)

`orchestrator/approve` 안내 문서 잘 받았습니다. 셋 다 반영했습니다.

**① BFF 허용경로 추가** — `internal/orchestrator/approve` · `api/v1/recommendation-output-validations` 를 열었습니다. (파일은 `api/bff.ts` 입니다. `[...path].ts` 로 두었더니 Vercel 에서 여러 단계 경로가 안 잡혀 옮겼습니다.)

**② 승인 경로 교체** — `submit()` 이 이제 `/internal/orchestrator/approve` 로 다섯 조각을 갖춰 보냅니다.

```text
sessionId · profile · sessionContext · recommendation · userDecision
```

`environmentId` 는 안 보냅니다 — 말씀하신 대로 서버가 `sessionId` 로 다시 조회하니까요.

**③ `recommendation` 확보** — `filterCandidates`·`recommend` 를 실제 경로에 붙였습니다. **문서에는 "STEP4/5가 아직 안 붙어 있어서 못 쓸 수 있다"고 하셨는데, `#41` 이 `#43` 보다 먼저 들어와서 이미 됩니다.**

### 한글 선택지 → enum 변환기를 만들었습니다

`src/api/canonical.ts` 하나에 모아 두었고, 값은 백엔드 enum 파일에서 그대로 옮겼습니다.

| 화면 | 보내는 값 |
| --- | --- |
| 먹고 가기 / 포장하기 | `DINE_IN` / `TAKE_OUT` |
| 순한맛 / 보통맛 / 매운맛 | `MILD` / `MEDIUM` / `HOT` |
| 뼈 / 순살 | `BONE` / `BONELESS` |
| 종이컵 / 일반컵 | `PAPER` / `REGULAR` |
| 1개 / 2개 / 3개 | `1` / `2` / `3` |
| 땅콩·대두·우유·계란·밀·새우 | `PEANUT`·`SOY`·`MILK`·`EGG`·`WHEAT`·`SHRIMP` |

**안 고른 축은 `NO_PREFERENCE`, 모르는 값은 `UNKNOWN`** 으로 구분해서 보냅니다. 둘을 뭉뚱그리면 화면에 새 선택지가 생겼을 때 서버가 "아무거나 괜찮대요" 로 읽습니다.

**모르는 알레르기도 버리지 않고 `UNKNOWN` 으로 보냅니다.** 조용히 버리면 그 사람의 알레르기가 서버에 전달되지 않습니다.

### `display` 문제는 풀렸습니다 — `candidate-filters` 에서 받습니다

`Recommendation` 에는 여전히 상품 ID 만 있지만, `candidate-filters` 응답의 `eligibleCandidates` 에 `name`·`price` 가 함께 오는 걸 확인했습니다. 거기서 이름·가격을 만듭니다. **실격 위험은 없어졌습니다.**

### 로컬에서 `dev` 로 끝까지 붙여 봤습니다 (2026-08-09)

운영 배포(`main`)에 컨트롤러가 아직 없어서, `dev` 를 로컬에서 돌려 붙였습니다.
**아래 일곱 요청이 모두 200 이고 화면이 실제 백엔드 데이터로 그려집니다.**

```text
POST /internal/simulation/session              200
POST /api/v1/profile-normalizations            200
POST /api/v1/session-context-normalizations    200
POST /api/v1/canonical-inputs/validate         200
POST /api/v1/candidate-filters                 200
POST /api/v1/recommendations                   200
POST /internal/orchestrator/approve            200
```

### `recommendationReady` 를 확인하고 넘어갑니다

개별 정규화는 프로필과 세션 맥락을 각자 반쪽만 봅니다. 합쳐야 보이는 게 있고,
**알레르기가 그렇습니다.**

```text
정상 입력           status=VALID                     recommendationReady=true
알레르기 UNKNOWN    status=RECONFIRMATION_REQUIRED   recommendationReady=false
  HARD_CONSTRAINT_UNKNOWN
  "allergenIds 가 UNKNOWN 입니다. 임의로 추론하지 말고 재확인하거나
   안전한 대체경로를 사용하세요."
```

프론트 변환기는 모르는 알레르기를 `UNKNOWN` 으로 보냅니다 — 조용히 버리면 그분의
알레르기가 서버에 전달되지 않아서요. 그래서 이 관문이 실제로 필요합니다.
**`recommendationReady` 가 false 면 후보 필터도 추천도 부르지 않습니다.**

확인 화면에 이렇게 나옵니다 — 전부 서버가 준 값입니다.

```text
매운 뼈 닭강정   5,500원
매운 순살 닭강정  6,000원
형태  순살  → 고르신 메뉴와 달라요
반영: 선호하신 이용 방식과 일치하는 메뉴라 우선 추천드립니다.
제외: [PEANUT] 알레르기와 겹쳐서 제외됐어요.
제외: 품절 닭강정은 지금 팔지 않아서 뺐어요
```

### 붙여 보고 찾은 것 — 백엔드 쪽 넷

**① 승인이 스키마에서 막힙니다.**

```text
/userDecision/note must be string
/executionPlan/actions/0/target/groupId must be string   (0·1·6·7·8·9)
```

`note` 는 프론트가 아예 안 보내도 같은 오류가 납니다. 서버가 `UserDecision` 을 다시 만들면서 `note: null` 을 실어 보내는 것 같습니다. `@JsonInclude(NON_NULL)` 이면 해결될 것 같습니다.

`groupId` 는 `buildExecutionPlan` 이 만드는 action 의 `target` 에 빠져 있습니다. **이 둘만 고쳐지면 실행까지 갑니다.**

**② 지금 팔지 않는 후보가 추천에 올라옵니다.**

```text
CHICKEN-008  품절 닭강정  available=false
→ eligibleCandidates 에 남아 있고 alternativeCandidateIds 에도 들어옵니다
```

심사 필수 기준이 **선택 불가능 후보 추천 0건** 입니다. 프론트에서도 한 번 더 거르고 있지만, 서버가 원천에서 빼 주시는 게 맞습니다.

**③ `explanation` 이 사람이 읽을 문장이 아닙니다.**

```text
explanation: "ruleId=CHICKEN_ALLERGEN_HARD_CONSTRAINT, sourceValue=[PEANUT], candidateValue=[PEANUT]"
reasonText : "[PEANUT] 알레르기와 겹쳐서 제외됐어요."
```

`reasonText` 를 쓰도록 고쳤습니다. 다만 그 문장에도 `[PEANUT]` 이 그대로 들어 있습니다. **어르신 화면에 나가는 글이라 "땅콩" 이면 더 좋겠습니다.**

**④ 형태(`boneType`)가 순위에 반영되지 않습니다.**

순살을 저장한 프로필인데 1순위가 '매운 뼈 닭강정' 이었습니다.

```text
scoreBreakdown: { priceScore, serviceTypeMatch, spicyLevelMatch }   ← boneTypeMatch 없음
```

### 프론트에서 고친 것

- `reasonText` 를 쓰도록 바꿨습니다. 규칙 추적 문자열이 화면에 나가지 않습니다.
- `available:false` 후보를 후보 목록과 추천 양쪽에서 뺍니다. 뺀 이유는 사용자에게 말해 줍니다.
- 같은 후보의 제외 사유가 후보 필터·추천 양쪽에서 와서 **두 번 보이던 것**을 합쳤습니다.
- `note: null` 을 안 보냅니다.

### `matchedOptions` 를 만들 수 있게 됐습니다

`candidate-filters` 응답에 후보별 값이 함께 오는 걸 확인했습니다.

```jsonc
"attributes": { "spicyLevel": "HOT", "boneType": "BONELESS", "allergenIds": [] },
"supportedOptions": { "SERVICE_TYPE": ["DINE_IN","TAKE_OUT"], "CUP": ["PAPER","REGULAR"] }
```

**사용자가 고른 값과 같은 어휘라 그대로 비교할 수 있습니다.** 이름 문자열로 짐작하는 게 아니라서 안전합니다. 이걸로 확인 카드의 조건별 판단을 채웠고, 위 화면의 "형태 순살 → 고르신 메뉴와 달라요" 가 그 결과입니다.

`Recommendation` 에 직접 넣어 주시면 그때 이 계산은 걷어내겠습니다.

### 아직 남은 것

**① 후보별 축 일치를 `Recommendation` 에 직접 넣어 주시면 좋겠습니다.**

지금은 프론트가 `candidate-filters` 의 `attributes`·`supportedOptions` 로 직접 계산해서 확인 카드를 채우고 있습니다.

```text
이용 방식  포장하기   그대로예요
맵기      매운맛     그대로예요
형태      뼈        오늘은 이 조합이 없어요
```

서버가 후보별로 어떤 축이 맞고 안 맞았는지 알려 주시면 **이 계산을 걷어냅니다.** 같은 판단을 두 곳에서 하면 언젠가 갈라지고, 그때 화면이 서버와 다른 말을 하게 됩니다.

**② `State` enum 이 닭강정집 전용입니다.**

```text
SERVICE_TYPE MENU_SELECTION OPTION_SELECTION OPTION_CONFIRM
MENU_SELECTION_WITH_CART CART_REVIEW STOP
```

새 요청 타입도 `ChickenStoreSessionContext` 로 못박혀 있어서 **병원·관공서·sandbox 는 아직 못 씁니다.** 심사 환경이 닭강정집이면 문제없지만 알고 계시면 좋겠습니다.

**③ `kioskName`·`expiresAt`** — 화면이 "OO분식 1번 키오스크 · 04:58" 을 보여 줍니다. 지금은 5분으로 가정합니다.

**④ `claimCode`** — 여전히 안 받으십니다. QR 로 어떤 기계를 찍었든 세션이 열립니다.

### 해결된 질문

**`environmentId`** — `CreateSessionResponse` 에 넣어 주셔서 받아 쓰고 있습니다. 이제 세션이 알려 준 값으로 카탈로그를 정합니다. 감사합니다.

**`evidence` 조회 경로** — 필요 없었습니다. `ExecuteResult` 에 같이 옵니다.

**"실패했을 때 키오스크를 건드렸는지"** — `valid` 가 그 한 비트였습니다.

### CORS 는 프론트에서 없앴습니다 — 설정하실 필요가 없습니다

`api/bff.ts` 를 두어 이 앱의 서버가 백엔드로 대신 보냅니다. 브라우저는 같은 출처(`/api/bff/...`)로만 요청하므로 **CORS 가 아예 발생하지 않습니다.**

원래 문제는 이랬습니다.

```yaml
cors:
  allowed-origin: ${CORS_ALLOWED_ORIGIN:http://localhost:5173}
```

한 곳만 적을 수 있는데 저희는 개발 서버(5199) · 배포 · 미리보기 셋이고, 미리보기 주소는 배포마다 바뀝니다. 셋을 동시에 만족시킬 방법이 없었습니다.

지금은 저희가 Vercel 환경변수에 주소만 넣으면 됩니다.

```text
KIOBRIDGE_API_BASE = https://<백엔드 주소>
```

열린 프록시가 되지 않게 통과시킬 **경로와 메서드(GET·POST)** 를 명시해 두었습니다. 새 엔드포인트가 생기면 그 목록에 추가해야 하니 알려 주세요.

## 백엔드가 맞춰 줘야 하는 것

`src/api/backend.ts` 의 `Backend` 인터페이스는 **명세서와 1:1** 입니다. 오른쪽 칸은 팀 백엔드가 지금 실제로 어떻게 되어 있는지입니다.

| 메서드 | 명세서 경로 | 팀 백엔드 (지금) |
| --- | --- | --- |
| `createSession` | `POST /api/v1/sessions` | `POST /internal/simulation/session` |
| `filterCandidates` | `POST /api/v1/candidate-filters` | 같음 (`#41`) |
| `recommend` | `POST /api/v1/recommendations` | 같음 (`#41`) |
| `submit` | `POST /api/v1/sessions/:id/submission` | `POST /internal/orchestrator/approve` (조립·제출·검증·실행 한 번에) |
| `validate` | `POST /api/v1/sessions/:id/validate` | 위 응답의 `valid` · `validation` |
| `execute` | `POST /api/v1/sessions/:id/execute` | 위 응답의 `evidence.runId` |
| `getEvidence` | `GET /internal/simulation/evidence/{id}` | 위 응답의 `evidence` — **따로 부르지 않습니다** |

명세서대로 새로 만드시면 `createHttpBackend` 가 왼쪽 칸을 그대로 부릅니다. 지금 구조를 유지하시면 `createTeamBackend` 가 오른쪽 칸에 맞춰 이미 돌아갑니다. **둘 중 아무거나 고르셔도 프론트는 준비돼 있습니다.**

### 계정 API 를 붙였습니다 — 그런데 인증이 없습니다

`modules/member` 의 네 경로에 붙였습니다(`src/api/account.ts`). 그런데 붙이면서 확인한 것 중에 **저희가 프론트에서 고칠 수 없는 것 세 가지**가 있어서 같은 무게로 적습니다.

| | 지금 | 왜 문제인지 |
| --- | --- | --- |
| **① 토큰이 없습니다** | 로그인 응답이 `{ userId, loginId }` 뿐 | 이후 주문표 요청이 `userId` 를 경로에 넣어 나갑니다. **인증이 아니라 식별입니다.** |
| **② 주문표 경로가 누구에게나 열려 있습니다** | `GET·POST /api/v1/users/{userId}/profiles` 에 인증 검사 없음 | `userId` 는 1부터 올라가는 숫자입니다. 숫자만 바꾸면 **남의 주문표를 읽고, 남의 계정에 새 주문표를 씁니다.** |
| **③ 로그인 시도 횟수 제한이 없습니다** | `POST /api/v1/auth/login` | 무차별 대입을 막는 것이 없습니다. |

**②가 가장 급합니다.** 저희 BFF(`api/bff.ts`)가 이 경로를 허용 목록에 열어 두어서, 브라우저에서 같은 출처로 바로 부를 수 있는 상태입니다. BFF 를 닫는다고 해결되지 않습니다 — 백엔드가 열려 있는 한 누구든 직접 부를 수 있고, BFF 를 닫으면 저희 화면만 못 쓰게 됩니다. **막는 자리는 서버입니다.**

그래서 지금은 이렇게 두고 있습니다.

- 이 앱이 저장하는 것은 **주문 조건뿐**입니다 — 장소·맵기·형태·컵·수량·알레르기·메모. 실명·전화번호·주소는 받지도 저장하지도 않습니다(심사 요건이기도 합니다). 새어 나가도 사람을 특정할 수 있는 값은 없습니다.
- 그래서 이 경로로 오가는 것은 **전부 합성 데이터**입니다. 프론트가 백엔드로 보내는 프로필의 `dataClassification` 은 값에 상관없이 항상 `SYNTHETIC_PROFILE` 이고(`src/api/canonical.ts`, 테스트로 잠가 두었습니다), 아이디도 사용자가 지어낸 문자열이지 실명이 아닙니다. **②가 풀리기 전까지는 이 기준이 유일한 방어선입니다** — 실제 개인정보를 받는 칸이 하나라도 생기면 그 순간 이 경로는 닫아야 합니다.
- 화면 어디에도 **"안전하게 보관됩니다" 라고 쓰지 않았습니다.** 개인정보 안내 화면에도 로그인 상태가 이 기기 메모리에만 있다는 사실만 적었습니다.
- 메모 칸 옆에 "이름·전화번호·주민등록번호는 적지 마세요" 를 그대로 두었습니다.

**세션 토큰(또는 `Authorization` 헤더)을 발급해 주시고, 주문표 경로에서 토큰의 주인과 `{userId}` 가 같은지 확인해 주세요.** 발급해 주시면 프론트는 `src/api/account.ts` 의 `부르기` 한 곳에 헤더를 붙이면 끝입니다. ①이 풀리면 ②도 같이 풀립니다.

### 삭제 경로가 필요합니다

화면의 '이 기기에서 정보 지우기' 는 `api.forgetAll()` 을 부릅니다. 지금 조립 계층은 자기가 들고 있는 세션만 비웁니다.

**서버에도 지우는 경로가 있어야 합니다.** 지금은 `POST /api/v1/users/{id}/profiles` 로 올린 주문표를 지울 방법이 없습니다. 화면에서 지워도 서버에는 남고, 다시 로그인하면 그대로 돌아옵니다. 그래서 그 화면의 문구를 "이 기기에 있는 내용이 사라지고 로그아웃돼요. 서버에 올라간 주문표는 남아 있어요" 로 고쳐 두었습니다 — 지운 척하지 않으려고요.

`DELETE /api/v1/users/{userId}/profiles/{profileId}` 와 계정 전체 삭제, 둘 다 있으면 좋겠습니다. 알려 주시면 `forgetAll` 에서 함께 부르겠습니다.

### `place` 가 `@NotBlank` 라 장소 없는 주문표를 못 올립니다

화면에서 장소는 **선택 항목**입니다. 어디서 쓸지 아직 안 정한 사람도 주문표를 저장할 수 있어야 해서요. 그런데 `SaveProfileRequest.place` 가 `@NotBlank` 라 그런 주문표는 400 입니다.

문제는 그 400 에 **`code` 도 `message` 도 없다**는 것입니다. `@Valid` 실패는 `GlobalExceptionHandler` 를 타지 않아서 스프링 기본 응답이 나갑니다. 사용자에게 무엇이 잘못됐는지 말해 줄 수가 없습니다.

지금은 프론트가 올리기 전에 걸러내고, 주문표 화면이 저장 전에 "장소를 정해 두시면 다음에 로그인해도 불러올 수 있어요" 라고 알려 줍니다. **`place` 를 선택 항목으로 완화해 주시거나**, 어렵다면 **`MethodArgumentNotValidException` 핸들러를 추가해 `code`·`message` 를 실어 주세요.** 후자는 다른 모든 `@Valid` 경로에도 도움이 됩니다.

### 타임아웃은 15초로 두었습니다

서버가 응답하지 않을 때 화면이 '연결 중' 에서 멈추면 사용자가 할 수 있는 게 없습니다. 두 경로 모두 15초에 끊습니다.

| 경로 | 끊는 곳 |
| --- | --- |
| `createTeamBackend()` → `/api/bff` | BFF 함수의 `AbortController` (`TIMEOUT` · 504) |
| `createHttpBackend("https://...")` | 이 함수의 `AbortController` (`TIMEOUT`) |

서버가 더 오래 걸리는 경로가 있으면 알려 주세요.

응답 모양은 같은 파일의 타입(`RecommendationResult`, `EvidenceSummary`)을 보시면 됩니다. **`src/api/backend.test.ts` 에 명세대로 응답하는 가짜 백엔드가 있으니 그걸 실제 응답 예시로 쓰셔도 됩니다.** 그 파일의 테스트가 조립이 맞는지 검사합니다.

### 응답에서 봐 주시면 좋은 곳

**① `evidence` 는 그대로 주셔도 됩니다.** 39개 필드 중 화면이 쓰는 건 `result` · `stopType` · `stopReason` · `executedActions` · `reviewSnapshot` 다섯입니다. 프론트에서 골라 쓰고 있으니 따로 요약해 주실 필요 없습니다.

**② `display` 에 사람이 읽는 값을 넣어 주세요.** 후보 표시 이름·가격입니다. 상품 ID 는 화면으로 나가면 안 되는데, 이름이 없으면 보여 줄 게 없습니다.

**③ `unmatchedLabelsByCandidate` 를 채워 주시면 좋습니다** (선택).

후보가 여러 개일 때(`clarification`) 화면은 사용자가 저장해 둔 조건표를 함께 보여 줍니다. 어떤 후보를 고르느냐에 따라 **어긋나는 축이 달라집니다** — 형태를 '순살' 로 저장한 사람이 '매운 뼈 닭강정' 을 고르면 형태가 안 맞습니다.

`matchedOptions` 는 1순위 하나에 대한 답이라 이 자리에 쓸 수 없습니다. 그대로 쓰면 대안을 고른 사용자에게 "형태: 순살, 그대로예요" 라고 말하게 됩니다.

```jsonc
"unmatchedLabelsByCandidate": {
  "CHICKEN-001": [],           // 다 맞음
  "CHICKEN-003": ["형태"]       // 형태만 어긋남
}
```

**안 주셔도 됩니다.** 없으면 화면이 후보별 불일치를 아예 표시하지 않습니다. 짐작하지 않는 쪽을 기본으로 두었습니다 — 예전에 후보 이름 문자열로 추측했더니, 온도가 `ICE` 인 '아이스 아메리카노' 를 고른 사용자에게 이름에 `ICE` 가 없다는 이유로 "달라요" 라고 말한 적이 있습니다.

### 카탈로그는 키오스크가 정합니다 — 목은 반대로 되어 있습니다

목(`src/api/mock.ts`)은 붙일 서버가 없어서 **프로필의 `place`** 로 후보 목록을 고릅니다(음식점 → 닭강정, 카페 → 커피). 실제로는 **QR 로 연결한 키오스크(`environmentId`)** 가 정합니다.

지금 `createApi(backend, environmentId = "chicken-store")` 로 고정되어 있습니다. 페어링 응답(`createSession`)이 그 세션의 `environmentId` 를 돌려주면 거기서 받아 쓰도록 바꾸겠습니다. **`createSession` 응답에 `environmentId` 를 넣어 주실 수 있는지 알려 주세요.**

### `approve` 는 검증에 실패하면 실행하지 않습니다

조립 계층은 `submit` → `validate` → `execute` 순서로 부르고, **검증에 실패하면 실행하지 않고** 사유를 화면까지 올립니다(`VALIDATION_FAILED`). 테스트로 순서와 이 동작을 잠가 두었습니다.

팀 백엔드에 붙일 때는 `submit-and-run` 한 번으로 셋이 끝나므로, `ExecuteResult.valid` 와 `validation.errors` 를 그 세 단계에 나눠 읽습니다. 백엔드가 이미 "통과 시에만 실행" 이라서 순서가 그대로 지켜집니다.

`validation.errors[].message` 에 넣어 주신 문장이 사용자에게 그대로 보입니다.

## 2. 질문 목록이 겹칩니다 — 조율이 필요합니다

```text
GET /api/v1/environments/{environmentId}/input-options
    "프론트 입력 폼에 필요한 공식 enum 기반 선택지 반환"    담당: Chahyunwoo
```

프론트는 지금 `src/domain/catalog.tsx` 에 하드코딩하고 있습니다. **이 API 가 대신할 자리입니다.**

다만 값은 이미 시뮬레이션 킷 fixture 의 `option-groups.json` 축에 맞춰 두었으므로, 교체해도 화면 모양은 같습니다.

| 장소 | 프론트 현재 질문 | fixture 축 |
| --- | --- | --- |
| 음식점 | 이용 방식 · 맵기 · 형태 · 컵 · 수량 · 알레르기 | `SERVICE_TYPE` · `SPICY_LEVEL` · `BONE_TYPE` · `CUP` · `QUANTITY` |
| 병원 | 방문 유형 · 예약 여부 · 진료과 · 접근성 지원 | `VISIT_TYPE` · `APPOINTMENT` · `DEPARTMENT` · `SUPPORT` |
| 관공서 | 민원 분야 · 인증 방식 | `CATEGORY` · `AUTH_METHOD` |

**카페는 공식 fixture 가 없습니다.** 프론트에는 화면이 있지만 대응하는 환경이 없어 값을 맞추지 못했습니다. `input-options` 가 카페를 다루는지 알려 주세요.

**알레르기는 fixture 의 option-group 이 아닙니다.** 사람에 대한 절대 조건이라 별도로 받고 있고, `candidate-filters` 의 `severity=BLOCK` 제약으로 넘길 값입니다.

## 3. 프론트가 이미 지키고 있는 것

연동할 때 깨지지 않도록 알아 두시면 좋겠습니다.

- **승인 전 실행계획 생성 0건** — `approve()` 호출은 버튼 핸들러 안에만 있습니다. 매핑 조회는 계획을 만들지 않습니다.
- **결제 관련 문자열 0건** — 저장소 전체를 훑는 테스트로 잠가 두었습니다. 금지된 결제 액션 문자열이 코드에 존재만 해도 실패합니다. (이 문서에도 그 문자열을 그대로 적지 않습니다.)
- **상품 ID 미보유** — 후보 식별자는 `c1`·`c2`·`c3` 형태의 불투명 값만 씁니다. 테스트로 형식을 강제합니다.
- **선택 불가능 후보 추천 0건** — 알레르기·품절·이용 불가는 순위를 깎는 게 아니라 후보에서 제거합니다.
- **신뢰도 낮을 때 재확인** — `low_confidence` 는 사용자가 직접 짚어야 승인 버튼이 열리고, 목 서버도 `CONFIRMATION_REQUIRED` 로 다시 검사합니다.

응답이 이 규칙을 깨면 화면이 실격 조건을 어기게 됩니다. 특히 **`candidateId` 자리에 키오스크 상품 ID 를 넣지 말아 주세요.**

### 후보 식별자를 서버가 들고 계시면 좋겠습니다

P0-1 은 **상품 ID 를 앱이 다루거나 저장하지 말라**고 합니다. 화면은 지금 `c1`·`c2`·`c3` 과 사람이 읽는 값만 받습니다 — 응답 전체를 훑는 테스트로 잠가 두었습니다.

다만 조립 계층(`src/api/backend.ts`)은 승인할 때 "사용자가 고른 그 후보" 를 서버에 되돌려 줘야 해서, 매핑과 승인 사이에 서버가 준 후보 식별자를 잠깐 들고 있습니다. **이 계층도 브라우저에서 돕니다.** 지금 API 가 후보를 식별자로만 받기 때문에 생기는 잔여물입니다.

**서버가 세션 안에서 후보를 기억하고 표식을 직접 발급해 주시면 이게 사라집니다.**

```jsonc
// recommendations 응답
"candidates": [
  { "token": "c1", "displayName": "매운 순살 닭강정", "priceText": "6,000원" },
  { "token": "c2", "displayName": "매운 뼈 닭강정",  "priceText": "5,500원" }
]
// 승인 때는 token 만 돌려보냅니다. 서버가 그걸 실제 후보로 되돌립니다.
```

이렇게 되면 상품 ID 가 브라우저에 한 번도 오지 않습니다. 어려우면 알려 주세요 — 지금 구조로도 화면까지는 새지 않게 막아 두었습니다.

## 4. 확인 화면에 필요한 필드

`recommendations` 응답에서 아래가 있어야 확인 화면이 완성됩니다. (MVP 요건 P0-4)

- 실제 상품명 · 가격
- 사용자가 고른 조건이 반영됐는지 여부 (항목별 matched)
- **추천 이유** — 무엇을 써서 골랐는지, 무엇을 왜 뺐는지. "AI가 추천했습니다" 는 설명이 아닙니다
- 확신도 · `requiresReconfirmation`

프론트의 `MappingResponse.reasons` 가 이 자리입니다. `used` / `excluded` 두 종류로 받습니다.
