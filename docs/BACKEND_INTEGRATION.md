# 프론트엔드 ↔ 백엔드 연동 메모

팀 API 명세서를 프론트엔드 코드와 대조한 결과입니다. **연동 전에 맞춰야 할 것**을 정리했습니다.

## 1. 프론트가 가정한 계약이 명세와 다릅니다

화면은 `src/api/client.ts` 의 `KioBridgeApi` 네 개만 알고 있습니다.

| 프론트 함수 | 실제 호출해야 하는 경로 |
| --- | --- |
| `claimPairing(claimCode)` | `POST /api/v1/sessions` |
| `requestMapping(pairingId, profileId)` | `POST /api/v1/candidate-filters` → `POST /api/v1/recommendations` |
| `approve(input)` | `POST /sessions/:id/submission` → `/validate` → `/execute` |
| `getPlanStatus(planId)` | `GET /internal/simulation/evidence/{sessionId}` |

**화면 코드는 안 바꿔도 됩니다.** `client.ts` 의 `export const api = mockApi` 를 실제 구현으로 바꾸면서, 그 구현 안에서 위 호출들을 조립하면 됩니다.

### 특히 `approve` 를 주의해야 합니다

프론트는 승인을 **한 번의 호출**로 가정했는데, 실제로는 **제출 → 검증 → 실행 3단계**입니다.

- `submission` 은 "검증 X, 저장만"
- `validate` 를 통과한 계획만 `execute` 됩니다

중간 단계에서 실패할 수 있으므로, 구현할 때 **어느 단계에서 멈췄는지 구분해서** 화면에 넘겨 주세요. 지금 프론트는 `KioBridgeError.code` 로 구분합니다.

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
