import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileData } from "@/domain/types";
import { api, clearProfiles, registerProfile, setMockDelays, setScenario, unregisterProfile } from "./client";

// 목의 프로필 보관소는 실제 백엔드의 프로필 저장소 자리다.
// 화면의 '이 기기에서 정보 지우기'는 "지금까지 입력한 내용을 모두 지워요" 라고 약속한다.
// 여기 사본이 남으면 그 문장이 사실이 아니게 되므로, 지우는 경로를 함께 검사한다.

const 프로필 = (id: string, selections: Record<string, string[]>): ProfileData => ({
  id,
  menuName: "닭강정",
  place: "음식점",
  selections,
  memo: "매운 건 못 드세요",
});

const 매운 = 프로필("p1", { "이용 방식": ["포장하기"], "맵기": ["매운맛"], "형태": ["순살"] });
const 순한 = 프로필("p2", { "이용 방식": ["포장하기"], "맵기": ["순한맛"], "형태": ["순살"] });

const PAIRING = "pr_test";
const 이유 = async (id: string) =>
  ((await api.requestMapping(PAIRING, id)).reasons ?? []).map((r) => r.text).join("\n");

beforeEach(() => {
  // 목의 응답 지연은 시연을 위한 것이지 검사 대상이 아니다.
  // 그대로 두면 이 파일 하나가 12초를 순수하게 기다리기만 한다.
  setMockDelays({ pairing: 0, mapping: 0, approve: 0, step: 1 });
  clearProfiles();
  setScenario({ pairing: "connected", mapping: "exact", execution: "cart_ready" });
});

describe("프로필 등록", () => {
  it("등록한 프로필의 조건이 응답에 반영된다", async () => {
    registerProfile(매운);
    expect(await 이유("p1")).toContain("매운맛");
  });

  it("서로 다른 프로필은 서로 다른 답을 낸다", async () => {
    registerProfile(매운);
    registerProfile(순한);
    expect(await 이유("p1")).toContain("매운맛");
    expect(await 이유("p2")).toContain("순한맛");
  });
});

describe("등록되지 않은 프로필로는 답을 만들지 않는다", () => {
  // 예전에는 undefined 를 그대로 buildMapping 에 넘겨서, 사용자가 고른 적 없는
  // 임의 메뉴가 승인 화면까지 올라갔다.
  it("아예 등록한 적 없는 id 는 거절한다", async () => {
    await expect(api.requestMapping(PAIRING, "없는id")).rejects.toThrow();
  });

  it("unregisterProfile 이후에는 그 id 로 답을 만들지 않는다", async () => {
    registerProfile(매운);
    expect(await 이유("p1")).toContain("매운맛");

    unregisterProfile("p1");
    await expect(api.requestMapping(PAIRING, "p1")).rejects.toThrow();
  });

  it("unregisterProfile 은 지정한 것만 지운다", async () => {
    registerProfile(매운);
    registerProfile(순한);
    unregisterProfile("p1");

    await expect(api.requestMapping(PAIRING, "p1")).rejects.toThrow();
    expect(await 이유("p2")).toContain("순한맛");
  });

  it("clearProfiles 는 전부 지운다", async () => {
    registerProfile(매운);
    registerProfile(순한);
    clearProfiles();

    await expect(api.requestMapping(PAIRING, "p1")).rejects.toThrow();
    await expect(api.requestMapping(PAIRING, "p2")).rejects.toThrow();
  });

  it("없는 id 를 지워도 터지지 않는다", () => {
    expect(() => unregisterProfile("없는id")).not.toThrow();
  });

  it("이미 만든 실행 계획도 함께 지운다", async () => {
    // 계획에는 무엇을 몇 개 담았고 얼마인지가 들어 있다.
    // 프로필만 지우고 이건 남겨 두면 '모두 지워요' 가 반쯤만 사실이 된다.
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    const { planId } = await api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" });
    await expect(api.getPlanStatus(planId)).resolves.toBeDefined();

    clearProfiles();
    await expect(api.getPlanStatus(planId)).rejects.toThrow();
  });
});

describe("장바구니는 승인한 내용과 같아야 한다", () => {
  // 예전에는 MOCK_CART 고정값이라, 확인 화면에서 6,500원을 보고 승인해도
  // 결과 화면은 6,000원이라고 말했다. 대신 눌러 주는 앱에서 그 불일치는
  // 승인이라는 절차 자체를 무의미하게 만든다.
  const 담길때까지 = async (planId: string) => {
    for (let i = 0; i < 60; i++) {
      const s = await api.getPlanStatus(planId);
      if (s.state === "cart_ready") return s;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("장바구니까지 가지 못했다");
  };

  it("확인 화면의 가격이 그대로 결과에 나온다", async () => {
    registerProfile(매운);
    const m = await api.requestMapping(PAIRING, "p1");
    const { planId } = await api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" });
    const s = await 담길때까지(planId);
    expect(s.cart?.totalText).toBe(m.item!.priceText);
  });

  it("수량을 2개로 저장했으면 금액도 두 배가 된다", async () => {
    registerProfile(프로필("p3", { "이용 방식": ["포장하기"], "맵기": ["매운맛"], "형태": ["순살"], "수량": ["2개"] }));
    const m = await api.requestMapping(PAIRING, "p3");
    const { planId } = await api.approve({ pairingId: PAIRING, profileId: "p3", mappingResult: "exact" });
    const s = await 담길때까지(planId);
    const 단가 = Number(m.item!.priceText.replace(/[^0-9]/g, ""));
    expect(s.cart?.itemCountText).toBe("2개");
    expect(Number(s.cart!.totalText.replace(/[^0-9]/g, ""))).toBe(단가 * 2);
  });

  it("후보를 고르는 화면에서도 수량이 지켜진다", async () => {
    // clarification 은 item 을 주지 않는다. 예전에는 수량을 그 item 에서 꺼내서
    // 3개를 저장해 둔 사람이 조용히 1개를 받았다. 경고도 없었다.
    setScenario({ mapping: "clarification" });
    registerProfile(프로필("p4", { "이용 방식": ["포장하기"], "맵기": ["매운맛"], "형태": ["순살"], "수량": ["3개"] }));
    const m = await api.requestMapping(PAIRING, "p4");
    const 고른것 = m.candidates![0];
    const { planId } = await api.approve({
      pairingId: PAIRING, profileId: "p4", mappingResult: "clarification", candidateId: 고른것.candidateId,
    });
    const s = await 담길때까지(planId);
    const 단가 = Number(고른것.priceText.replace(/[^0-9]/g, ""));
    expect(s.cart?.itemCountText).toBe("3개");
    expect(Number(s.cart!.totalText.replace(/[^0-9]/g, ""))).toBe(단가 * 3);
  });

  it("여러 후보에서 고른 것이 그대로 담긴다", async () => {
    setScenario({ mapping: "clarification" });
    registerProfile(매운);
    const m = await api.requestMapping(PAIRING, "p1");
    const 고른것 = m.candidates![1];   // 첫 번째가 아닌 것을 일부러 고른다
    const { planId } = await api.approve({
      pairingId: PAIRING, profileId: "p1", mappingResult: "clarification", candidateId: 고른것.candidateId,
    });
    const s = await 담길때까지(planId);
    expect(s.cart?.totalText).toBe(고른것.priceText);
  });
});

describe("승인 검사 — 서버가 자기 답을 기준으로 본다", () => {
  it("매핑을 하기 전에는 승인할 수 없다", async () => {
    // P0-4: 승인 전에 실행 계획이 만들어지는 경로가 없어야 한다.
    // 클라이언트가 mappingResult 를 지어내 보내도 통하지 않는다.
    registerProfile(매운);
    await expect(
      api.approve({ pairingId: "안한페어링", profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
  });

  it("exact 는 매핑을 받은 뒤 승인되고 planId 를 돌려준다", async () => {
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    const { planId } = await api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" });
    expect(planId).toMatch(/^pln_/);
  });

  it("승인해야 비로소 실행 정보가 생긴다", async () => {
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    // 아직 승인하지 않은 계획 id 는 존재하지 않는다.
    await expect(api.getPlanStatus("pln_없는계획")).rejects.toThrow();

    const { planId } = await api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" });
    await expect(api.getPlanStatus(planId)).resolves.toBeDefined();
  });

  it("clarification 인데 후보를 안 고르면 거절한다", async () => {
    setScenario({ mapping: "clarification" });
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "clarification" }),
    ).rejects.toThrow();
  });

  it("우리가 주지 않은 후보를 담아 달라고 하면 거절한다", async () => {
    setScenario({ mapping: "clarification" });
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "clarification", candidateId: "c99" }),
    ).rejects.toThrow();
  });

  it("우리가 준 후보면 승인된다", async () => {
    setScenario({ mapping: "clarification" });
    registerProfile(매운);
    const res = await api.requestMapping(PAIRING, "p1");
    const id = res.candidates![0].candidateId;
    const { planId } = await api.approve({
      pairingId: PAIRING, profileId: "p1", mappingResult: "clarification", candidateId: id,
    });
    expect(planId).toMatch(/^pln_/);
  });

  it("changed 인데 확인 표시가 없으면 거절한다", async () => {
    setScenario({ mapping: "changed" });
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "changed" }),
    ).rejects.toThrow();
  });

  it("low_confidence 인데 직접 짚지 않으면 거절한다", async () => {
    setScenario({ mapping: "low_confidence" });
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "low_confidence" }),
    ).rejects.toThrow();
  });

  it("not_found 는 어떤 경우에도 거절한다", async () => {
    setScenario({ mapping: "not_found" });
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
  });

  it("클라이언트가 mappingResult 를 속여도 서버 판단을 따른다", async () => {
    // 화면이 changed 를 받았는데 exact 라고 보내며 확인 표시를 빼면 통과해서는 안 된다.
    setScenario({ mapping: "changed" });
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
  });
});
