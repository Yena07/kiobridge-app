import { describe, expect, it, vi } from "vitest";
import { createApi, type Backend, type EvidenceSummary, type RecommendationResult } from "./backend";

// 백엔드가 아직 없으므로, 명세서대로 응답하는 가짜를 만들어 조립이 맞는지 본다.
// 이 테스트가 통과한다는 건 "백엔드가 명세대로 주면 화면이 돈다" 는 뜻이다.

const 후보표시 = {
  "CHICKEN-001": { displayName: "매운 순살 닭강정", priceText: "6,000원" },
  "CHICKEN-003": { displayName: "매운 뼈 닭강정", priceText: "5,500원" },
};

const 기본추천 = (over: Partial<RecommendationResult> = {}): RecommendationResult => ({
  recommendedCandidateId: "CHICKEN-001",
  alternativeCandidateIds: [],
  excludedCandidates: [],
  recommendationReasons: ["포장하기를 고르셔서 포장이 되는 메뉴만 남겼어요"],
  confidence: 0.95,
  requiresReconfirmation: false,
  display: 후보표시,
  matchedOptions: [{ label: "맵기", value: "매운맛", matched: true }],
  ...over,
});

function 가짜백엔드(over: Partial<Backend> = {}, rec = 기본추천()): Backend {
  return {
    createSession: async () => ({ sessionId: "s1", kioskName: "OO분식 1번", expiresAt: Date.now() + 60000 }),
    filterCandidates: async () => ({
      survivingCandidateIds: ["CHICKEN-001", "CHICKEN-003"],
      excluded: [{ candidateId: "CHICKEN-005", reasonCode: "ALLERGEN_CONFLICT", explanation: "땅콩 알레르기를 알려주셔서 땅콩 토핑 닭강정은 뺐어요" }],
    }),
    recommend: async () => rec,
    submit: async () => {},
    validate: async () => ({ valid: true }),
    execute: async () => ({ planId: "pln_1" }),
    getEvidence: async (): Promise<EvidenceSummary> => ({ state: "cart_ready", reachedStep: 5, cart: { itemCountText: "1개", totalText: "6,000원", evidenceLabel: "화면 인식으로 확인됨", handoff: "장바구니를 확인해 주세요" } }),
    ...over,
  };
}

const 매핑 = async (b: Backend) => {
  const api = createApi(b);
  await api.claimPairing("kb");
  return api.requestMapping("s1", "p1");
};

describe("후보 필터와 추천을 합쳐 한 응답으로 만든다", () => {
  it("제외 사유가 두 곳에서 모두 올라온다", async () => {
    const r = await 매핑(가짜백엔드());
    const 문구 = (r.reasons ?? []).map((x) => x.text).join("\n");
    expect(문구).toContain("포장하기를 고르셔서");        // recommendations
    expect(문구).toContain("땅콩 알레르기를 알려주셔서");   // candidate-filters
  });

  it("추천이 없으면 not_found 다", async () => {
    const r = await 매핑(가짜백엔드({}, 기본추천({ recommendedCandidateId: null })));
    expect(r.result).toBe("not_found");
  });

  it("확신도가 낮으면 재확인을 요구한다", async () => {
    // 심사 필수 기준: 신뢰도 낮을 때 사용자 재확인 수행.
    const r = await 매핑(가짜백엔드({}, 기본추천({ confidence: 0.4 })));
    expect(r.result).toBe("low_confidence");
  });

  it("못 맞춘 옵션이 있으면 changed 로 알린다", async () => {
    const r = await 매핑(가짜백엔드({}, 기본추천({
      matchedOptions: [{ label: "컵", value: "종이컵", matched: false, note: "오늘은 제공되지 않아요" }],
    })));
    expect(r.result).toBe("changed");
    expect(r.item?.options[0].matched).toBe(false);
  });
});

describe("상품 ID 를 화면으로 내보내지 않는다", () => {
  it("후보 표식은 c1·c2 형태다", async () => {
    const r = await 매핑(가짜백엔드({}, 기본추천({
      alternativeCandidateIds: ["CHICKEN-003"], requiresReconfirmation: true,
    })));
    expect(r.result).toBe("clarification");
    expect(r.candidates?.map((c) => c.candidateId)).toEqual(["c1", "c2"]);
    expect(JSON.stringify(r.candidates)).not.toContain("CHICKEN-");
  });

  it("사용자가 고른 표식을 서버가 아는 후보로 되돌려 보낸다", async () => {
    const submit = vi.fn(async () => {});
    const b = 가짜백엔드({ submit }, 기본추천({ alternativeCandidateIds: ["CHICKEN-003"], requiresReconfirmation: true }));
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "clarification", candidateId: "c2" });
    expect(submit).toHaveBeenCalledWith("s1", expect.objectContaining({ candidateId: "CHICKEN-003" }));
  });
});

describe("승인은 제출 → 검증 → 실행 순서를 지킨다", () => {
  it("세 단계가 이 순서로 불린다", async () => {
    const 순서: string[] = [];
    const b = 가짜백엔드({
      submit: async () => { 순서.push("submit"); },
      validate: async () => { 순서.push("validate"); return { valid: true }; },
      execute: async () => { 순서.push("execute"); return { planId: "pln_1" }; },
    });
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" });
    expect(순서).toEqual(["submit", "validate", "execute"]);
  });

  it("검증에 실패하면 실행하지 않고 사유를 올린다", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const b = 가짜백엔드({ validate: async () => ({ valid: false, errors: ["결제 action 이 포함되어 있어요"] }), execute });
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await expect(
      api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow("결제 action");
    expect(execute).not.toHaveBeenCalled();
  });

  it("매핑 전에는 승인할 수 없다 (P0-4)", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const api = createApi(가짜백엔드({ execute }));
    await expect(
      api.approve({ pairingId: "안한세션", profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("확신이 낮은데 직접 짚지 않으면 실행하지 않는다", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const b = 가짜백엔드({ execute }, 기본추천({ confidence: 0.4 }));
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await expect(
      api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "low_confidence" }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("evidence 를 화면이 아는 상태로 옮긴다", () => {
  it("cart_ready 는 모든 단계를 done 으로 만든다", async () => {
    const api = createApi(가짜백엔드());
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    const { planId } = await api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" });
    const s = await api.getPlanStatus(planId);
    expect(s.state).toBe("cart_ready");
    expect(s.steps.every((x) => x === "done")).toBe(true);
    expect(s.cart?.totalText).toBe("6,000원");
  });

  it("aborted 는 멈춘 단계를 failed 로 표시한다", async () => {
    const b = 가짜백엔드({
      getEvidence: async () => ({ state: "aborted", reachedStep: 2, abort: { code: "UNKNOWN_SCREEN", title: "안전을 위해 중단되었습니다", message: "예상하지 못한 화면", userAction: "직원을 불러 주세요" } }),
    });
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    const { planId } = await api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" });
    const s = await api.getPlanStatus(planId);
    expect(s.state).toBe("aborted");
    expect(s.steps[2]).toBe("failed");
    expect(s.abort?.recoverable).toBe(false);
  });
});
