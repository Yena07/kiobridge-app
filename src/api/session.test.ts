import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrderSheet } from "@/domain/types";
import { 기본도움설정 } from "@/api/a11y";
import { 이어쓰기, type 이어쓸것 } from "./session";

/*
 * 이 파일이 지키는 것 두 가지.
 *
 *   ① 새로고침해도 하던 것이 남는다 — 이 기능을 만든 이유다.
 *   ② 남으면 안 되는 것은 안 남는다 — 연결·승인·비밀번호(P0-2 · P0-4).
 *
 * ② 가 더 중요하다. ① 이 깨지면 사용자가 다시 입력하면 되지만, ② 가 깨지면
 * QR 한 번이 영구 실행 권한이 된다.
 *
 * vitest 기본 환경(node)에는 sessionStorage 가 없다. 실제 브라우저와 같은 모양의
 * 가짜를 끼워 넣는다 — 없는 채로 두면 모든 테스트가 '저장소가 없어서 통과' 한다.
 */
class 가짜저장소 implements Storage {
  private 칸 = new Map<string, string>();
  터뜨릴까 = false;
  /**
   * 이 길이를 넘는 값만 던진다.
   *
   * 0 이면 probe 한 글자까지 같이 막혀서 저장소() 가 null 을 돌려주고, 쓰기() 는
   * 첫 줄에서 반환한다 — 안쪽 try/catch 를 지나가지도 못한다. 실제 브라우저의
   * QuotaExceededError 는 probe 는 통과시키고 본문에서 던지는 쪽이 흔하다.
   */
  터뜨릴길이 = 0;
  get length() { return this.칸.size; }
  clear() { this.칸.clear(); }
  key(i: number) { return [...this.칸.keys()][i] ?? null; }
  getItem(k: string) { return this.칸.get(k) ?? null; }
  removeItem(k: string) { this.칸.delete(k); }
  setItem(k: string, v: string) {
    if (this.터뜨릴까 && v.length > this.터뜨릴길이) throw new Error("QuotaExceededError");
    this.칸.set(k, v);
  }
}

let 저장소: 가짜저장소;
const 원래 = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");

const 끼우기 = (v: unknown) => {
  Object.defineProperty(globalThis, "sessionStorage", { value: v, configurable: true, writable: true });
};

beforeEach(() => {
  저장소 = new 가짜저장소();
  끼우기(저장소);
});

afterEach(() => {
  if (원래) Object.defineProperty(globalThis, "sessionStorage", 원래);
  else 끼우기(undefined);
});

/** 이 파일이 쓰는 유일한 열쇠. 판을 올리면 여기도 같이 바뀐다. */
const 열쇠 = () => 저장소.key(0);
const 적힌것 = () => JSON.parse(저장소.getItem(열쇠()!)!) as Record<string, unknown>;

const 주문표 = (id: string): OrderSheet => ({
  id, menuName: "닭강정", place: "음식점",
  selections: { "이용 방식": ["포장하기"], "맵기": ["매운맛"] },
  memo: "",
});

const 채운값 = (덮을것: Partial<이어쓸것> = {}): 이어쓸것 => ({
  screen: "saved",
  tab: "menu",
  name: "예나",
  account: { userId: 7, loginId: "yena" },
  sheets: [주문표("p1"), 주문표("p2")],
  fromServer: ["p2"],
  a11y: { ...기본도움설정, largeText: true },
  consent: true,
  allergies: [],
  budget: null,
  voiceUsed: false,
  planId: null,
  ...덮을것,
});

describe("이어쓰기 — 새로고침 너머로 잇기", () => {
  it("적어 둔 것이 없으면 null 이다", () => {
    expect(이어쓰기.읽기()).toBeNull();
  });

  it("쓴 것을 그대로 되돌려준다", () => {
    const 값 = 채운값();
    이어쓰기.쓰기(값);
    expect(이어쓰기.읽기()).toEqual(값);
  });

  it("비우면 다음 읽기가 null 이다", () => {
    이어쓰기.쓰기(채운값());
    이어쓰기.비우기();
    expect(이어쓰기.읽기()).toBeNull();
  });
});

describe("남으면 안 되는 것", () => {
  /*
   * 칸 이름을 통째로 못 박는다. toHaveProperty 로 하나씩 빼면 나중에 누가
   * pairingId 를 넣어도 아무 테스트도 안 깨진다. 여기가 깨지면 '무엇을
   * 남기는가' 를 바꾼 것이니, session.ts 의 설명과 개인정보 화면 문구를
   * 같이 고쳤는지 다시 보라는 뜻이다.
   */
  it("적어 두는 칸은 정해진 열두 개뿐이다", () => {
    이어쓰기.쓰기(채운값());
    expect(Object.keys(적힌것()).sort()).toEqual(
      ["a11y", "account", "allergies", "budget", "consent", "fromServer", "name", "planId", "screen", "sheets", "tab", "voiceUsed"],
    );
  });

  it("말로 채웠다는 사실은 새로고침을 넘어 남는다", () => {
    // 계약의 preferredInput 으로 나가는 값이다. 새로고침 한 번에 풀리면 말로 넣은
    // 사람이 "손으로 넣는 사람" 이 되어 키오스크에 전해진다(#99 리뷰).
    이어쓰기.쓰기(채운값({ voiceUsed: true }));
    expect(이어쓰기.읽기()!.voiceUsed).toBe(true);
  });

  it("voiceUsed 가 boolean 이 아니면 안 쓴 것으로 본다", () => {
    저장소.setItem("kb.session.v3", JSON.stringify({ ...채운값(), voiceUsed: "네" }));
    expect(이어쓰기.읽기()!.voiceUsed).toBe(false);
  });

  it("연결 정보는 적어 두더라도 되살리지 않는다", () => {
    // 예전 판이 남아 있거나 누가 손으로 넣은 경우다. 읽는 쪽이 무시해야 한다 —
    // 되살리면 QR 한 번이 새로고침을 넘어 계속 쓰이는 실행 권한이 된다(P0-2).
    저장소.setItem("kb.session.v3", JSON.stringify({
      ...채운값(), pairingId: "pair-1", pairingExpiresAt: 9_999_999_999_999, pairingKiosk: "1번 키오스크",
    }));
    const v = 이어쓰기.읽기()!;
    expect(v).not.toHaveProperty("pairingId");
    expect(v).not.toHaveProperty("pairingExpiresAt");
    expect(v).not.toHaveProperty("pairingKiosk");
  });

  it("승인을 기다리던 화면은 되살리지 않고 목록으로 보낸다", () => {
    // 승인은 살아 있는 연결 위에서만 뜻이 있다(P0-4). 연결을 안 되살리므로
    // 확인 카드를 띄우면 무엇을 승인하는지 알 수 없는 화면이 된다.
    이어쓰기.쓰기(채운값({ screen: "order-confirm" }));
    expect(이어쓰기.읽기()!.screen).toBe("saved");
  });

  it("가입 뒤 도움 설정 화면은 되살린다", () => {
    // 여기서 켠 스위치는 이미 저장돼 있다. 새로고침했다고 처음 화면으로
    // 돌려보내면, 켜 둔 것을 확인하러 다시 세 단계를 밟아야 한다.
    이어쓰기.쓰기(채운값({ screen: "setup" }));
    expect(이어쓰기.읽기()!.screen).toBe("setup");
  });

  it("중간에 끊긴 로그인 절차는 처음 화면으로 보낸다", () => {
    for (const 화면 of ["login", "signup"] as const) {
      이어쓰기.쓰기(채운값({ screen: 화면 }));
      expect(이어쓰기.읽기()!.screen).toBe("welcome");
    }
  });
});

describe("실행 화면", () => {
  it("계획이 있으면 되살린다", () => {
    // 되살린 planId 로 하는 일은 진행 상황을 묻는 GET 하나다. 안 되살리면
    // 키오스크는 움직이는데 앱만 목록으로 돌아가서 지켜볼 수 없게 된다.
    이어쓰기.쓰기(채운값({ screen: "execution", planId: "s1::plan" }));
    const v = 이어쓰기.읽기()!;
    expect(v.screen).toBe("execution");
    expect(v.planId).toBe("s1::plan");
  });

  it("계획이 없으면 실행 화면을 되살리지 않는다", () => {
    이어쓰기.쓰기(채운값({ screen: "execution", planId: null, name: "예나" }));
    expect(이어쓰기.읽기()!.screen).toBe("saved");
  });

  it("실행 화면으로 못 돌아가면 계획도 들고 있지 않는다", () => {
    저장소.setItem("kb.session.v3", JSON.stringify(채운값({ screen: "saved", planId: "s1::plan" })));
    expect(이어쓰기.읽기()!.planId).toBeNull();
  });
});

describe("손댄 값을 믿지 않는다", () => {
  const 망가진것 = (덮을것: Record<string, unknown>) => {
    저장소.setItem("kb.session.v3", JSON.stringify({ ...채운값(), ...덮을것 }));
  };

  it("JSON 이 아니면 버리고 지운다", () => {
    저장소.setItem("kb.session.v3", "{이건 JSON 이 아니다");
    expect(이어쓰기.읽기()).toBeNull();
    // 안 지우면 새로고침할 때마다 같은 자리에서 또 걸린다.
    expect(저장소.getItem("kb.session.v3")).toBeNull();
  });

  it("주문표 한 장이라도 모양이 다르면 통째로 버린다", () => {
    // 반쯤 살린 상태가 가장 나쁘다 — 로그인은 돼 있는데 주문표만 비어 있는
    // 화면을 사용자는 설명할 수 없다.
    망가진것({ sheets: [주문표("p1"), { id: "p2", menuName: "닭강정" }] });
    expect(이어쓰기.읽기()).toBeNull();
  });

  it("아는 장소가 아니면 버린다", () => {
    망가진것({ sheets: [{ ...주문표("p1"), place: "우주정거장" }] });
    expect(이어쓰기.읽기()).toBeNull();
  });

  it("고른 값이 글자 배열이 아니면 버린다", () => {
    망가진것({ sheets: [{ ...주문표("p1"), selections: { "맵기": [{ 알수없는칸: 12 }] } }] });
    expect(이어쓰기.읽기()).toBeNull();
  });

  it("우리가 모르는 칸은 주문표에 들여보내지 않는다", () => {
    /*
     * P0-1. 아는 칸만 골라 새로 만든다 — 상품 ID 나 화면 좌표처럼 프론트가
     * 들고 있으면 안 되는 값이 섞여 들어와도 여기서 떨어진다.
     *
     * 픽스처는 일부러 중립 이름을 쓴다. 걸러 내는 쪽은 흰 목록이라 칸 이름이
     * 무엇이든 같은 길로 간다. 금지된 값의 **모양**을 소스에 적어 두면 그것대로
     * 프론트가 상품 ID 를 다루는 자리가 하나 생기는 셈이다(#96 리뷰).
     */
    망가진것({ sheets: [{ ...주문표("p1"), 알수없는칸: "값", 또다른칸: 120, 세번째칸: 44 }] });
    expect(이어쓰기.읽기()!.sheets[0]).toEqual(주문표("p1"));
  });

  it("userId 가 정수가 아니면 로그인 상태로 되살리지 않는다", () => {
    for (const 나쁜값 of [0, -1, 1.5, "7", null]) {
      망가진것({ account: { userId: 나쁜값, loginId: "yena" } });
      expect(이어쓰기.읽기()!.account).toBeNull();
    }
  });

  it("모르는 화면 이름은 처음 화면으로 보낸다", () => {
    /*
     * 물려받은 키까지 넣어 본다. 대신갈곳 은 객체 리터럴이라
     * 대신갈곳["constructor"] 가 Object 생성자 함수를 돌려주는데, 그게 truthy 라
     * ?? 를 그냥 통과한다. screen 에 함수가 담기면 어느 화면 분기도 안 맞아
     * 빈 화면이 뜨고, 그 값이 다시 저장돼서 새로고침해도 계속 빈 화면이다.
     */
    for (const 나쁜값 of ["관리자화면", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      망가진것({ screen: 나쁜값 });
      const v = 이어쓰기.읽기()!;
      expect(v.screen).toBe("welcome");
      expect(typeof v.screen).toBe("string");
    }
  });

  it("모르는 탭 이름은 메뉴 탭으로 둔다", () => {
    망가진것({ tab: "결재" });
    expect(이어쓰기.읽기()!.tab).toBe("menu");
  });

  it("목록에 없는 id 는 '서버에서 온 것' 에서 뺀다", () => {
    // 남겨 두면 로그아웃이 있지도 않은 주문표를 빼려 든다.
    망가진것({ fromServer: ["p2", "없는id"] });
    expect(이어쓰기.읽기()!.fromServer).toEqual(["p2"]);
  });

  it("접근성은 boolean 인 칸만 받고 나머지는 기본값이다", () => {
    망가진것({ a11y: { largeText: true, highContrast: "예", 없는칸: true } });
    expect(이어쓰기.읽기()!.a11y).toEqual({ ...기본도움설정, largeText: true });
  });

  it("안내 언어도 이어 쓰되, 아는 값일 때만 받는다", () => {
    이어쓰기.쓰기(채운값({ a11y: { ...기본도움설정, language: "en-US" } }));
    expect(이어쓰기.읽기()!.a11y.language).toBe("en-US");
    // 손대서 아무 문자열이나 넣어 두면 서버의 BCP 47 검사에 걸려 주문이 안 된다.
    // zh-CN·vi-VN 은 예전에 목록에 있던 값이다. 화면이 실제로 그 언어가 되지
    // 않아 뺐으므로, 남아 있던 세션에서 되살아나면 안 된다.
    for (const 나쁜값 of ["ja-JP", "zh-CN", "vi-VN", "아무거나", "", 1, null, true]) {
      망가진것({ a11y: { ...기본도움설정, language: 나쁜값 } });
      expect(이어쓰기.읽기()!.a11y.language).toBe("ko-KR");
    }
  });

  it("소리 안내도 이어 쓴다", () => {
    // 새로고침 한 번에 조용해지면, 켠 사람은 자기가 끈 줄 알고 다시 들어와 확인한다.
    이어쓰기.쓰기(채운값({ a11y: { ...기본도움설정, voiceGuide: true } }));
    expect(이어쓰기.읽기()!.a11y.voiceGuide).toBe(true);
  });

  it("가격 한도가 양의 정수가 아니면 안 정한 것으로 본다", () => {
    // 계약이 minimum: 0 인 number 다. 음수를 넣어 두면 서버가 400 으로 되돌려서
    // 한 칸 잘못된 값 때문에 주문 자체가 안 된다.
    for (const 나쁜값 of [-1000, 0, 5500.5, "6000", null, true]) {
      망가진것({ budget: 나쁜값 });
      expect(이어쓰기.읽기()!.budget).toBeNull();
    }
  });

  it("동의는 boolean true 일 때만 받는다", () => {
    /*
     * 손댄 값으로 동의를 만들지 않는다. "true" · 1 · {} 는 자바스크립트에서 truthy 라,
     * 값이 있는지만 보면 개인정보 동의를 문자열 하나로 만들어 낼 수 있다.
     */
    for (const 나쁜값 of ["true", 1, {}, [], "예"]) {
      망가진것({ consent: 나쁜값 });
      expect(이어쓰기.읽기()!.consent).toBe(false);
    }
    망가진것({ consent: true });
    expect(이어쓰기.읽기()!.consent).toBe(true);
  });

  it("알레르기는 아는 여섯만 받는다", () => {
    /*
     * 모르는 값이 섞이면 canonical 이 UNKNOWN 으로 옮기고, 서버는 그걸
     * '확인 못 한 절대 조건' 으로 보고 주문을 아예 막는다. 손댄 값 하나로
     * 주문 자체가 안 되게 만들지 않는다.
     */
    망가진것({ allergies: ["PEANUT", "메밀", "BUCKWHEAT", 1, null, "SHRIMP"] });
    expect(이어쓰기.읽기()!.allergies).toEqual(["PEANUT", "SHRIMP"]);
  });

  it("알레르기를 골라 두면 그대로 되살린다", () => {
    이어쓰기.쓰기(채운값({ allergies: ["PEANUT", "MILK"] }));
    expect(이어쓰기.읽기()!.allergies).toEqual(["PEANUT", "MILK"]);
  });

  it("가격 한도를 정해 두면 그대로 되살린다", () => {
    // 조용히 풀리면 아까 안 보이던 메뉴가 갑자기 보이고 사용자는 이유를 알 수 없다.
    이어쓰기.쓰기(채운값({ budget: 8000 }));
    expect(이어쓰기.읽기()!.budget).toBe(8000);
  });
});

describe("남길 것이 없으면 아무것도 안 쓴다", () => {
  const 빈값 = 채운값({
    screen: "welcome", tab: "menu", name: "", account: null,
    sheets: [], fromServer: [], a11y: { ...기본도움설정 },
    consent: false, allergies: [], budget: null, planId: null,
  });

  it("빈 이용은 저장하지 않는다", () => {
    이어쓰기.쓰기(빈값);
    expect(저장소.length).toBe(0);
  });

  it("지운 뒤에 한 번 더 쓰여도 되살아나지 않는다", () => {
    // 로그아웃·정보 지우기 뒤에 저장 효과가 한 번 더 돈다. 그때 빈 껍데기를
    // 새로 써 두면 화면은 "모두 지워요" 라고 말해 놓고 저장소에는 남는다.
    이어쓰기.쓰기(채운값());
    이어쓰기.비우기();
    이어쓰기.쓰기(빈값);
    expect(저장소.length).toBe(0);
    expect(이어쓰기.읽기()).toBeNull();
  });

  it("호칭만 적어 두어도 남긴다", () => {
    이어쓰기.쓰기({ ...빈값, name: "예나" });
    expect(이어쓰기.읽기()!.name).toBe("예나");
  });

  it("언어를 바꿔 두어도 남긴다", () => {
    이어쓰기.쓰기({ ...빈값, a11y: { ...기본도움설정, language: "en-US" } });
    expect(이어쓰기.읽기()!.a11y.language).toBe("en-US");
  });

  it("언어가 기본값이면 남길 것으로 세지 않는다", () => {
    // "ko-KR" 은 truthy 라, 값이 있는지만 보면 아무것도 안 건드린 사람도
    // 저장 대상이 된다. 켠 것과 고른 것을 나눠 봐야 한다.
    이어쓰기.쓰기({ ...빈값, a11y: { ...기본도움설정, language: "ko-KR" } });
    expect(저장소.length).toBe(0);
  });

  it("접근성만 켜 두어도 남긴다", () => {
    이어쓰기.쓰기({ ...빈값, a11y: { ...기본도움설정, largeText: true } });
    expect(이어쓰기.읽기()!.a11y.largeText).toBe(true);
  });
});

describe("저장소를 못 쓰는 곳에서도 앱이 멈추지 않는다", () => {
  it("sessionStorage 가 아예 없어도 던지지 않는다", () => {
    끼우기(undefined);
    expect(() => 이어쓰기.쓰기(채운값())).not.toThrow();
    expect(() => 이어쓰기.비우기()).not.toThrow();
    expect(이어쓰기.읽기()).toBeNull();
  });

  it("쓰기가 막혀도 던지지 않는다", () => {
    // 사생활 모드나 저장 공간이 꽉 찬 경우다. 이어 쓰기는 편의지
    // 이 앱이 하는 일이 아니라서, 안 되면 그냥 메모리로만 간다.
    저장소.터뜨릴까 = true;
    // probe 는 통과시킨다. 안 그러면 위의 '저장소가 아예 없는' 시험과 같은 길을 간다.
    저장소.터뜨릴길이 = 8;
    expect(() => 이어쓰기.쓰기(채운값())).not.toThrow();
    expect(이어쓰기.읽기()).toBeNull();
  });
});
