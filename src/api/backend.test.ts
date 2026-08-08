import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi, createTeamBackend, type Backend, type EvidenceSummary, type RecommendationResult } from "./backend";

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

  it("보여 줄 수 있는 후보가 하나도 없으면 clarification 을 만들지 않는다", async () => {
    // display 가 비면 이름 없는 후보라 걸러진다. 다 걸러지고도 clarification 을
    // 내보내면 화면은 "비슷한 메뉴가 여러 개예요" 라고 말하면서 고를 것을 하나도
    // 못 보여 준다. 승인은 후보 선택을 요구하는데 고를 방법이 없으니 갇힌다.
    const r = await 매핑(가짜백엔드({}, 기본추천({
      alternativeCandidateIds: ["CHICKEN-003"],
      requiresReconfirmation: true,
      display: {},
    })));
    expect(r.result).toBe("not_found");
    expect(r.candidates).toBeUndefined();
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

describe("후보별 불일치는 서버가 알려 준 것만 쓴다", () => {
  const 애매 = (over = {}) => 기본추천({
    alternativeCandidateIds: ["CHICKEN-003"], requiresReconfirmation: true, ...over,
  });

  it("서버가 알려 주면 표식 순서에 맞춰 실어 준다", async () => {
    const r = await 매핑(가짜백엔드({}, 애매({
      unmatchedLabelsByCandidate: { "CHICKEN-003": ["형태"] },
    })));
    expect(r.candidates?.find((c) => c.candidateId === "c1")?.unmatchedLabels).toBeUndefined();
    expect(r.candidates?.find((c) => c.candidateId === "c2")?.unmatchedLabels).toEqual(["형태"]);
    // 상품 ID 는 여전히 새어 나가지 않는다.
    expect(JSON.stringify(r.candidates)).not.toContain("CHICKEN-");
  });

  it("서버가 안 알려 주면 비워 둔다 — 짐작하지 않는다", async () => {
    // matchedOptions 는 1순위 하나에 대한 답이라 대안 후보에는 쓸 수 없다.
    // 그걸 돌려 쓰면 '매운 뼈' 를 고른 사람에게 "형태: 순살, 그대로예요" 라고 말하게 된다.
    const r = await 매핑(가짜백엔드({}, 애매({
      matchedOptions: [{ label: "형태", value: "순살", matched: false, note: "없어요" }],
    })));
    for (const c of r.candidates ?? []) {
      expect(c.unmatchedLabels).toBeUndefined();
    }
    // 저장한 조건은 그대로 보여 준다. 서버가 준 matched 도 그대로 쓴다.
    // 예전에는 전부 true 로 덮었는데, 그러면 안 맞는 축이 있다는 사실이
    // 어느 후보를 고르든 사라진다.
    expect(r.profileOptions?.map((o) => o.label)).toEqual(["형태"]);
    expect(r.profileOptions?.[0].matched).toBe(false);
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

  it("우리가 주지 않은 표식은 거절한다", async () => {
    // 예전에는 숫자로 바꾸기만 해서 c99 는 undefined 를 제출하고
    // cabc·c0 는 조용히 1순위로 되돌아갔다. 고르지 않은 메뉴가 담긴다.
    const submit = vi.fn(async () => {});
    const b = 가짜백엔드({ submit }, 기본추천({ alternativeCandidateIds: ["CHICKEN-003"], requiresReconfirmation: true }));
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    for (const 가짜 of ["c99", "cabc", "c0"]) {
      await expect(
        api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "clarification", candidateId: 가짜 }),
      ).rejects.toThrow();
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it("어떤 결과 종류에서도 상품 ID 가 응답 전체에 섞이지 않는다", async () => {
    // 후보 목록만 보면 부족하다. reasons·item·profileOptions·message 어디로든
    // 새어 나갈 수 있다. 응답 전체를 문자열로 만들어 잠근다.
    //
    // 상품 ID 는 서버가 정하는 값이라 CHICKEN- 만 막으면 다음 환경에서 뚫린다.
    // 가짜 백엔드가 쓰는 모든 후보 ID 를 그대로 금지어로 쓴다.
    const 후보ID = ["CHICKEN-001", "CHICKEN-003", "CHICKEN-005"];
    const 경우 = [
      기본추천(),
      기본추천({ alternativeCandidateIds: ["CHICKEN-003"], requiresReconfirmation: true }),
      기본추천({ confidence: 0.4 }),
      기본추천({ matchedOptions: [{ label: "컵", value: "종이컵", matched: false }] }),
      기본추천({ recommendedCandidateId: null }),
    ];
    for (const rec of 경우) {
      const r = await 매핑(가짜백엔드({}, rec));
      const s = JSON.stringify(r);
      for (const id of 후보ID) expect(s).not.toContain(id);
    }
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

describe("판정 순서", () => {
  it("확신이 낮아도 못 맞춘 조건이 있으면 그걸 먼저 알린다", async () => {
    // low_confidence 가 changed 를 가리면, 확신 낮고 조건도 못 맞춘 경우에
    // 무엇을 못 맞췄는지가 화면에서 사라진다.
    const b = 가짜백엔드({}, 기본추천({
      confidence: 0.4,
      matchedOptions: [{ label: "컵", value: "종이컵", matched: false, note: "오늘은 제공되지 않아요" }],
    }));
    const api = createApi(b);
    await api.claimPairing("kb");
    const r = await api.requestMapping("s1", "p1");
    expect(r.result).toBe("changed");
    expect(r.item?.options[0].matched).toBe(false);
  });
});

describe("forgetAll", () => {
  it("세션을 비워서 이전 매핑으로 승인할 수 없게 한다", async () => {
    // 세션 Map 은 비우는 경로가 없으면 무한히 자라기도 한다.
    const api = createApi(가짜백엔드());
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");

    await api.forgetAll();

    await expect(
      api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
  });
});

describe("changed 는 확인 표시를 받아야 넘어간다", () => {
  it("확인 표시가 없으면 실행하지 않는다", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const b = 가짜백엔드({ execute }, 기본추천({
      matchedOptions: [{ label: "컵", value: "종이컵", matched: false }],
    }));
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await expect(
      api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "changed" }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("같은 세션에서 두 번 실행하지 않는다", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const api = createApi(가짜백엔드({ execute }));
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" });
    await expect(
      api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("동시에 들어온 승인 두 건 중 하나만 실행된다", async () => {
    // 위 테스트는 순차 호출만 본다. 검사와 확정 사이에 await 를 끼워 넣어도
    // 통과한다. 예전에 실제로 그랬고, 사용자는 한 번 승인하고 두 개를 받았다.
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const api = createApi(가짜백엔드({
      execute,
      // 두 호출이 겹치도록 첫 await 를 늘린다.
      submit: async () => { await new Promise((r) => setTimeout(r, 10)); },
    }));
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    const 요청 = { pairingId: "s1", profileId: "p1", mappingResult: "exact" as const };
    const 결과 = await Promise.allSettled([api.approve(요청), api.approve(요청)]);
    expect(결과.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("후보를 고르는 화면이 아닌데 candidateId 가 오면 거절한다", async () => {
    // client.ts 는 이미 막는데 이 계층만 열려 있으면, 붙이는 구현을 바꾸는
    // 것만으로 사용자가 고른 적 없는 메뉴가 담긴다.
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const api = createApi(가짜백엔드({ execute }));
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");   // exact 로 답한다
    await expect(
      api.approve({ pairingId: "s1", profileId: "p1", mappingResult: "exact", candidateId: "c2" }),
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

// ─── 팀 백엔드 어댑터 ─────────────────────────────────────────────────────────
//
// 위 테스트들은 "명세대로 주면 도는가" 를 본다. 아래는 팀 백엔드가 실제로
// 돌려주는 모양(ExecutionPlanController · ExecuteResult · Evidence)을 그대로 넣고
// 화면이 아는 값으로 옮겨지는지 본다. 명세와 구현이 달라서 둘 다 필요하다.

const 원래fetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = 원래fetch; });

const 응답 = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body }) as Response;

/** 실제 백엔드가 돌려주는 submit-and-run 응답. */
const 실행성공 = {
  valid: true,
  validation: { valid: true, errors: [] },
  evidence: {
    runId: "run_77",
    result: "PASS",
    stopType: "NORMAL_BOUNDARY_STOP",
    executedActions: [{}, {}, {}, {}, {}],
    reviewSnapshot: {
      "주문 방식": "포장하기",
      cartItems: [{ name: "매운 순살 닭강정", price: 6000, quantity: 2 }],
      total: 12000,
    },
  },
};

describe("팀 백엔드가 실제로 주는 모양을 화면 값으로 옮긴다", () => {
  const 붙이기 = (응답들: unknown[]) => {
    let i = 0;
    globalThis.fetch = vi.fn(async () => 응답(응답들[Math.min(i++, 응답들.length - 1)])) as typeof fetch;
    return createTeamBackend("/api/bff");
  };

  it("submit-and-run 한 번으로 검증·실행·증거를 모두 채운다", async () => {
    const b = 붙이기([실행성공]);
    await b.submit("s1", {});
    expect(await b.validate("s1")).toEqual({ valid: true });
    expect(await b.execute("s1")).toEqual({ planId: "run_77" });

    const e = await b.getEvidence("s1");
    expect(e.state).toBe("cart_ready");
    expect(e.reachedStep).toBe(5);
    // 개수와 금액은 reviewSnapshot 에서 온다. 고정값을 쓰면 승인 화면과 어긋난다.
    expect(e.cart?.itemCountText).toBe("2개");
    expect(e.cart?.totalText).toBe("12,000원");
  });

  it("증거를 따로 조회하지 않는다 — 요청은 한 번뿐이다", async () => {
    const b = 붙이기([실행성공]);
    await b.submit("s1", {});
    await b.validate("s1");
    await b.execute("s1");
    await b.getEvidence("s1");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("검증에서 막히면 실행하지 않았다는 사실이 그대로 올라온다", async () => {
    // valid:false 는 백엔드가 실행 단계로 가지 않았다는 뜻이다.
    // 사용자에게 "다시 해 보세요" 라고 말할 수 있는 근거가 이것뿐이다.
    const b = 붙이기([{
      valid: false,
      validation: { valid: false, errors: [{ path: "$.plan[0]", code: "BAD", message: "담을 수 없는 메뉴예요" }] },
    }]);
    await b.submit("s1", {});
    expect(await b.validate("s1")).toEqual({ valid: false, errors: ["담을 수 없는 메뉴예요"] });
    // 실행이 없었으므로 증거도 없다. 진행 중으로 두고 아무것도 지어내지 않는다.
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("running");
    expect(e.cart).toBeUndefined();
  });

  it("안전 중단만 중단 화면으로 보낸다", async () => {
    const b = 붙이기([{
      valid: true,
      evidence: {
        runId: "run_9", result: "FAIL", stopType: "SAFETY_STOP",
        stopReason: "예상하지 못한 화면이 나왔어요", executedActions: [{}, {}],
      },
    }]);
    await b.submit("s1", {});
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("aborted");
    expect(e.reachedStep).toBe(2);
    expect(e.abort?.message).toBe("예상하지 못한 화면이 나왔어요");
  });

  it("그냥 실패는 중단 화면으로 보내지 않는다", async () => {
    // SAFETY_STOP 이 아닌 FAIL 은 "직원을 불러 주세요" 를 띄울 근거가 아니다.
    const b = 붙이기([{ valid: true, evidence: { result: "FAIL", stopType: "NONE", executedActions: [] } }]);
    await b.submit("s1", {});
    expect((await b.getEvidence("s1")).state).toBe("running");
  });

  it("cartItems 가 없는 환경에서는 개수·금액을 지어내지 않는다", async () => {
    // 닭강정집 말고는 reviewSnapshot 이 라벨-값 쌍만 준다.
    const b = 붙이기([{
      valid: true,
      evidence: { result: "PASS", executedActions: [{}], reviewSnapshot: { "접수 번호": "A-12" } },
    }]);
    await b.submit("s1", {});
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("cart_ready");
    expect(e.cart).toBeUndefined();
  });

  it("QR 로 읽은 claimCode 를 세션 요청에 함께 보낸다", async () => {
    const b = 붙이기([{ sessionId: "sess_1", initialState: "IDLE", submissionEndpoint: "/x" }]);
    await b.createSession({ environmentId: "chicken-store", claimCode: "kb_demo" });
    const [, init] = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({ environmentId: "chicken-store", claimCode: "kb_demo" });
  });
});
