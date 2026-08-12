/**
 * 이번 이용의 가격 한도.
 *
 * 킷 계약의 `hardConstraints.maxPriceKrw` 로 나간다. 오래 붙들고 있을 값이 아니라
 * "오늘은 얼마까지" 라서 이번 이용에만 둔다(api/session.ts 가 새로고침 너머로만 잇는다).
 *
 * ── 이건 점수가 아니라 거르는 조건이다 ───────────────────────────────────────
 *
 * 서버에서 확인한 것: 한도를 넘는 후보는 순위가 밀리는 게 아니라 **후보에서 빠진다.**
 *
 *   POST /api/v1/candidate-filters  { hardConstraints: { maxPriceKrw: 5000 } }
 *   -> eligibleCandidates: []
 *      excludedCandidates: [{ reasonCode: "PRICE_LIMIT_EXCEEDED",
 *                             reasonText: "설정하신 가격 한도를 넘어서 제외됐어요." }, ...]
 *
 * 그래서 화면이 "이 금액보다 비싼 메뉴는 빼고 찾아요" 라고 먼저 말해야 한다.
 * 순위만 바뀌는 줄 알고 낮게 잡으면 담을 게 하나도 없다는 답을 받는다.
 *
 * ── 왜 넣었나 ────────────────────────────────────────────────────────────────
 *
 * 지금까지 이 값을 늘 null 로 보내서 서버의 가격 점수가 죽어 있었다. 같은 주문표로
 * 재 본 결과다.
 *
 *   한도 없음     priceScore 0.0      confidence 0.5   대안 2개
 *   한도 5,800원  priceScore 0.0259   confidence 0.8   대안 0개
 *
 * 백엔드는 받을 준비가 돼 있었고(SessionContextNormalizationRequest.ContextInput
 * .maxPriceKrw, RecommendationEngineService.scorePrice) 화면이 안 물었을 뿐이다.
 */

/*
 * 예전에는 [6000, 8000, 10000] 셋 중에 고르게 했다. 지금은 사용자가 직접 적는다 —
 * 1,951원처럼 자기 사정에 맞는 값이 있는 사람에게 셋 중 하나는 남의 금액이다.
 */

/** null 이면 한도를 안 정한 것이다. 그때는 이 값을 아예 안 보낸다. */
let 값: number | null = null;
const 듣는이 = new Set<() => void>();

/** 계약이 `minimum: 0` 인 number 다. 음수·0·정수 아님·NaN 은 받지 않는다. */
const 쓸수있나 = (원: number | null): boolean =>
  원 === null || (Number.isInteger(원) && 원 > 0);

export const 가격한도 = {
  읽기: (): number | null => 값,
  /** 못 쓰는 값이면 조용히 무시한다 — 화면이 고를 수 있는 값만 내밀기 때문이다. */
  바꾸기(원: number | null): void {
    if (!쓸수있나(원)) return;
    값 = 원;
    for (const f of 듣는이) f();
  },
  비우기(): void {
    값 = null;
    for (const f of 듣는이) f();
  },
  /**
   * 저장해 둔 값으로 되돌린다. **듣는이에게 알리지 않는다.**
   * 화면이 첫 그림을 그리기 전에 한 번만 부른다 — a11y.ts 의 되살리기 와 같은 이유다.
   */
  되살리기(원: number | null): void {
    값 = 쓸수있나(원) ? 원 : null;
  },
  구독(f: () => void): () => void {
    듣는이.add(f);
    return () => { 듣는이.delete(f); };
  },
};
