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
