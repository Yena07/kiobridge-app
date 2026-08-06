import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileData } from "@/domain/types";
import { api, clearProfiles, registerProfile, setScenario, unregisterProfile } from "./client";

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

const 매운 = 프로필("p1", { "맵기": ["매운맛"], "형태": ["순살"] });
const 순한 = 프로필("p2", { "맵기": ["순한맛"], "형태": ["순살"] });

const 이유 = async (id: string) =>
  ((await api.requestMapping("pr_test", id)).reasons ?? []).map((r) => r.text).join("\n");

beforeEach(() => {
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

describe("지우는 경로", () => {
  it("unregisterProfile 이후에는 그 프로필 조건이 응답에 남지 않는다", async () => {
    registerProfile(매운);
    expect(await 이유("p1")).toContain("매운맛");

    unregisterProfile("p1");
    expect(await 이유("p1")).not.toContain("매운맛");
  });

  it("unregisterProfile 은 지정한 것만 지운다", async () => {
    registerProfile(매운);
    registerProfile(순한);
    unregisterProfile("p1");

    expect(await 이유("p1")).not.toContain("매운맛");
    expect(await 이유("p2")).toContain("순한맛");
  });

  it("clearProfiles 는 전부 지운다", async () => {
    registerProfile(매운);
    registerProfile(순한);
    clearProfiles();

    expect(await 이유("p1")).not.toContain("매운맛");
    expect(await 이유("p2")).not.toContain("순한맛");
  });

  it("없는 id 를 지워도 터지지 않는다", () => {
    expect(() => unregisterProfile("없는id")).not.toThrow();
  });
});

describe("승인 조건은 서버에서도 다시 본다", () => {
  it("clarification 인데 후보를 안 고르면 거절한다", async () => {
    await expect(
      api.approve({ pairingId: "pr_test", profileId: "p1", mappingResult: "clarification" }),
    ).rejects.toThrow();
  });

  it("changed 인데 확인 표시가 없으면 거절한다", async () => {
    await expect(
      api.approve({ pairingId: "pr_test", profileId: "p1", mappingResult: "changed" }),
    ).rejects.toThrow();
  });

  it("low_confidence 인데 직접 짚지 않으면 거절한다", async () => {
    await expect(
      api.approve({ pairingId: "pr_test", profileId: "p1", mappingResult: "low_confidence" }),
    ).rejects.toThrow();
  });

  it("not_found 는 어떤 경우에도 거절한다", async () => {
    await expect(
      api.approve({ pairingId: "pr_test", profileId: "p1", mappingResult: "not_found" }),
    ).rejects.toThrow();
  });
});
