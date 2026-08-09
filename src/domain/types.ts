export type Screen =
  | "welcome" | "phone" | "otp" | "name" | "greeting" | "profile" | "saved"
  | "order-confirm" | "execution"
  | "a11y"      // 접근성 설정
  | "privacy";  // 무엇을 저장하고 무엇을 저장하지 않는지
export type MainTab = "qr" | "menu" | "account";
export type PlaceType = "카페" | "음식점" | "병원" | "관공서" | null;
export type PairingState = "connecting" | "connected" | "failed" | "expired";
export type MappingState = "exact" | "clarification" | "not_found" | "changed" | "low_confidence";
export type StepStatus = "done" | "active" | "waiting" | "failed";

// P0-1: 프로필은 의미값(사람이 읽는 텍스트)만 담는다. 상품 ID·화면 좌표 금지.
export interface ProfileData {
  id: string;
  menuName: string;
  place: PlaceType;
  selections: Record<string, string[]>;
  memo: string;
}

export interface DetailOption {
  label: string;
  multi: boolean;
  choices: string[];
  /**
   * 다중 선택 안에서 혼자만 골라야 하는 값. 예: '시럽 없음'.
   * '바닐라'와 '시럽 없음'을 같이 고를 수 있으면 앱이 무엇을 주문해야 할지 알 수 없고,
   * 사용자도 자기가 무엇을 시켰는지 알 수 없다.
   */
  exclusive?: string[];
}

// ─── API 계약 (키오브릿지_API_계약_초안_v0.1.md) ────────────────────────────────

export interface MappedOption {
  label: string;
  value: string;
  matched: boolean;
  note?: string;
}

// P0-4: 확인 카드는 실제 상품명·포장·매운맛·종이컵·가격이 모두 있어야 한다.
//
// imageUrl 은 키오스크가 오늘 걸어 둔 메뉴 사진이다. 앱이 이름을 보고 짐작하는 게 아니라
// 매핑 응답에 실려 온 것만 쓴다. 사진이 없으면 안 보여 준다 — 틀린 사진을 보여 주느니
// 아예 없는 게 낫다. 프로필(ProfileData)에는 이 값을 저장하지 않으므로 P0-1(의미값만)은 그대로다.
export interface MappedItem {
  displayName: string;
  priceText: string;
  options: MappedOption[];
  imageUrl?: string;
}

export interface MappingCandidate {
  candidateId: string;
  displayName: string;
  priceText: string;
  imageUrl?: string;
  /**
   * 이 후보를 고르면 어긋나는 축의 이름들. 예: ["형태"].
   *
   * 화면이 후보 이름을 뜯어보고 짐작하지 않도록 응답이 알려 준다.
   * '아이스 아메리카노' 는 온도가 ICE 인데 이름 어디에도 'ICE' 가 없어서,
   * 이름으로 판단하면 정확히 맞는 후보를 "달라요" 라고 말하게 된다.
   *
   * 모르면 비워 둔다. 비어 있으면 화면은 아무것도 표시하지 않는다 —
   * 모른다는 것과 다 맞았다는 것은 다르지만, 지어내는 것보다 조용한 편이 낫다.
   */
  unmatchedLabels?: string[];
}

// 왜 이 메뉴를 골랐는지 사용자의 말로 적은 문장들.
// 심사 규칙상 최소 1개가 있어야 하고, "AI가 추천했습니다" 같은 문장은 설명이 아니다.
// 어떤 사용자 정보를 썼는지, 무엇을 왜 뺐는지가 드러나야 한다.
export type RecommendationReason =
  | { kind: "used"; text: string }      // 이 정보를 써서 골랐다
  | { kind: "excluded"; text: string }; // 이 조건 때문에 뺐다

export interface MappingResponse {
  result: MappingState;
  item?: MappedItem;
  candidates?: MappingCandidate[];
  reason?: string;
  message?: string;
  diffNote?: string;
  /** 추천 이유. 확인 화면에 그대로 보여 준다. */
  reasons?: RecommendationReason[];
  /**
   * 사용자가 저장해 둔 조건. clarification 처럼 상품이 아직 정해지지 않은 상태에서
   * 조건만 보여 줄 때 쓴다. item 에 빈 displayName 을 넣어 실어 보내면
   * 타입이 거짓말을 하게 되고, 누가 item.displayName 을 그리면 빈칸이 뜬다.
   */
  profileOptions?: MappedOption[];
}

// P0-7: 최종 상태는 cart_ready뿐. completed/paid 상태는 존재하지 않는다.
export interface CartResult {
  itemCountText: string;
  totalText: string;
  evidenceLabel: string;
  handoff: string;
}

// P0-2: QR은 단명 claim 세션만 만든다. 개인정보·영구 실행 권한을 담지 않는다.
export interface PairingResult {
  pairingId: string;
  kioskName: string;
  expiresAt: number;
}

// 승인 화면마다 사용자가 확인하는 것이 다르다. 그 사실을 여기에 실어 보낸다.
// 서버가 승인 조건을 다시 볼 수 있어야 하므로 화면 안에만 남겨 두지 않는다.
/**
 * 승인하지 않겠다는 결정.
 *
 * 화면은 확인 카드의 모든 갈래에서 이걸 누를 수 있어야 한다. 무엇을 담을지
 * 보여 준 뒤에 되돌릴 방법이 없으면, 승인은 형식일 뿐이다.
 */
export interface RejectInput {
  pairingId: string;
  profileId: string;
  /** 왜 거절했는지. 화면이 묻지 않으면 비워 둔다 — 지어내지 않는다. */
  note?: string;
}

export interface ApproveInput {
  pairingId: string;
  profileId: string;
  mappingResult: MappingState;
  /** clarification: 여러 후보 중 사용자가 고른 것 */
  candidateId?: string;
  /** changed: 달라진 내용을 확인했다고 사용자가 표시한 것 */
  acknowledgedDiff?: boolean;
  /** low_confidence: 이 메뉴가 맞다고 사용자가 직접 짚은 것 */
  confirmedLowConfidence?: boolean;
}

export interface PlanCreated {
  planId: string;
}

export interface AbortInfo {
  code: string;
  title: string;
  message: string;
  userAction: string;
  recoverable: false;
}

export type PlanState = "running" | "cart_ready" | "aborted";

export interface PlanStatus {
  state: PlanState;
  steps: StepStatus[];
  cart?: CartResult;
  abort?: AbortInfo;
}
