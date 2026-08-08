import { describe, expect, it } from "vitest";
import type { ProfileData } from "@/domain/types";
import { toCanonicalProfile, toChickenStoreContext, 백엔드가아는장소, 수량숫자 } from "./canonical";

// 이 파일이 지키는 것: 화면의 한글 선택지가 백엔드 enum 으로 정확히 옮겨진다.
// 여기가 어긋나면 사용자가 '매운맛'을 골랐는데 서버는 '순한맛'으로 읽는다.
// 값은 팀 백엔드의 enum 파일에서 그대로 옮긴 것이다.

const 프로필 = (selections: Record<string, string[]>): ProfileData => ({
  id: "p1", menuName: "닭강정", place: "음식점", selections, memo: "",
});

describe("선택지를 enum 으로 옮긴다", () => {
  it("닭강정집 다섯 축이 모두 맞는다", () => {
    const c = toChickenStoreContext(프로필({
      "이용 방식": ["먹고 가기"], "맵기": ["매운맛"], "형태": ["순살"],
      "컵": ["종이컵"], "수량": ["2개"],
    }));
    expect(c.preferences).toEqual({
      serviceType: "DINE_IN", spicyLevel: "HOT", boneType: "BONELESS",
      cupOption: "PAPER", quantity: 2,
    });
    expect(c.intent).toEqual({ task: "ORDER_FOOD" });
  });

  it("나머지 선택지도 짝이 맞는다", () => {
    const c = toChickenStoreContext(프로필({
      "이용 방식": ["포장하기"], "맵기": ["순한맛"], "형태": ["뼈"], "컵": ["일반컵"], "수량": ["3개"],
    }));
    expect(c.preferences).toEqual({
      serviceType: "TAKE_OUT", spicyLevel: "MILD", boneType: "BONE",
      cupOption: "REGULAR", quantity: 3,
    });
    expect(toChickenStoreContext(프로필({ "맵기": ["보통맛"] })).preferences.spicyLevel).toBe("MEDIUM");
  });

  it("안 고른 축은 NO_PREFERENCE 다 — UNKNOWN 과 구분한다", () => {
    // 안 골랐다(NO_PREFERENCE)와 모르는 값이다(UNKNOWN)를 뭉뚱그리면,
    // 화면에 새 선택지가 생겼을 때 서버가 '아무거나 괜찮대요' 로 읽는다.
    const 빈 = toChickenStoreContext(프로필({}));
    expect(빈.preferences).toEqual({
      serviceType: "NO_PREFERENCE", spicyLevel: "NO_PREFERENCE", boneType: "NO_PREFERENCE",
      cupOption: "NO_PREFERENCE", quantity: null,
    });
    const 모름 = toChickenStoreContext(프로필({ "맵기": ["아주매운맛"] }));
    expect(모름.preferences.spicyLevel).toBe("UNKNOWN");
  });

  it("알레르기 여섯 개가 모두 옮겨진다", () => {
    const c = toChickenStoreContext(프로필({
      "알레르기 (꼭 빼주세요)": ["땅콩", "대두", "우유", "계란", "밀", "새우"],
    }));
    expect(c.hardConstraints.allergenIds).toEqual(["PEANUT", "SOY", "MILK", "EGG", "WHEAT", "SHRIMP"]);
  });

  it("모르는 알레르기도 버리지 않고 UNKNOWN 으로 보낸다", () => {
    // 조용히 버리면 그 사람의 알레르기가 서버에 전달되지 않는다.
    // 절대 조건이라 '모른다' 는 사실이라도 서버가 알아야 한다.
    const c = toChickenStoreContext(프로필({ "알레르기 (꼭 빼주세요)": ["땅콩", "메밀"] }));
    expect(c.hardConstraints.allergenIds).toEqual(["PEANUT", "UNKNOWN"]);
  });

  it("수량은 숫자로 바뀐다", () => {
    expect(수량숫자("1개")).toBe(1);
    expect(수량숫자("10개")).toBe(10);
    expect(수량숫자(undefined)).toBeNull();
    expect(수량숫자("")).toBeNull();
  });
});

describe("프로필에 실제 개인정보를 담지 않는다", () => {
  it("dataClassification 은 SYNTHETIC_PROFILE 이다", () => {
    // 심사 요건이다. 다른 값이면 실격 대상이 된다.
    expect(toCanonicalProfile(프로필({})).dataClassification).toBe("SYNTHETIC_PROFILE");
  });

  it("이름·전화번호가 들어갈 자리를 만들지 않는다", () => {
    const c = toCanonicalProfile({ ...프로필({}), memo: "김할머니 010-1234-5678" });
    const s = JSON.stringify(c);
    expect(s).not.toContain("displayName");
    expect(s).not.toContain("김할머니");
    // 메모는 사용자가 자유롭게 적는 칸이라 그대로 보내지 않는다.
    expect(s).not.toContain("010-");
  });

  it("보관 정책이 화면의 실제 동작과 같다", () => {
    // 프로필은 메모리에만 있고 새로고침하면 사라진다. SESSION_ONLY 가 사실이다.
    expect(toCanonicalProfile(프로필({})).consent.retentionPolicy).toBe("SESSION_ONLY");
  });

  it("묻지 않은 접근성 항목을 true 로 보내지 않는다", () => {
    const a = toCanonicalProfile(프로필({})).accessibility;
    expect(Object.values(a).every((v) => v === false)).toBe(true);
    expect(toCanonicalProfile(프로필({}), { largeText: true }).accessibility.largeText).toBe(true);
  });

  it("수집 시각을 넘기면 그걸 쓴다 — 시계에 기대지 않는다", () => {
    const t = "2026-08-01T05:30:00.000Z";
    expect(toCanonicalProfile(프로필({}), { collectedAt: t }).source.collectedAt).toBe(t);
  });
});

describe("백엔드가 다룰 수 있는 장소인지 본다", () => {
  it("닭강정집만 참이다", () => {
    // 백엔드의 요청 타입이 ChickenStoreSessionContext 로 못박혀 있다.
    expect(백엔드가아는장소(프로필({}))).toBe(true);
    for (const place of ["카페", "병원", "관공서"] as const) {
      expect(백엔드가아는장소({ ...프로필({}), place })).toBe(false);
    }
    expect(백엔드가아는장소({ ...프로필({}), place: null })).toBe(false);
  });
});
