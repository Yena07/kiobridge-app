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
// 순한맛+뼈 조합은 오늘 메뉴에 없다. 실제로 어긋나므로 시나리오 스위치와 무관하게
// changed 가 된다. 목은 없는 불일치를 지어내지 않으므로 이 프로필이 필요하다.
const 안맞음 = 프로필("p3", { "이용 방식": ["포장하기"], "맵기": ["순한맛"], "형태": ["뼈"] });

// 페어링을 거치지 않은 세션으로는 매핑할 수 없다. 실제 흐름대로 먼저 받는다.
let PAIRING = "";
const 페어링 = async () => { PAIRING = (await api.claimPairing("kb")).pairingId; return PAIRING; };
const 이유 = async (id: string) =>
  ((await api.requestMapping(PAIRING, id)).reasons ?? []).map((r) => r.text).join("\n");

beforeEach(() => {
  // 목의 응답 지연은 시연을 위한 것이지 검사 대상이 아니다.
  // 그대로 두면 이 파일 하나가 12초를 순수하게 기다리기만 한다.
  setMockDelays({ pairing: 0, mapping: 0, approve: 0, step: 1 });
  clearProfiles();
  setScenario({ pairing: "connected", mapping: "exact", execution: "cart_ready" });
});

beforeEach(async () => {
  await 페어링();
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

describe("연결 시나리오", () => {
  it("failed 는 복구 불가로 거절한다", async () => {
    setScenario({ pairing: "failed" });
    await expect(api.claimPairing("kb")).rejects.toThrow();
  });

  it("expired 는 다시 시도할 수 있는 오류로 준다", async () => {
    setScenario({ pairing: "expired" });
    await api.claimPairing("kb").then(
      () => { throw new Error("거절했어야 한다"); },
      (e) => { expect(e.code).toBe("CLAIM_EXPIRED"); expect(e.recoverable).toBe(true); },
    );
  });

  it("connected 는 만료 시각이 미래인 세션을 준다", async () => {
    const r = await api.claimPairing("kb");
    expect(r.expiresAt).toBeGreaterThan(Date.now());
    expect(r.kioskName.length).toBeGreaterThan(0);
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

  it("forgetAll 은 계약의 삭제 경로다 — 목 전용 함수를 화면이 부르지 않아도 된다", async () => {
    // 화면이 clearProfiles 를 직접 부르면 실제 client 로 바꾸는 순간
    // 그 호출은 목의 Map 만 비우고 서버 데이터는 남는다.
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    const { planId } = await api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" });

    await api.forgetAll();

    await expect(api.requestMapping(PAIRING, "p1")).rejects.toThrow();
    await expect(api.getPlanStatus(planId)).rejects.toThrow();
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
    // 실제로 어긋나는 프로필을 쓴다. 스위치만 changed 로 돌리고 다 맞는 프로필을
    // 넣으면 목이 사실대로 exact 를 돌려주므로 이 검사가 통과할 수 없다.
    setScenario({ mapping: "changed" });
    registerProfile(안맞음);
    const r = await api.requestMapping(PAIRING, "p3");
    expect(r.result).toBe("changed");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p3", mappingResult: "changed" }),
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

  it("매핑한 프로필과 다른 프로필로는 승인할 수 없다", async () => {
    // A 로 찾아 놓고 B 를 담는 걸 막는다.
    registerProfile(매운);
    registerProfile(순한);
    await api.requestMapping(PAIRING, "p1");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p2", mappingResult: "exact" }),
    ).rejects.toThrow();
  });

  it("같은 매핑으로 두 번 담을 수 없다", async () => {
    // 연타나 재전송으로 두 개가 담기면 한 번 승인하고 두 개를 받는다.
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    await api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" });
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p1", mappingResult: "exact" }),
    ).rejects.toThrow();
  });

  it("동시에 들어온 승인 두 건 중 하나만 담긴다", async () => {
    // 위 테스트는 순차 호출만 본다. 검사와 확정 사이에 await 가 있으면
    // 동시에 들어온 두 건이 모두 검사를 통과하는데 그걸 잡지 못한다.
    registerProfile(매운);
    await api.requestMapping(PAIRING, "p1");
    const 요청 = { pairingId: PAIRING, profileId: "p1", mappingResult: "exact" as const };
    const 결과 = await Promise.allSettled([api.approve(요청), api.approve(요청)]);
    expect(결과.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("클라이언트가 mappingResult 를 속여도 서버 판단을 따른다", async () => {
    // 화면이 changed 를 받았는데 exact 라고 보내며 확인 표시를 빼면 통과해서는 안 된다.
    setScenario({ mapping: "changed" });
    registerProfile(안맞음);
    await api.requestMapping(PAIRING, "p3");
    await expect(
      api.approve({ pairingId: PAIRING, profileId: "p3", mappingResult: "exact" }),
    ).rejects.toThrow();
  });
});
