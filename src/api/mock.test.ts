import { describe, expect, it } from "vitest";
import type { MappingState, ProfileData } from "@/domain/types";
import { MOCK_CART, MOCK_MENU_NAME, buildMapping } from "./mock";

// 이 파일이 지키는 것은 하나다.
// 확인 화면은 사용자가 실제로 고른 조건만 말해야 한다.
// 고정 응답을 돌려주면 "당신이 고른 조건을 이렇게 썼습니다" 라고 하면서
// 고른 적 없는 조건을 나열하게 되고, 대신 눌러 주는 앱에서 그건 가장 나쁜 거짓말이다.

const 프로필 = (selections: Record<string, string[]>): ProfileData => ({
  id: "t1",
  menuName: "닭강정",
  place: "음식점",
  selections,
  memo: "",
});

const 땅콩알레르기 = 프로필({
  "이용 방식": ["포장하기"],
  "맵기": ["매운맛"],
  "형태": ["순살"],
  "컵": ["종이컵"],
  "수량": ["1개"],
  "알레르기 (꼭 빼주세요)": ["땅콩"],
});

const 알레르기없음 = 프로필({
  "이용 방식": ["먹고 가기"],
  "맵기": ["순한맛"],
  "형태": ["뼈"],
  "컵": ["일반컵"],
  "수량": ["2개"],
});

const 모든상태: MappingState[] = ["exact", "clarification", "not_found", "changed", "low_confidence"];

const 이유문구 = (r: ReturnType<typeof buildMapping>) => (r.reasons ?? []).map((x) => x.text);

describe("buildMapping — 결과 종류", () => {
  it.each(모든상태)("%s 상태는 같은 result 를 돌려준다", (state) => {
    expect(buildMapping(state, 땅콩알레르기).result).toBe(state);
  });

  it("프로필이 없어도 터지지 않는다", () => {
    for (const state of 모든상태) {
      expect(() => buildMapping(state, undefined)).not.toThrow();
    }
  });
});

describe("알레르기는 순위를 깎는 게 아니라 후보에서 뺀다", () => {
  it("땅콩을 알렸으면 땅콩 토핑 닭강정을 빼고 그 이유를 말한다", () => {
    const r = buildMapping("exact", 땅콩알레르기);
    expect(이유문구(r)).toContainEqual(expect.stringContaining("땅콩 알레르기를 알려주셔서"));
    expect(r.item?.displayName).not.toBe("땅콩 토핑 닭강정");
  });

  it("땅콩을 고르지 않았으면 땅콩 문장이 나오지 않는다", () => {
    // CodeRabbit 이 찾은 회귀. 예전에는 알레르기를 말한 적 없는 사람에게도
    // "땅콩 알레르기를 알려주셔서 뺐어요" 가 그대로 나왔다.
    const r = buildMapping("exact", 알레르기없음);
    expect(이유문구(r).join("\n")).not.toContain("땅콩");
  });

  it("품절은 알레르기와 무관하게 항상 빠진다", () => {
    for (const p of [땅콩알레르기, 알레르기없음]) {
      expect(이유문구(buildMapping("exact", p))).toContainEqual(expect.stringContaining("품절 닭강정"));
    }
  });
});

describe("확인 카드는 사용자가 고른 값만 담는다", () => {
  it("고른 값이 그대로 올라간다", () => {
    const opts = buildMapping("exact", 알레르기없음).item?.options ?? [];
    const 표 = Object.fromEntries(opts.map((o) => [o.label, o.value]));
    expect(표).toEqual({
      "이용 방식": "먹고 가기",
      "맵기": "순한맛",
      "형태": "뼈",
      "컵": "일반컵",
      "수량": "2개",
    });
  });

  it("고르지 않은 축은 표에 넣지 않는다", () => {
    const opts = buildMapping("exact", 프로필({ "맵기": ["매운맛"] })).item?.options ?? [];
    expect(opts.map((o) => o.label)).toEqual(["맵기"]);
  });

  it("두 프로필은 서로 다른 메뉴를 답으로 낸다", () => {
    const a = buildMapping("exact", 땅콩알레르기).item?.displayName;
    const b = buildMapping("exact", 알레르기없음).item?.displayName;
    expect(a).toBe("매운 순살 닭강정");
    expect(b).not.toBe(a);
  });
});

describe("못 맞춘 조건을 감추지 않는다", () => {
  it("오늘 없는 조합이면 그렇게 말하고 matched=false 로 표시한다", () => {
    // 순한맛 + 뼈 조합은 오늘 메뉴에 없다.
    const r = buildMapping("exact", 알레르기없음);
    expect(이유문구(r).join("\n")).toContain("오늘은 그 조합이 없어서");
    const 형태 = (r.item?.options ?? []).find((o) => o.label === "형태");
    expect(형태?.matched).toBe(false);
  });

  it("맞은 조건은 matched=true 다", () => {
    const r = buildMapping("exact", 땅콩알레르기);
    const 맵기 = (r.item?.options ?? []).find((o) => o.label === "맵기");
    expect(맵기?.matched).toBe(true);
  });
});

describe("상태별 화면 요건", () => {
  it("clarification 은 후보를 여러 개 주고 상품 ID 를 노출하지 않는다", () => {
    const r = buildMapping("clarification", 땅콩알레르기);
    expect(r.candidates?.length).toBeGreaterThan(1);
    // 키오스크 상품 ID(CHICKEN-00x)가 앱으로 새어 나오면 안 된다. 불투명한 표식만 쓴다.
    for (const c of r.candidates ?? []) {
      expect(c.candidateId).toMatch(/^c\d+$/);
    }
  });

  it("changed 는 달라진 항목을 matched=false 로 짚는다", () => {
    const r = buildMapping("changed", 땅콩알레르기);
    const 컵 = (r.item?.options ?? []).find((o) => o.label === "컵");
    expect(컵?.matched).toBe(false);
    expect(r.diffNote).toContain("종이컵");
  });

  it("not_found 는 사용자가 저장한 이름으로 말한다", () => {
    expect(buildMapping("not_found", 땅콩알레르기).message).toContain("닭강정");
  });
});

describe("결제 경계", () => {
  it("종료 상태는 장바구니까지이고 결제 관련 문구를 만들지 않는다", () => {
    expect(MOCK_CART.handoff).toContain("장바구니");
    expect(JSON.stringify(MOCK_CART)).not.toMatch(/주문 완료|결제 완료|paid|payment/i);
  });

  it("어떤 상태에서도 결제 action 문자열이 응답에 없다", () => {
    for (const state of 모든상태) {
      const s = JSON.stringify(buildMapping(state, 땅콩알레르기));
      expect(s).not.toMatch(/select_payment|confirm_payment|submit_payment|complete_payment|open_payment_method/);
    }
  });
});

describe("MOCK_MENU_NAME", () => {
  it("빈 문자열이 아니다", () => {
    expect(MOCK_MENU_NAME.length).toBeGreaterThan(0);
  });
});
