import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi, createTeamBackend, type Backend, type EvidenceSummary, type RecommendationResult } from "./backend";
import { KioBridgeError, getSheet, registerSheet } from "./client";
import type { OrderSheet } from "@/domain/types";

// 백엔드가 아직 없으므로, 명세서대로 응답하는 가짜를 만들어 조립이 맞는지 본다.
// 이 테스트가 통과한다는 건 "백엔드가 명세대로 주면 화면이 돈다" 는 뜻이다.

const 후보표시 = {
  "CHICKEN-001": { displayName: "매운 순살 닭강정", priceText: "6,000원" },
  "CHICKEN-003": { displayName: "매운 뼈 닭강정", priceText: "5,500원" },
};

const 기본추천 = (over: Partial<RecommendationResult> = {}): RecommendationResult => ({
  unmetConditions: [],
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
  it("맞추지 못한 조건을 버리지 않는다", async () => {
    /*
     * 서버가 "선호하신 뼈/순살과 다릅니다" 라고 알려 주는데 타입에 선언만 해
     * 두고 화면까지 오지 않았다. 못 맞춘 것을 감추면 사용자는 자기가 고른
     * 조건이 다 반영된 줄 알고 승인한다.
     */
    const r = await 매핑(가짜백엔드({}, 기본추천({
      unmetConditions: ["선호하신 뼈/순살과 다릅니다."],
    })));
    const 못맞춘 = (r.reasons ?? []).filter((x) => x.kind === "unmet");
    expect(못맞춘.map((x) => x.text)).toEqual(["선호하신 뼈/순살과 다릅니다."]);
    // 제외와 섞이면 안 된다. 저건 '메뉴를 뺐다' 이고 이건 '조건을 못 맞췄다' 다.
    expect((r.reasons ?? []).filter((x) => x.kind === "excluded").map((x) => x.text))
      .not.toContain("선호하신 뼈/순살과 다릅니다.");
  });

  it("맞추지 못한 조건에도 결제 표현 거르기를 건다", async () => {
    // 서버가 준 문장이라 validationMessages 와 같은 종류다. 한쪽만 막으면 안 된다.
    const 돈내기 = "결" + "제";
    const r = await 매핑(가짜백엔드({}, 기본추천({
      unmetConditions: [`${돈내기} 수단이 맞지 않습니다.`, "선호하신 맵기와 다릅니다."],
    })));
    expect((r.reasons ?? []).filter((x) => x.kind === "unmet").map((x) => x.text))
      .toEqual(["선호하신 맵기와 다릅니다."]);
  });

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
    expect(r.sheetOptions?.map((o) => o.label)).toEqual(["형태"]);
    expect(r.sheetOptions?.[0].matched).toBe(false);
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
        api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "clarification", candidateId: 가짜 }),
      ).rejects.toThrow();
    }
    expect(submit).not.toHaveBeenCalled();
  });

  it("어떤 결과 종류에서도 상품 ID 가 응답 전체에 섞이지 않는다", async () => {
    // 후보 목록만 보면 부족하다. reasons·item·sheetOptions·message 어디로든
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
    await api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "clarification", candidateId: "c2" });
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
    await api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" });
    expect(순서).toEqual(["submit", "validate", "execute"]);
  });

  it("검증에 실패하면 실행하지 않고 사유를 올린다", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const b = 가짜백엔드({ validate: async () => ({ valid: false, errors: ["결제 action 이 포함되어 있어요"] }), execute });
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await expect(
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow("결제 action");
    expect(execute).not.toHaveBeenCalled();
  });

  it("사유가 여러 줄이면 전부 화면까지 올라간다", async () => {
    // Error 는 message 한 칸뿐이라 예전에는 첫 줄만 닿고 나머지가 사라졌다.
    // 하나를 고쳐도 또 막히는데 왜 막히는지 끝까지 알 수 없었다.
    const 사유 = ["필수 정보가 빠졌습니다.", "선택하신 값이 지원되지 않는 옵션입니다."];
    const b = 가짜백엔드({ validate: async () => ({ valid: false, errors: 사유 }) });
    const api = createApi(b);
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    const e = await api
      .approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" })
      .then(() => null, (err: KioBridgeError) => err);
    expect(e?.message).toBe(사유[0]);
    expect(e?.details).toEqual(사유);
  });

  it("매핑 전에는 승인할 수 없다 (P0-4)", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const api = createApi(가짜백엔드({ execute }));
    await expect(
      api.approve({ pairingId: "안한세션", sheetId: "p1", mappingResult: "exact" }),
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
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "low_confidence" }),
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
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
  });

  it("화면이 등록해 둔 주문표 사본까지 지운다", async () => {
    // 목(mockApi)은 이미 지우고 있었고 이 경로만 빠져 있었다. 남으면 '모두
    // 지워요' 가 사실이 아니다 — 이름·고른 조건·메모가 그대로 들어 있다.
    const api = createApi(가짜백엔드());
    registerSheet({ id: "p9", menuName: "닭강정", place: "음식점", selections: {}, memo: "" });
    expect(getSheet("p9")).toBeDefined();

    await api.forgetAll();

    expect(getSheet("p9")).toBeUndefined();
  });

  it("거절까지 갔던 세션도 지워진다", async () => {
    /*
     * 예전에는 reject 가 세션을 지웠다. 그러면 forgetAll 이 세션 목록으로
     * 지울 대상을 찾을 때 이 페어링이 이미 없어서, 붙인 구현이 들고 있던
     * 정규화된 주문표(고른 알레르기·맵기 전부)가 그대로 남았다.
     */
    const forgetSession = vi.fn(async () => {});
    const api = createApi(가짜백엔드({ forgetSession }));
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await api.reject!({ pairingId: "s1", sheetId: "p1" });

    await api.forgetAll();

    // toHaveBeenCalled() 로는 부족하다. forgetAll 은 세션이 하나도 없어도
    // forgetSession("") 을 한 번 부르므로, reject 가 다시 세션을 지우도록
    // 되돌아가도 그 단언은 통과한다. 거절한 그 페어링으로 불렸는지를 본다.
    expect(forgetSession).toHaveBeenCalledWith("s1");
  });

  it("거절한 세션으로는 다시 승인할 수 없다", async () => {
    // 아니라고 한 것을 뒤에서 되살리지 않는다.
    const api = createApi(가짜백엔드());
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await api.reject!({ pairingId: "s1", sheetId: "p1" });

    await expect(
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" }),
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
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "changed" }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("같은 세션에서 두 번 실행하지 않는다", async () => {
    const execute = vi.fn(async () => ({ planId: "pln_1" }));
    const api = createApi(가짜백엔드({ execute }));
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    await api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" });
    await expect(
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" }),
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
    const 요청 = { pairingId: "s1", sheetId: "p1", mappingResult: "exact" as const };
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
      api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact", candidateId: "c2" }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("evidence 를 화면이 아는 상태로 옮긴다", () => {
  it("cart_ready 는 모든 단계를 done 으로 만든다", async () => {
    const api = createApi(가짜백엔드());
    await api.claimPairing("kb");
    await api.requestMapping("s1", "p1");
    const { planId } = await api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" });
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
    const { planId } = await api.approve({ pairingId: "s1", sheetId: "p1", mappingResult: "exact" });
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

/** 화면이 들고 있는 주문표. 승인 때 내용을 그대로 함께 보낸다. */
const 목주문표: OrderSheet = {
  id: "p1", menuName: "닭강정", place: "음식점", memo: "",
  selections: { "이용 방식": ["포장하기"], "맵기": ["매운맛"], "형태": ["순살"], "수량": ["2개"] },
};

/** POST /api/v1/recommendations 응답. 승인 요청에 그대로 되돌려 준다. */
const 목추천 = {
  recommendedCandidateId: "CHICKEN-001",
  alternativeCandidateIds: [],
  excludedCandidates: [],
  recommendationReasons: ["매운맛 선호와 일치해요."],
  confidence: 0.9,
  requiresReconfirmation: false,
};

/** 서버가 정규화해서 돌려주는 값. 이걸 그대로 다음 호출에 쓴다. */
const 정규화응답 = {
  주문표: {
    status: "VALID",
    profile: {
      profileId: "p1", dataClassification: "SYNTHETIC_PROFILE",
      // providerId 는 서버 설정에서 온다. 프론트가 짐작하지 않는다.
      source: { collectionChannel: "WEB_FORM", providerId: "WHATTHEBUG", collectedAt: "2026-08-01T05:30:00Z" },
      accessibility: {}, interaction: {}, consent: {},
    },
    contractValidation: { valid: true, errors: [] },
  },
  맥락: {
    status: "VALID",
    sessionContext: {
      intent: { task: "ORDER_FOOD" },
      preferences: { serviceType: "TAKE_OUT", spicyLevel: "HOT", boneType: "BONELESS", quantity: 2 },
      hardConstraints: { allergenIds: [] },
    },
    reconfirmationFields: [],
    contractValidation: { valid: true, errors: [] },
  },
  // 담당1의 마지막 관문. 주문표와 맥락을 합쳐 놓고 다시 본다.
  통합: { status: "VALID", recommendationReady: true, contractValidation: { valid: true, errors: [] } },
};

/** 경로를 보고 답한다. 순서에 기대면 정규화가 끼는 순간 전부 어긋난다. */
const 경로별응답 = (over: Record<string, unknown> = {}) => (url: string, body: Record<string, unknown>) => {
  for (const [조각, 값] of Object.entries(over)) if (url.includes(조각)) return 값;
  if (url.includes("profile-normalizations")) return 정규화응답.주문표;
  if (url.includes("session-context-normalizations")) return 정규화응답.맥락;
  if (url.includes("canonical-inputs/validate")) return 정규화응답.통합;
  if (url.includes("candidate-filters")) return { eligibleCandidates: [], excludedCandidates: [] };
  if (url.includes("recommendations")) return 목추천;
  if (body.userDecision) return 실행성공;
  return {};
};

describe("팀 백엔드가 실제로 주는 모양을 화면 값으로 옮긴다", () => {
  const 붙이기 = (over: Record<string, unknown> = {}) => {
    const 답 = 경로별응답(over);
    globalThis.fetch = vi.fn(async (u: unknown, init?: RequestInit) =>
      응답(답(String(u), JSON.parse(String(init?.body ?? "{}"))))) as unknown as typeof fetch;
    return createTeamBackend("/api/bff");
  };

  /** 승인 전에 매핑을 한 번 거친다. 실제 흐름과 같은 순서다. */
  const 승인 = async (
    b: ReturnType<typeof createTeamBackend>,
    실행응답: unknown,
    /** 주문표를 바꿔 넣고 싶을 때. 실행 단계의 '아는 값' 이 여기서 나온다. */
    주문표: OrderSheet = 목주문표,
  ) => {
    const 답 = 경로별응답({ "orchestrator/approve": 실행응답 });
    globalThis.fetch = vi.fn(async (u: unknown, init?: RequestInit) =>
      응답(답(String(u), JSON.parse(String(init?.body ?? "{}"))))) as unknown as typeof fetch;
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 주문표 });
    await b.submit("s1", { pairingId: "s1", sheetId: "p1", mappingResult: "exact", profile: 주문표 });
  };

  it("submit-and-run 한 번으로 검증·실행·증거를 모두 채운다", async () => {
    const b = 붙이기();
    await 승인(b, 실행성공);
    expect(await b.validate("s1")).toEqual({ valid: true });
    expect(await b.execute("s1")).toEqual({ planId: "run_77" });

    const e = await b.getEvidence("s1");
    expect(e.state).toBe("cart_ready");
    expect(e.reachedStep).toBe(5);
    // 개수와 금액은 reviewSnapshot 에서 온다. 고정값을 쓰면 승인 화면과 어긋난다.
    expect(e.cart?.itemCountText).toBe("2개");
    expect(e.cart?.totalText).toBe("12,000원");
  });

  it("서버 요약(#48)이 오면 결과 화면에 실어 준다", async () => {
    // 승인 응답이 { valid, summary, raw } 로 감싸여 오는 경우다.
    // raw 안에 예전 모양이 그대로 있다.
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      summary: { status: "정상 완료", recommendation: "선호하신 맵기와 맞는 메뉴라 우선 추천드립니다." },
      raw: 실행성공,
    });
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("cart_ready");
    // status 는 "정상 완료" 같은 개발자 말투라 화면에 올리지 않는다.
    expect(e.note).toBe("선호하신 맵기와 맞는 메뉴라 우선 추천드립니다.");
    // raw 안의 값도 그대로 읽힌다.
    expect(e.cart?.totalText).toBe("12,000원");
  });

  it("요약이 없으면 그 줄을 만들지 않는다", async () => {
    // #48 전 응답이거나 서버가 요약을 못 만든 경우다. 지어내지 않는다.
    const b = 붙이기();
    await 승인(b, 실행성공);
    expect((await b.getEvidence("s1")).note).toBeUndefined();
  });

  it("증거를 따로 조회하지 않는다 — 요청은 한 번뿐이다", async () => {
    const b = 붙이기();
    await 승인(b, 실행성공);
    const 승인후 = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await b.validate("s1");
    await b.execute("s1");
    await b.getEvidence("s1");
    // 정규화 2번 + 통합 검증 1번 + 추천 1번 + 승인 1번.
    // 증거를 따로 조회하지 않으므로 그 뒤로는 늘지 않는다.
    expect(승인후).toBe(5);
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(5);
  });

  it("검증에서 막히면 실행하지 않았다는 사실이 그대로 올라온다", async () => {
    // valid:false 는 백엔드가 실행 단계로 가지 않았다는 뜻이다.
    // 사용자에게 "다시 해 보세요" 라고 말할 수 있는 근거가 이것뿐이다.
    const b = 붙이기();
    await 승인(b, {
      valid: false,
      validation: { valid: false, errors: [{ path: "$.plan[0]", code: "BAD", message: "담을 수 없는 메뉴예요" }] },
    });
    expect(await b.validate("s1")).toEqual({ valid: false, errors: ["담을 수 없는 메뉴예요"] });
    // 실행이 없었으므로 증거도 없다. 진행 중으로 두고 아무것도 지어내지 않는다.
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("running");
    expect(e.cart).toBeUndefined();
  });

  it("실행 단계를 사람이 읽는 줄로 옮긴다 (#71)", async () => {
    // 서버가 준 순서 그대로, 고른 값은 값 그대로, 화면 코드는 동작으로 옮긴다.
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      raw: 실행성공,
      runSteps: [
        { actionIndex: 0, action: "select_service", label: "포장하기", success: true },
        { actionIndex: 1, action: "select_option", label: "매운맛", success: true },
        { actionIndex: 2, action: "select_option", label: "순살", success: true },
        { actionIndex: 3, action: "confirm_option", label: "OPTION_CONFIRM", success: true },
        { actionIndex: 4, action: "open_cart_review", label: "CART_REVIEW", success: true },
        { actionIndex: 5, action: "verify_cart", label: "CART_REVIEW", success: true },
      ],
    });
    const e = await b.getEvidence("s1");
    expect(e.한일?.map((x) => x.text)).toEqual([
      "포장하기 골랐어요",
      "매운맛 골랐어요",
      "순살 골랐어요",
      "옵션을 확정했어요",
      "장바구니를 열었어요",
      "장바구니를 확인했어요",
    ]);
    // 화면 코드가 그대로 새면 안 된다. 사용자에게는 뜻 없는 대문자다.
    expect(JSON.stringify(e.한일)).not.toContain("OPTION_CONFIRM");
    expect(JSON.stringify(e.한일)).not.toContain("CART_REVIEW");
  });

  it("confirm_option 두 번을 같은 문장으로 두지 않는다", async () => {
    // 옵션 확정과 장바구니로 넘기기가 같은 action 으로 온다. action 만 보면
    // 같은 줄이 나란히 서서 앱이 헛돈 것처럼 읽힌다. 킷이 label 로 구분해 준다.
    const b = 붙이기();
    await 승인(b, {
      valid: true, raw: 실행성공,
      runSteps: [
        { actionIndex: 0, action: "confirm_option", label: "OPTION_CONFIRM", success: true },
        { actionIndex: 1, action: "confirm_option", label: "MENU_SELECTION_WITH_CART", success: true },
      ],
    });
    expect((await b.getEvidence("s1")).한일?.map((x) => x.text)).toEqual([
      "옵션을 확정했어요",
      "메뉴를 장바구니로 넘겼어요",
    ]);
  });

  it("순서가 뒤섞여 와도 actionIndex 대로 세운다", async () => {
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      raw: 실행성공,
      runSteps: [
        { actionIndex: 2, action: "verify_cart", label: "CART_REVIEW", success: false },
        { actionIndex: 0, action: "select_option", label: "2개", success: true },
        { actionIndex: 1, action: "confirm_option", label: "OPTION_CONFIRM", success: true },
      ],
    });
    const e = await b.getEvidence("s1");
    expect(e.한일).toEqual([
      { text: "2개 골랐어요", ok: true },
      { text: "옵션을 확정했어요", ok: true },
      { text: "장바구니를 확인했어요", ok: false },
    ]);
  });

  it("모르는 동작이면 지어내지 않는다", async () => {
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      raw: 실행성공,
      runSteps: [
        { actionIndex: 0, action: "scroll_menu", label: "SOME_SCREEN", success: true },
        { actionIndex: 1, action: "scroll_menu", label: "매운맛", success: true },
      ],
    });
    const e = await b.getEvidence("s1");
    // 코드 label 이면 무슨 일이 있었는지 말하지 않는다. 사람 말이면 그것만 보여 준다.
    expect(e.한일?.map((x) => x.text)).toEqual(["한 단계 진행했어요", "매운맛"]);
  });

  it("대문자여도 사용자가 고른 값이면 그대로 보여 준다", async () => {
    /*
     * 모양(대문자)으로 코드인지 가리면 ICE 같은 진짜 고른 값이 뭉개진다.
     * 모양이 아니라 **주문표에 있는 값인지**로 가른다.
     */
    const b = 붙이기();
    await 승인(b, {
      valid: true, raw: 실행성공,
      runSteps: [
        { actionIndex: 0, action: "select_option", label: "매운맛", success: true },
        { actionIndex: 1, action: "select_service", label: "포장하기", success: true },
      ],
    }, { ...목주문표, selections: { ...목주문표.selections, "온도": ["ICE"] } });
    expect((await b.getEvidence("s1")).한일?.map((x) => x.text)).toEqual([
      "매운맛 골랐어요",
      "포장하기 골랐어요",
    ]);
  });

  it("모르는 값은 담지도 보여 주지도 않는다", async () => {
    /*
     * label 은 검증되지 않은 서버 입력이다. 그대로 통과시키면 서버가 무엇을
     * 넣든 결과 화면과 메모리에 남는다 - 상품 ID · 화면 좌표 · 결제 문구까지.
     * 우리가 아는 값(주문표에 고른 값 · 후보 이름)이 아니면 값을 지운다.
     */
    const b = 붙이기();
    await 승인(b, {
      valid: true, raw: 실행성공,
      runSteps: [
        { actionIndex: 0, action: "select_menu", label: "CHICKEN-001", success: true },
        { actionIndex: 1, action: "select_option", label: "x=120,y=340", success: true },
        { actionIndex: 2, action: "select_option", label: "서버가 보낸 모르는 값", success: true },
        { actionIndex: 3, action: "unexpected_action", label: "서버가 보낸 모르는 값", success: true },
      ],
    });
    const e = await b.getEvidence("s1");
    const 통째로 = JSON.stringify(e.한일);
    for (const 새면안되는것 of ["CHICKEN-001", "x=120", "340", "모르는 값"]) {
      expect(통째로).not.toContain(새면안되는것);
    }
    // 무슨 일이 있었는지는 동작으로만 말한다. 지어내지 않는다.
    expect(e.한일?.map((x) => x.text)).toEqual([
      "하나 골랐어요", "하나 골랐어요", "하나 골랐어요", "한 단계 진행했어요",
    ]);
  });

  it("고르지 않은 대안 후보 이름은 '골랐어요' 가 되지 않는다", async () => {
    /*
     * 흰 목록에 후보 전체를 넣으면, 서버가 대안 후보 이름을 보낼 때 사용자가
     * 고른 적 없는 메뉴를 골랐다고 말하게 된다. 담기로 한 하나만 넣는다.
     */
    const b = 붙이기({ "candidate-filters": {
      eligibleCandidates: [
        { candidateId: "CHICKEN-001", name: "매운 순살 닭강정", price: 6000, available: true },
        { candidateId: "CHICKEN-003", name: "매운 뼈 닭강정", price: 5500, available: true },
      ],
      excludedCandidates: [],
    } });
    await 승인(b, {
      valid: true, raw: 실행성공,
      runSteps: [{ actionIndex: 0, action: "select_menu", label: "매운 뼈 닭강정", success: true }],
    });
    // 서버 1순위는 CHICKEN-001 이다. 대안(매운 뼈)의 이름은 통과하면 안 된다.
    expect((await b.getEvidence("s1")).한일?.[0].text).toBe("하나 골랐어요");
  });

  it("고른 값 자리에는 아는화면 표를 끼워 넣지 않는다", async () => {
    // 표에 있는 말이라도 고른 값 자리면 고른 값이 이긴다. 메뉴 이름이 우연히
    // 표의 열쇠와 같아도 그 메뉴를 골랐다는 사실을 덮으면 안 된다.
    const b = 붙이기();
    await 승인(b, {
      valid: true, raw: 실행성공,
      runSteps: [{ actionIndex: 0, action: "select_option", label: "OPTION_CONFIRM", success: true }],
    }, { ...목주문표, selections: { ...목주문표.selections, "확인": ["OPTION_CONFIRM"] } });
    expect((await b.getEvidence("s1")).한일?.[0].text).toBe("OPTION_CONFIRM 골랐어요");
  });

  it("#71 이전 응답이면 이 줄을 아예 만들지 않는다", async () => {
    const b = 붙이기();
    await 승인(b, { valid: true, raw: 실행성공 });
    expect((await b.getEvidence("s1")).한일).toBeUndefined();
  });

  it("두 번째 승인에 앞 승인의 단계가 남지 않는다", async () => {
    const b = 붙이기();
    await 승인(b, {
      valid: true, raw: 실행성공,
      runSteps: [{ actionIndex: 0, action: "select_option", label: "종이컵", success: true }],
    });
    expect((await b.getEvidence("s1")).한일).toHaveLength(1);
    await 승인(b, { valid: true, raw: 실행성공 });
    expect((await b.getEvidence("s1")).한일).toBeUndefined();
  });

  it("서버가 옮겨 준 문장이 있으면 그것만 쓴다 (#66)", async () => {
    // 예전 경로(validation.errors)는 킷이 개발자에게 하는 말이다. 둘 다 오면
    // 옮긴 문장 옆에 원문이 그대로 붙어 버린다. 옮긴 쪽만 남긴다.
    const b = 붙이기();
    await 승인(b, {
      valid: false,
      validationMessages: ["필수 정보가 빠졌습니다.", "선택하신 값이 지원되지 않는 옵션입니다."],
      raw: {
        valid: false,
        validation: {
          valid: false,
          errors: [{ path: "$.executionPlan[0]", code: "REQUIRED_FIELD_MISSING", message: "must have required property 'actionType'" }],
        },
      },
    });
    expect(await b.validate("s1")).toEqual({
      valid: false,
      errors: ["필수 정보가 빠졌습니다.", "선택하신 값이 지원되지 않는 옵션입니다."],
    });
  });

  it("#66 이전 응답이면 예전 경로로 물러난다", async () => {
    // 배포된 백엔드가 아직 낡았을 수 있다. 필드가 없다고 이유를 못 보여 주면 안 된다.
    const b = 붙이기();
    await 승인(b, {
      valid: false,
      validation: { valid: false, errors: [{ code: "BAD", message: "담을 수 없는 메뉴예요" }] },
    });
    expect(await b.validate("s1")).toEqual({ valid: false, errors: ["담을 수 없는 메뉴예요"] });
  });

  it("성공하면 빈 배열이 와도 아무 일도 없다", async () => {
    // 서버는 성공할 때 validationMessages 를 List.of() 로 보낸다.
    // 있고 없고로 실패를 판단하면 안 된다.
    const b = 붙이기();
    await 승인(b, { valid: true, validationMessages: [], raw: 실행성공 });
    expect(await b.validate("s1")).toEqual({ valid: true });
  });

  it("결제 표현이 섞여 오면 그 줄은 보여 주지 않는다", async () => {
    // 결제 표현은 화면에 있기만 해도 실격이다. 서버 표에 한 줄이 늘어도
    // 그게 곧바로 화면에 뜨지 않도록 막는다.
    const b = 붙이기();
    await 승인(b, {
      valid: false,
      validationMessages: ["결제수단을 먼저 선택해 주세요.", "필수 정보가 빠졌습니다."],
    });
    expect(await b.validate("s1")).toEqual({ valid: false, errors: ["필수 정보가 빠졌습니다."] });
  });

  it("두 번째 승인이 빈 배열로 오면 앞 실패의 문장이 남지 않는다", async () => {
    /*
     * 검증에 막히면 approve() 가 s.executed 를 되돌려서 같은 세션으로 다시
     * 승인할 수 있다. 앞 문장을 안 지우면 사용자는 이번에 막힌 이유가 아니라
     * 아까 막혔던 이유를 읽는다.
     */
    const b = 붙이기();
    await 승인(b, { valid: false, validationMessages: ["필수 정보가 빠졌습니다."] });
    expect(await b.validate("s1")).toEqual({ valid: false, errors: ["필수 정보가 빠졌습니다."] });

    await 승인(b, { valid: false, validationMessages: [] });
    expect(await b.validate("s1")).toEqual({ valid: false });
  });

  it("빈 배열이 오면 개발자용 원문으로 물러나지 않는다", async () => {
    // 서버가 "이번엔 옮길 문장이 없다" 고 한 것이지, 옮겨 주지 않는 서버가 아니다.
    // 길이로 판단하면 이 둘이 같아져서 킷 원문이 화면에 뜬다.
    const b = 붙이기();
    await 승인(b, {
      valid: false,
      validationMessages: [],
      raw: {
        valid: false,
        validation: { valid: false, errors: [{ code: "SCHEMA_INVALID", message: "$.executionPlan[0].actionType must be string" }] },
      },
    });
    expect(await b.validate("s1")).toEqual({ valid: false });
  });

  it("보여 줄 문장이 하나도 안 남으면 errors 를 만들지 않는다", async () => {
    // 화면이 기본 문구로 말한다. 빈 칸을 띄우지 않는다.
    const b = 붙이기();
    await 승인(b, { valid: false, validationMessages: ["결제를 완료해 주세요."] });
    expect(await b.validate("s1")).toEqual({ valid: false });
  });

  it("안전 중단만 중단 화면으로 보낸다", async () => {
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      evidence: {
        runId: "run_9", result: "FAIL", stopType: "SAFETY_STOP",
        stopReason: "예상하지 못한 화면이 나왔어요", executedActions: [{}, {}],
      },
    });
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("aborted");
    expect(e.reachedStep).toBe(2);
    expect(e.abort?.message).toBe("예상하지 못한 화면이 나왔어요");
  });

  it("그냥 실패도 끝난 일로 말하되, 안전 중단과는 다르게 말한다", async () => {
    // 계속 '진행 중' 으로 두면 화면이 90초를 기다리다 일반 오류로 끝난다.
    // 끝난 일은 끝났다고 말한다. 다만 문구가 달라야 한다 — 안전 중단은
    // 기계가 중간 상태일 수 있어 직원 초기화가 필요하고, 그냥 실패는 아니다.
    const b = 붙이기();
    await 승인(b, { valid: true, evidence: { result: "FAIL", stopType: "NONE", executedActions: [] } });
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("aborted");
    expect(e.abort?.title).toBe("끝까지 담지 못했어요");
    expect(e.abort?.userAction).not.toContain("초기화");
  });

  it("안전 중단은 직원 초기화를 안내한다", async () => {
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      evidence: { result: "FAIL", stopType: "SAFETY_STOP", executedActions: [{}] },
    });
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("aborted");
    expect(e.abort?.title).toBe("안전을 위해 멈췄어요");
    expect(e.abort?.userAction).toContain("초기화");
  });

  it("서버가 분류한 결과(#48 status)를 제목으로 쓴다 — 앱 말투로", async () => {
    /*
     * stopType 만 보면 '실행할 수 없습니다' 를 구분할 수 없다. 서버는 summary.status
     * 로 그것까지 나눠 주는데, 문장이 '~습니다' 체라 그대로 쓰면 마지막 화면에서만
     * 문체가 바뀐다. 옮겨서 쓴다.
     */
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      summary: { status: "실행할 수 없습니다." },
      raw: { valid: true, evidence: { result: "FAIL", stopType: "NONE", executedActions: [] } },
    });
    const e = await b.getEvidence("s1");
    expect(e.abort?.title).toBe("담을 수 없어요");
  });

  it("모르는 status 면 서버 문장을 그대로 올리지 않고 우리 문구로 물러난다", async () => {
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      summary: { status: "무언가 새로 생긴 문장입니다." },
      raw: { valid: true, evidence: { result: "FAIL", stopType: "NONE", executedActions: [] } },
    });
    const e = await b.getEvidence("s1");
    expect(e.abort?.title).toBe("끝까지 담지 못했어요");
  });

  it("cartItems 가 없는 환경에서는 개수·금액을 지어내지 않는다", async () => {
    // 닭강정집 말고는 reviewSnapshot 이 라벨-값 쌍만 준다.
    const b = 붙이기();
    await 승인(b, {
      valid: true,
      evidence: { result: "PASS", executedActions: [{}], reviewSnapshot: { "접수 번호": "A-12" } },
    });
    const e = await b.getEvidence("s1");
    expect(e.state).toBe("cart_ready");
    expect(e.cart).toBeUndefined();
  });

  it("QR 로 읽은 claimCode 를 세션 요청에 함께 보낸다", async () => {
    const b = 붙이기({ "simulation/session": { sessionId: "sess_1", initialState: "IDLE", submissionEndpoint: "/x" } });
    await b.createSession({ environmentId: "chicken-store", claimCode: "kb_demo" });
    const [, init] = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({ environmentId: "chicken-store", claimCode: "kb_demo" });
  });
});

describe("팀 백엔드 — 본문을 못 읽어도 계약을 지킨다", () => {
  /*
   * res.text() 도 실패할 수 있다(스트림이 중간에 끊기는 경우). 막아 두지 않으면
   * !res.ok 분기에 닿기도 전에 TypeError 가 올라가서, 화면은 HTTP 상태가 담긴
   * KioBridgeError 대신 개발자 문장을 받는다.
   */
  const 못읽는응답 = (status: number) => {
    globalThis.fetch = vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
      text: async () => { throw new TypeError("network error"); },
    }) as unknown as Response) as unknown as typeof fetch;
  };

  it("실패 응답이면 본문을 못 읽어도 HTTP 상태로 말한다", async () => {
    못읽는응답(500);
    const b = createTeamBackend("/api/bff");
    const e = await b.createSession({ environmentId: "chicken-store", claimCode: "kb" }).catch((x) => x);
    expect(e).toBeInstanceOf(KioBridgeError);
    expect((e as KioBridgeError).code).toBe("HTTP_500");
  });

  it("성공 응답인데 본문을 못 읽으면 BAD_RESPONSE 다", async () => {
    못읽는응답(200);
    const b = createTeamBackend("/api/bff");
    const e = await b.createSession({ environmentId: "chicken-store", claimCode: "kb" }).catch((x) => x);
    expect(e).toBeInstanceOf(KioBridgeError);
    expect((e as KioBridgeError).code).toBe("BAD_RESPONSE");
  });
});

describe("팀 백엔드의 새 경로를 실제 모양대로 부른다", () => {
  /** 정규화를 뺀 '진짜 호출' 만 모은다. 순서가 아니라 경로로 답한다. */
  const 캡처 = (over: Record<string, unknown> = {}) => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const 답 = 경로별응답(over);
    globalThis.fetch = vi.fn(async (u: unknown, init?: RequestInit) => {
      const url = String(u);
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (!url.includes("-normalizations") && !url.includes("canonical-inputs/validate")) calls.push({ url, body });
      return 응답(답(url, body));
    }) as unknown as typeof fetch;
    return { b: createTeamBackend("/api/bff"), calls };
  };

  it("한글 선택지를 enum 으로 바꿔 정규화 경로로 보낸다", async () => {
    // 표준형은 서버가 만든다. 프론트는 원자료를 enum 으로 바꿔 넣기만 한다.
    const 정규화요청: Record<string, unknown>[] = [];
    const 답 = 경로별응답();
    globalThis.fetch = vi.fn(async (u: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (String(u).includes("session-context-normalizations")) 정규화요청.push(body);
      return 응답(답(String(u), body));
    }) as unknown as typeof fetch;
    const b = createTeamBackend("/api/bff");
    await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 });

    expect(정규화요청[0].contextInput).toEqual({
      serviceType: "TAKE_OUT", spicyLevel: "HOT", boneType: "BONELESS",
      cupOption: "NO_PREFERENCE", quantity: 2, allergenIds: [],
    });
    // 사용자가 화면에서 직접 골랐다. 추론한 게 아니므로 확신도를 낮춰 적지 않는다.
    expect(정규화요청[0].collectionMetadata).toMatchObject({ source: "WEB_FORM", confidence: 1, confirmedByUser: true });
  });

  it("정규화가 만든 표준형을 그대로 다음 호출에 쓴다", async () => {
    // 프론트가 만든 것을 보내면 providerId 를 짐작해야 하고, 킷 스키마에 맞는지
    // 아무도 확인하지 않는다. 서버가 만들어 준 것을 그대로 쓴다.
    const { b, calls } = 캡처();
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    const 추천요청 = calls.find((c) => c.url.includes("recommendations"))!;
    expect((추천요청.body.profile as Record<string, unknown>).source)
      .toMatchObject({ providerId: "WHATTHEBUG" });
  });

  it("추천 준비가 안 됐다고 하면 추천으로 넘어가지 않는다", async () => {
    // 개별 정규화는 각자 반쪽만 본다. 합쳐야 보이는 게 있고, 알레르기가
    // UNKNOWN 인 경우가 그렇다. 이 문을 건너뛰면 앱이 모르는 알레르기를 가진
    // 분에게 그대로 음식을 추천하게 된다.
    const { b, calls } = 캡처({
      "canonical-inputs/validate": {
        status: "RECONFIRMATION_REQUIRED",
        recommendationReady: false,
        contractValidation: {
          valid: false,
          errors: [{ code: "HARD_CONSTRAINT_UNKNOWN", message: "allergenIds 가 UNKNOWN 입니다." }],
        },
      },
    });
    await expect(
      b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 }),
    ).rejects.toThrow("알레르기");
    // 후보 필터도 추천도 부르지 않는다.
    expect(calls).toEqual([]);
  });

  it("추천 준비가 됐을 때만 다음으로 간다", async () => {
    const { b, calls } = 캡처();
    await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 });
    expect(calls.some((c) => c.url.includes("candidate-filters"))).toBe(true);
  });

  it("고른 후보를 대안에서 빼고 원래 1순위를 대안으로 옮긴다", async () => {
    // 1순위만 덮으면 그 후보가 대안에도 남아 두 필드가 겹친다.
    // 백엔드 RecommendationValidator 가 ALTERNATIVE_DUPLICATES_RECOMMENDED 로 막는다.
    const { b, calls } = 캡처({
      recommendations: { ...목추천, recommendedCandidateId: "CHICKEN-001", alternativeCandidateIds: ["CHICKEN-003"] },
    });
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    await b.submit("s1", {
      pairingId: "s1", sheetId: "p1", mappingResult: "clarification",
      candidateId: "CHICKEN-003", profile: 목주문표,
    });
    const rec = calls.find((c) => c.url.includes("orchestrator/approve"))!.body.recommendation as Record<string, unknown>;
    expect(rec.recommendedCandidateId).toBe("CHICKEN-003");
    expect(rec.alternativeCandidateIds).toEqual(["CHICKEN-001"]);
  });

  it("모르는 값(UNKNOWN)을 '안 맞음' 으로 단정하지 않는다", async () => {
    // 사용자가 고른 선택지를 우리가 enum 으로 못 옮긴 것이지, 오늘 그 조합이
    // 없다는 뜻이 아니다. 근거 없는 판단을 사용자에게 말하지 않는다.
    const 모르는맵기 = { ...목주문표, selections: { ...목주문표.selections, "맵기": ["아주매운맛"] } };
    const { b } = 캡처({
      "candidate-filters": {
        eligibleCandidates: [{
          candidateId: "CHICKEN-003", name: "매운 뼈 닭강정", price: 5500, available: true,
          attributes: { spicyLevel: "HOT", boneType: "BONELESS" },
        }],
        excludedCandidates: [],
      },
      recommendations: { ...목추천, recommendedCandidateId: "CHICKEN-003" },
    });
    await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 모르는맵기 });
    const rec = await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 모르는맵기 });
    expect(rec.matchedOptions.find((o) => o.label === "맵기")).toBeUndefined();
  });

  it("정보 지우기가 이 계층의 캐시까지 비운다", async () => {
    // 화면이 '모두 지워요' 라고 약속한다. 정규화된 주문표와 세션 맥락이
    // 메모리에 남으면 그 문장이 사실이 아니게 된다.
    const { b } = 캡처();
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    await b.forgetSession!("s1");
    // 추천 기록이 비었으므로 승인이 재료를 못 찾는다.
    await expect(
      b.submit("s1", { pairingId: "s1", sheetId: "p1", mappingResult: "exact", profile: 목주문표 }),
    ).rejects.toThrow();
  });

  it("주문표를 고치면 정규화를 다시 받는다", async () => {
    // 캐시 키가 주문표 id 뿐이면 고친 조건이 반영되지 않는다.
    const { b, calls } = 캡처();
    const 부르기 = (p: typeof 목주문표) => b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: p });
    await 부르기(목주문표);
    await 부르기(목주문표);
    const 두번째 = calls.length;
    await 부르기({ ...목주문표, selections: { ...목주문표.selections, "맵기": ["순한맛"] } });
    // 같은 주문표는 캐시를 쓰고(호출이 안 늘고), 고친 주문표는 다시 받는다.
    expect(두번째).toBe(2);
    expect(calls.length).toBe(3);
  });

  it("거절은 approved:false 로 같은 경로에 나간다", async () => {
    // 킷 계약의 UserDecision 은 APPROVE·REJECT·MODIFY 셋이다.
    // 거절은 빈 실행계획으로 제출돼 검증까지만 가고 실행은 건너뛴다.
    const { b, calls } = 캡처();
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    await b.reject!("s1", { pairingId: "s1", sheetId: "p1", profile: 목주문표 });
    const 거절 = calls.find((c) => c.url.includes("orchestrator/approve"))!;
    expect(거절.body.userDecision).toMatchObject({ approved: false, decision: "REJECT" });
    // 승인과 같은 재료를 보낸다. 서버가 무엇을 보고 거절했는지 알아야 한다.
    for (const k of ["sessionId", "profile", "sessionContext", "recommendation"]) {
      expect(거절.body).toHaveProperty(k);
    }
  });

  it("매핑을 안 거쳤으면 거절도 조용히 넘어간다", async () => {
    // 보여 준 적 없는 것을 거절할 수는 없다. 서버에 보낼 재료도 없다.
    const { b, calls } = 캡처();
    await b.reject!("s1", { pairingId: "s1", sheetId: "p1", profile: 목주문표 });
    expect(calls).toEqual([]);
  });

  it("서버가 못 쓰겠다고 하면 거기서 멈춘다", async () => {
    // 조용히 넘기면 승인 직전에 터진다. 그때는 되돌릴 게 더 많다.
    const { b } = 캡처({
      "profile-normalizations": {
        status: "INVALID", profile: {},
        contractValidation: { valid: false, errors: [{ message: "profileId 가 비었습니다" }] },
      },
    });
    await expect(
      b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 }),
    ).rejects.toThrow("profileId 가 비었습니다");
  });

  it("후보 필터 응답에서 이름·가격을 만든다", async () => {
    // 추천 응답에는 이름이 없다. 이게 없으면 화면에 상품 ID 밖에 보여 줄 게 없고
    // 그건 실격 조건이다.
    const { b } = 캡처({ "candidate-filters": {
      eligibleCandidates: [
        { candidateId: "CHICKEN-001", name: "매운 순살 닭강정", price: 6000 },
        { candidateId: "CHICKEN-003", name: "매운 뼈 닭강정", price: 5500 },
      ],
      excludedCandidates: [{
        candidateId: "CHICKEN-005", reasonCode: "ALLERGEN",
        // 서버가 주는 explanation 은 규칙 추적용 문자열이다. 사람에게 보여 줄 문장은 reasonText 다.
        explanation: "ruleId=CHICKEN_ALLERGEN_HARD_CONSTRAINT, sourceValue=[PEANUT]",
        reasonText: "[PEANUT] 알레르기와 겹쳐서 제외됐어요.",
      }],
    } });
    const r = await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 });
    expect(r.survivingCandidateIds).toEqual(["CHICKEN-001", "CHICKEN-003"]);
    expect(r.display?.["CHICKEN-001"]).toEqual({ displayName: "매운 순살 닭강정", priceText: "6,000원" });
    // 규칙 추적 문자열이 화면으로 새지 않는다.
    expect(r.excluded[0].explanation).toBe("[PEANUT] 알레르기와 겹쳐서 제외됐어요.");
    expect(JSON.stringify(r.excluded)).not.toContain("ruleId=");
  });

  it("지금 팔지 않는 후보는 담을 수 있는 목록에서 뺀다", async () => {
    // 심사 필수 기준: 선택 불가능 후보 추천 0건.
    // 서버가 available:false 를 eligibleCandidates 에 남겨 보내는 걸 확인했다.
    const { b } = 캡처({ "candidate-filters": {
      eligibleCandidates: [
        { candidateId: "CHICKEN-001", name: "매운 순살 닭강정", price: 6000, available: true },
        { candidateId: "CHICKEN-008", name: "품절 닭강정", price: 6000, available: false },
      ],
      excludedCandidates: [],
    } });
    const r = await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 });
    expect(r.survivingCandidateIds).toEqual(["CHICKEN-001"]);
    expect(r.display?.["CHICKEN-008"]).toBeUndefined();
    // 조용히 사라지면 "왜 없지?" 가 된다. 뺀 이유를 말해 준다.
    expect(r.excluded.map((e) => e.explanation).join()).toContain("지금 팔지 않아서");
  });

  it("품절 후보가 추천에 실려 와도 화면으로 내보내지 않는다", async () => {
    const { b } = 캡처({
      "candidate-filters": {
        eligibleCandidates: [
          { candidateId: "CHICKEN-001", name: "매운 순살 닭강정", price: 6000, available: true },
          { candidateId: "CHICKEN-008", name: "품절 닭강정", price: 6000, available: false },
        ],
        excludedCandidates: [],
      },
      recommendations: { ...목추천, recommendedCandidateId: "CHICKEN-001", alternativeCandidateIds: ["CHICKEN-008"] },
    });
    await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 });
    const rec = await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    expect(rec.alternativeCandidateIds).toEqual([]);
  });

  it("후보가 들고 있는 값으로 조건별 일치를 만든다", async () => {
    // 이름 문자열로 짐작하지 않는다. 서버가 준 attributes 는 사용자가 고른 값과
    // 같은 어휘라 그대로 비교할 수 있다.
    const { b } = 캡처({
      "candidate-filters": {
        eligibleCandidates: [{
          candidateId: "CHICKEN-003", name: "매운 뼈 닭강정", price: 5500, available: true,
          attributes: { spicyLevel: "HOT", boneType: "BONE" },
          supportedOptions: { SERVICE_TYPE: ["DINE_IN", "TAKE_OUT"], CUP: ["PAPER"] },
        }],
        excludedCandidates: [],
      },
      recommendations: { ...목추천, recommendedCandidateId: "CHICKEN-003" },
    });
    await b.filterCandidates({ environmentId: "chicken-store", profileId: "p1", profile: 목주문표 });
    const rec = await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    const 표 = Object.fromEntries(rec.matchedOptions.map((o) => [o.label, o]));
    // 주문표는 포장하기·매운맛·순살이다. 이 후보는 뼈라 형태만 어긋난다.
    expect(표["맵기"].matched).toBe(true);
    expect(표["형태"].matched).toBe(false);
    expect(표["이용 방식"].matched).toBe(true);
    // 화면에는 enum 이 아니라 사용자가 고른 한글이 보여야 한다.
    expect(표["형태"].value).toBe("순살");
    expect(rec.unmatchedLabelsByCandidate?.["CHICKEN-003"]).toEqual(["형태"]);
  });

  it("추천에는 생존 후보를 보내지 않는다 — 서버가 다시 계산한다", async () => {
    // 클라이언트가 보낸 필터 결과를 서버가 믿으면 알레르기 필터를 우회할 수 있다.
    const { b, calls } = 캡처();
    await b.recommend({
      environmentId: "chicken-store", profileId: "p1",
      survivingCandidateIds: ["CHICKEN-001"], profile: 목주문표,
    });
    expect(calls[0].url).toBe("/api/bff/api/v1/recommendations");
    expect(calls[0].body).not.toHaveProperty("survivingCandidateIds");
    expect(calls[0].body).toHaveProperty("profile");
    expect(calls[0].body).toHaveProperty("sessionContext");
  });

  it("승인은 orchestrator/approve 로 조각을 갖춰 보낸다", async () => {
    const { b, calls } = 캡처();
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    await b.submit("s1", { pairingId: "s1", sheetId: "p1", mappingResult: "exact", profile: 목주문표 });

    const 승인 = calls[1];
    expect(승인.url).toBe("/api/bff/internal/orchestrator/approve");
    expect(승인.body.sessionId).toBe("s1");
    // 문서가 요구한 다섯 조각이 다 있어야 서버가 제출물을 조립할 수 있다.
    for (const k of ["sessionId", "profile", "sessionContext", "recommendation", "userDecision"]) {
      expect(승인.body).toHaveProperty(k);
    }
    expect(승인.body.userDecision).toMatchObject({ approved: true, decision: "APPROVE" });
    // environmentId 는 보내지 않는다. 서버가 sessionId 로 다시 조회한다.
    expect(승인.body).not.toHaveProperty("environmentId");
  });

  it("사용자가 고른 후보가 1순위로 바뀌어 나간다", async () => {
    const { b, calls } = 캡처();
    await b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [], profile: 목주문표 });
    await b.submit("s1", {
      pairingId: "s1", sheetId: "p1", mappingResult: "clarification",
      candidateId: "CHICKEN-003", profile: 목주문표,
    });
    expect((calls[1].body.recommendation as Record<string, unknown>).recommendedCandidateId).toBe("CHICKEN-003");
  });

  it("주문표 없이 부르면 조용히 넘어가지 않는다", async () => {
    const { b } = 캡처();
    await expect(b.filterCandidates({ environmentId: "chicken-store", profileId: "p1" })).rejects.toThrow();
    await expect(b.recommend({ environmentId: "chicken-store", profileId: "p1", survivingCandidateIds: [] })).rejects.toThrow();
  });

  it("추천 없이 승인하면 거절한다", async () => {
    // 매핑을 건너뛰고 승인만 부르는 경로가 생기면 서버가 조립할 재료가 없다.
    const { b } = 캡처();
    await expect(
      b.submit("s1", { pairingId: "s1", sheetId: "p1", mappingResult: "exact", profile: 목주문표 }),
    ).rejects.toThrow();
  });

  it("세션 응답의 environmentId 를 그대로 올린다", async () => {
    const { b } = 캡처({ "simulation/session": { sessionId: "s1", environmentId: "hospital", initialState: "X", submissionEndpoint: "/y" } });
    const s = await b.createSession({ environmentId: "chicken-store", claimCode: "kb" });
    // 화면이 보낸 값이 아니라 서버가 정한 값이 이긴다.
    expect(s.environmentId).toBe("hospital");
  });
});
