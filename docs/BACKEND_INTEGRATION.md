# 프론트엔드 ↔ 백엔드 연동 메모

**연동 코드는 이미 다 짜여 있습니다.** 백엔드는 `Backend` 인터페이스 하나만 채우면 되고, 화면 코드는 한 줄도 바뀌지 않습니다.

## 붙이는 방법 — 한 줄입니다

```ts
// src/api/client.ts 마지막 줄
- export const api: KioBridgeApi = mockApi;
+ export const api = createApi(createHttpBackend("https://<서버주소>"));
```

`createHttpBackend` 는 `src/api/backend.ts` 에 있고, 명세서의 경로를 그대로 `fetch` 합니다. 서버 주소만 넣으면 됩니다.

## 백엔드가 맞춰 줘야 하는 것

`src/api/backend.ts` 의 `Backend` 인터페이스가 명세서와 1:1 입니다.

| 메서드 | 경로 |
| --- | --- |
| `createSession` | `POST /api/v1/sessions` |
| `filterCandidates` | `POST /api/v1/candidate-filters` |
| `recommend` | `POST /api/v1/recommendations` |
| `submit` | `POST /api/v1/sessions/:id/submission` |
| `validate` | `POST /api/v1/sessions/:id/validate` |
| `execute` | `POST /api/v1/sessions/:id/execute` |
| `getEvidence` | `GET /internal/simulation/evidence/{sessionId}` |

### 삭제 경로가 필요합니다

화면의 '이 기기에서 정보 지우기' 는 `api.forgetAll()` 을 부릅니다. 지금 조립 계층은 자기가 들고 있는 세션만 비웁니다.

**서버에도 지우는 경로가 있어야 합니다.** 사용자가 저장한 프로필·세션을 서버가 들고 있다면, 명세에 삭제 엔드포인트를 하나 추가해 주세요. 알려 주시면 `createApi` 의 `forgetAll` 에서 함께 부르겠습니다. 없으면 "모두 지워요" 라는 화면의 약속이 절반만 사실이 됩니다.

### 타임아웃은 15초로 두었습니다

`createHttpBackend` 가 `AbortController` 로 15초에 끊고 `TIMEOUT` 코드를 올립니다. 서버가 더 오래 걸리는 경로가 있으면 알려 주세요.

응답 모양은 같은 파일의 타입(`RecommendationResult`, `EvidenceSummary`)을 보시면 됩니다. **`src/api/backend.test.ts` 에 명세대로 응답하는 가짜 백엔드가 있으니 그걸 실제 응답 예시로 쓰셔도 됩니다.** 테스트 12개가 조립이 맞는지 검사합니다.

### 두 곳만 봐 주시면 됩니다

**① `evidence` 는 요약해서 주세요.** 39개 필드를 화면이 다 알 필요는 없습니다. `EvidenceSummary` 는 `state`(running/cart_ready/aborted) · `reachedStep` · `cart` · `abort` 넷뿐입니다. `EvidenceSummaryService` 가 이 모양으로 내려 주면 됩니다.

**② `display` 에 사람이 읽는 값을 넣어 주세요.** 후보 표시 이름·가격입니다. 상품 ID 는 화면으로 나가면 안 되는데, 이름이 없으면 보여 줄 게 없습니다.

### `approve` 는 3단계라는 걸 화면도 압니다

`submit` → `validate` → `execute` 순서로 부르고, **검증에 실패하면 실행하지 않고** 사유를 화면까지 올립니다(`VALIDATION_FAILED`). 테스트로 순서와 이 동작을 잠가 두었습니다.

`validate` 응답에 `errors[0]` 를 넣어 주시면 그 문장이 사용자에게 그대로 보입니다.

## 2. 질문 목록이 겹칩니다 — 조율이 필요합니다

```
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
- **결제 관련 문자열 0건** — `src` 전체를 훑는 테스트로 잠가 두었습니다. `select_payment` 등이 코드에 존재만 해도 실패합니다.
- **상품 ID 미보유** — 후보 식별자는 `c1`·`c2`·`c3` 형태의 불투명 값만 씁니다. 테스트로 형식을 강제합니다.
- **선택 불가능 후보 추천 0건** — 알레르기·품절·이용 불가는 순위를 깎는 게 아니라 후보에서 제거합니다.
- **신뢰도 낮을 때 재확인** — `low_confidence` 는 사용자가 직접 짚어야 승인 버튼이 열리고, 목 서버도 `CONFIRMATION_REQUIRED` 로 다시 검사합니다.

응답이 이 규칙을 깨면 화면이 실격 조건을 어기게 됩니다. 특히 **`candidateId` 자리에 키오스크 상품 ID 를 넣지 말아 주세요.**

## 4. 확인 화면에 필요한 필드

`recommendations` 응답에서 아래가 있어야 확인 화면이 완성됩니다. (MVP 요건 P0-4)

- 실제 상품명 · 가격
- 사용자가 고른 조건이 반영됐는지 여부 (항목별 matched)
- **추천 이유** — 무엇을 써서 골랐는지, 무엇을 왜 뺐는지. "AI가 추천했습니다" 는 설명이 아닙니다
- 확신도 · `requiresReconfirmation`

프론트의 `MappingResponse.reasons` 가 이 자리입니다. `used` / `excluded` 두 종류로 받습니다.
