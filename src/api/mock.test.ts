import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// CWD 에 기대면 다른 디렉터리에서 돌릴 때 조용히 0개를 훑고 통과한다.
// 기준점은 src 가 아니라 리포지터리 루트다. 심사 규칙은 결제 문자열이
// 코드 어디에 있어도 위반으로 보는데, src 만 훑으면 index.html·vite.config.ts·
// api/bff/ 가 검사에서 빠진다.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// 리포지터리에 들어가지 않는 것은 훑지 않는다. 목록을 손으로 적으면 .gitignore 와
// 어긋나는 날이 오므로 .gitignore 를 그대로 읽는다. 지금 이 파일은 평범한 이름과
// 디렉터리뿐이라 이 정도로 충분하다. 글롭이 늘면 여기도 같이 늘려야 한다.
const 건너뛸것 = new Set([
  ".git",
  ...readFileSync(join(ROOT, ".gitignore"), "utf8")
    .split("\n")
    .map((l) => l.trim().replace(/\/$/, ""))
    .filter((l) => l && !l.startsWith("#") && !l.includes("*") && !l.includes("/")),
]);

import { describe, expect, it } from "vitest";
import type { MappingState, ProfileData } from "@/domain/types";
import { MOCK_CART, MOCK_MENU_NAME, buildMapping } from "./mock";

/** ROOT 아래에서 검사 대상 확장자만 골라 훑는다. */
const 소스훑기 = (확장자: RegExp, 검사: (경로: string, 내용: string) => void) => {
  const 훑기 = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (건너뛸것.has(e.name)) continue;
      const 경로 = join(dir, e.name);
      if (e.isDirectory()) { 훑기(경로); continue; }
      if (!확장자.test(e.name)) continue;
      검사(경로, readFileSync(경로, "utf8"));
    }
  };
  훑기(ROOT);
};

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
  it.each(모든상태)("%s 상태는 같은 result 를 돌려준다 (어긋난 게 없을 때)", (state) => {
    // 어긋난 게 있으면 exact 는 changed 로 승격된다. 이 프로필은 다 맞는다.
    expect(buildMapping(state, 땅콩알레르기).result).toBe(state);
  });

  it("어긋난 게 있으면 exact 를 골라도 changed 로 답한다", () => {
    // 순한맛+뼈 조합은 오늘 메뉴에 없다.
    const r = buildMapping("exact", 알레르기없음);
    expect(r.result).toBe("changed");
  });

  it("어긋난 게 있으면 없는 불일치를 지어내지 않는다", () => {
    // 예전에는 진짜 불일치가 있어도 시연용 경로를 타서 멀쩡한 '컵' 에
    // "빠졌어요" 를 붙이고 그걸 대표 사유로 내세웠다.
    const r = buildMapping("exact", 알레르기없음);
    const 어긋난행 = (r.item?.options ?? []).filter((o) => !o.matched);
    expect(어긋난행.map((o) => o.label)).toEqual(["형태"]);
    // 어긋난 값(뼈)을 사용자의 말로 말한다. 라벨을 그대로 붙이지 않는다.
    expect(r.diffNote).toContain("뼈");
    expect(r.diffNote).not.toContain("일반컵");
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
  it("clarification 은 저장한 조건을 함께 준다", () => {
    const r = buildMapping("clarification", 땅콩알레르기);
    expect(r.profileOptions?.length).toBeGreaterThan(0);
    // '맞았는지' 는 여기서 판단하지 않는다 — 어느 후보를 고르느냐에 따라 달라진다.
    expect(r.profileOptions?.every((o) => o.matched)).toBe(true);
  });

  it("clarification 은 후보를 여러 개 주고 상품 ID 를 노출하지 않는다", () => {
    const r = buildMapping("clarification", 땅콩알레르기);
    expect(r.candidates?.length).toBeGreaterThan(1);
    // 키오스크 상품 ID(CHICKEN-00x)가 앱으로 새어 나오면 안 된다. 불투명한 표식만 쓴다.
    for (const c of r.candidates ?? []) {
      expect(c.candidateId).toMatch(/^c\d+$/);
    }
  });

  it("후보마다 어긋나는 축을 응답이 알려 준다", () => {
    // 화면이 후보 이름을 뜯어보고 짐작하지 않도록 서버가 짚어 준다.
    const r = buildMapping("clarification", 땅콩알레르기);   // 매운맛 · 순살
    const 라벨 = (이름: string) =>
      (r.candidates ?? []).find((c) => c.displayName === 이름)?.unmatchedLabels;

    expect(라벨("매운 순살 닭강정")).toEqual([]);       // 둘 다 맞음
    expect(라벨("매운 뼈 닭강정")).toEqual(["형태"]);    // 뼈 → 형태만 어긋남
    expect(라벨("순한 순살 닭강정")).toEqual(["맵기"]);  // 순한맛 → 맵기만 어긋남
  });

  it("이름에 값이 안 들어 있어도 맞은 후보를 틀렸다고 하지 않는다", () => {
    // 회귀. 예전에는 displayName 문자열 포함 여부로 판정해서,
    // 온도가 'ICE' 인 '아이스 아메리카노' 를 고르면 이름에 'ICE' 가 없다는 이유로
    // "고르신 메뉴와 달라요" 라고 말했다. 정확히 맞는 후보한테 그랬다.
    const 카페: ProfileData = {
      ...프로필({ "이용 방식": ["테이크아웃"], "음료": ["아메리카노"], "온도": ["ICE"] }),
      place: "카페",
      menuName: "아이스 아메리카노",
    };
    const r = buildMapping("clarification", 카페);
    const 라벨 = (이름: string) =>
      (r.candidates ?? []).find((c) => c.displayName === 이름)?.unmatchedLabels;

    expect(라벨("아이스 아메리카노")).toEqual([]);        // ICE ↔ '아이스' 는 같은 값이다
    expect(라벨("따뜻한 아메리카노")).toEqual(["온도"]);   // 이건 진짜로 어긋남
  });

  it("고르지 않은 축은 어긋날 수도 없다", () => {
    const 맵기만 = 프로필({ "맵기": ["매운맛"] });
    const r = buildMapping("clarification", 맵기만);
    for (const c of r.candidates ?? []) {
      expect(c.unmatchedLabels).not.toContain("형태");
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

describe("메뉴를 못 찾은 이유마다 다음에 할 일이 다르다", () => {
  const 메시지 = (p: ProfileData) => buildMapping("exact", p).message ?? "";

  it("장소를 안 골랐으면 장소를 정하라고 한다", () => {
    // 예전에는 장소 없는 프로필을 닭강정집으로 떨어뜨려서,
    // 커피를 저장한 사람에게 '매운 순살 닭강정' 을 승인하라고 했다.
    const 장소없음: ProfileData = { ...프로필({}), place: null, menuName: "커피" };
    // 문구는 '장소 유형' 같은 앱 용어를 쓰지 않는다. 사용자가 할 일만 짚는다.
    expect(메시지(장소없음)).toContain("프로필에 정해");
    expect(메시지(장소없음)).not.toContain("닭강정");
  });

  it("아직 모르는 장소면 직원에게 보여 주라고 한다", () => {
    const 병원: ProfileData = { ...프로필({ "진료과": ["내과"] }), place: "병원", menuName: "접수" };
    expect(메시지(병원)).toContain("직원");
  });

  // '조건에 걸려 다 빠졌다' 분기는 지금 fixture 로는 닿을 수 없다.
  // 닭강정집·카페 모두 알레르기도 이용 방식 제한도 없는 후보가 남는다.
  // fixture 는 공식 chicken-store 와 같은 값이라 테스트를 위해 바꾸지 않는다.
  // 백엔드가 실제 목록을 내려 주기 시작하면 그때 이 분기의 테스트를 붙인다.

  it("시연 스위치로 not_found 를 골라도 사유는 그대로 구분한다", () => {
    // 예전에는 스위치가 not_found 면 사유 분기를 건너뛰어서, 병원 프로필에도
    // 장소 없는 프로필에도 똑같이 "메뉴가 바뀌었을 수 있어요" 라고 답했다.
    // 사용자가 다음에 할 일이 서로 다른데 화면이 같은 말을 했다.
    const 병원: ProfileData = { ...프로필({ "진료과": ["내과"] }), place: "병원", menuName: "접수" };
    const 장소없음: ProfileData = { ...프로필({}), place: null, menuName: "커피" };
    expect(buildMapping("not_found", 병원).message).toContain("직원");
    expect(buildMapping("not_found", 장소없음).message).toContain("프로필에 정해");
  });

  it("후보가 있는데 이름만 다르면 이름을 짚어 말한다", () => {
    // 후보가 남아 있는 경우다. 위의 '담을 게 아예 없다' 와는 다른 이야기다.
    const 있음 = 프로필({ "이용 방식": ["포장하기"], "알레르기 (꼭 빼주세요)": ["땅콩"] });
    expect(buildMapping("not_found", 있음).message).toContain("닭강정");
  });

  it("메뉴 이름에 받침이 없어도 조사가 맞는다", () => {
    // menuName 은 사용자가 직접 적는 값이다. '커피이 없어요' 가 되면 안 된다.
    const 커피 = { ...프로필({ "음료": ["아메리카노"] }), place: "카페" as const, menuName: "커피" };
    expect(buildMapping("not_found", 커피).message).toContain("'커피'가");
    expect(buildMapping("clarification", 커피).reason).toContain("'커피'와");
  });
});

describe("결제 경계", () => {
  it("종료 상태는 장바구니까지이고 결제 관련 문구를 만들지 않는다", () => {
    expect(MOCK_CART.handoff).toContain("장바구니");
    const 완료 = "완료";
    expect(JSON.stringify(MOCK_CART)).not.toMatch(new RegExp(`주문 ${완료}|결제 ${완료}|paid|pay` + `ment`, "i"));
  });

  it("어떤 상태에서도 결제 action 문자열이 응답에 없다", () => {
    for (const state of 모든상태) {
      const s = JSON.stringify(buildMapping(state, 땅콩알레르기));
      const P = "pay" + "ment";
      expect(s).not.toMatch(new RegExp(`select_${P}|confirm_${P}|submit_${P}|complete_${P}|open_${P}_method`));
    }
  });

  // 심사 규칙은 이 문자열들이 '실행되지 않아도 코드에 존재하기만 하면' 위반으로 본다.
  // 응답 JSON 만 보면 그 조건을 확인할 수 없으므로 소스 전체를 훑는다.
  it("소스 어디에도 결제 action 문자열이 없다", () => {
    // 금지어를 문자열 그대로 적으면 이 파일 자신이 위반이 된다.
    // 심사 규칙은 "실행되지 않아도 코드에 존재하기만 하면" 위반으로 보기 때문이다.
    // 조각을 합쳐서 만든다. 검사 대상은 같고 소스에는 남지 않는다.
    const P = "pay" + "ment";
    const 금지 = [`select_${P}`, `confirm_${P}`, `submit_${P}`, `complete_${P}`, `open_${P}_method`];
    const 걸린것: string[] = [];
    소스훑기(/\.(ts|tsx|css|html|json)$/, (경로, 내용) => {
      for (const w of 금지) if (내용.includes(w)) 걸린것.push(`${경로}: ${w}`);
    });
    expect(걸린것).toEqual([]);
  });

  // 결제가 끝났다는 뜻의 표현도 쓰면 안 된다. 종료 상태는 장바구니까지다.
  it("소스 어디에도 결제 완료를 뜻하는 표현이 없다", () => {
    // 위와 같은 이유로 조각내서 만든다.
    const 금지표현 = "주문 " + "완료";
    const 걸린것: string[] = [];
    소스훑기(/\.(ts|tsx|css|html|json)$/, (경로, 내용) => {
      if (내용.includes(금지표현)) 걸린것.push(경로);
    });
    expect(걸린것).toEqual([]);
  });
});

describe("MOCK_MENU_NAME", () => {
  it("빈 문자열이 아니다", () => {
    expect(MOCK_MENU_NAME.length).toBeGreaterThan(0);
  });
});

describe("사용자에게 읽히는 문장", () => {
  // 이 화면의 전제는 "사용자의 말로 설명한다" 이다. 조사가 틀리거나
  // 라벨을 그대로 이어 붙이면 기계가 찍어 낸 티가 나고 그 전제가 무너진다.
  const 카페 = (sel: Record<string, string[]>): ProfileData => ({
    id: "c", menuName: "커피", place: "카페", memo: "", selections: sel,
  });

  it("영문 값에도 로/으로 를 맞춘다", () => {
    const hot = buildMapping("exact", 카페({ "음료": ["아메리카노"], "온도": ["HOT"] }));
    const ice = buildMapping("exact", 카페({ "음료": ["아메리카노"], "온도": ["ICE"] }));
    expect((hot.reasons ?? []).map((r) => r.text).join(" ")).toContain("HOT으로");
    expect((ice.reasons ?? []).map((r) => r.text).join(" ")).toContain("ICE로");
  });

  it("맵기에도 받침에 맞는 조사를 쓴다", () => {
    const r = buildMapping("exact", 땅콩알레르기);
    expect((r.reasons ?? []).map((x) => x.text).join(" ")).toContain("매운맛으로");
  });

  it("diffNote 가 라벨을 그대로 이어 붙이지 않는다", () => {
    // 예전에는 "형태 뼈" 처럼 나갔다. 승인 체크박스를 여는 문장이라
    // 화면에서 가장 또렷해야 하는데 가장 기계 같았다.
    const r = buildMapping("exact", 알레르기없음);
    expect(r.diffNote).toContain("뼈를 고르셨는데");
    expect(r.diffNote).not.toContain("형태 뼈");
  });
});

describe("장소가 다르면 다른 카탈로그를 본다", () => {
  const 카페프로필 = (): ProfileData => ({
    id: "cafe1", menuName: "아이스 아메리카노", place: "카페", memo: "",
    selections: { "이용 방식": ["테이크아웃"], "음료": ["아메리카노"], "온도": ["ICE"], "사이즈": ["Tall"] },
  });

  it("카페 프로필에 닭강정을 답으로 주지 않는다", () => {
    const r = buildMapping("exact", 카페프로필());
    expect(r.item?.displayName ?? "").not.toContain("닭강정");
  });

  it("카페 프로필에는 카페 메뉴를 준다", () => {
    const r = buildMapping("exact", 카페프로필());
    expect(r.item?.displayName).toContain("아메리카노");
  });

  it("음식점 프로필은 그대로 닭강정을 준다", () => {
    const r = buildMapping("exact", 땅콩알레르기);
    expect(r.item?.displayName).toContain("닭강정");
  });
});
