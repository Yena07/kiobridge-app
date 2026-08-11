import type { MainTab, OrderSheet, PlaceType, Screen } from "@/domain/types";
import { 기본도움설정, type 도움설정 } from "@/api/a11y";
import type { Account } from "@/api/account";

/**
 * 새로고침해도 이번 이용이 이어지도록.
 *
 * 예전에는 전부 메모리에만 있어서, 실수로 F5 를 누르거나 휴대폰이 탭을 잠깐 내렸다
 * 올리기만 해도 로그인이 풀리고 주문표가 사라지고 큰 글씨가 꺼졌다. 처음부터 다시
 * 하라는 뜻인데, 이 앱을 쓰는 사람에게 '처음부터 다시' 가 가장 어렵다.
 *
 * ── 왜 sessionStorage 인가 ───────────────────────────────────────────────────
 *
 *   localStorage      탭을 닫아도 남는다. 다음에 이 기기를 켠 사람이 앞사람 것을 본다.
 *   sessionStorage    이 탭에만 있고, 탭을 닫으면 사라진다.
 *
 * 개인정보 안내 화면이 "이번 이용이 끝나면 남지 않아요" 라고 약속하고 있다.
 * sessionStorage 는 그 약속을 그대로 지킨다 — 탭을 닫는 것이 곧 이용이 끝나는
 * 것이다. localStorage 로 옮기면 그 문장이 거짓이 되므로 옮기지 말 것.
 *
 * ── 담지 않는 것 ─────────────────────────────────────────────────────────────
 *
 *   비밀번호            어디에도 남기지 않는다. 목의 계정 Map 도 메모리에 그대로 둔다.
 *   pairingId·만료      키오스크를 움직일 수 있는 권한이다. 디스크에 적어 두고 되살리면
 *                      QR 한 번이 영구 실행 권한이 된다(P0-2). 다시 찍어야 한다.
 *   orderSheet·승인     승인은 살아 있는 연결 위에서만 뜻이 있다(P0-4).
 *   연동 기록           서버와 오간 본문이 들어 있다. 확인용 화면이라 메모리로 충분하다.
 *
 * planId 만 예외다. 이유는 아래 `planId` 주석에 적었다.
 */

/** 판을 바꾸면 이 번호를 올린다. 예전 판은 읽지 않고 버린다. */
const KEY = "kb.session.v3";

/**
 * 새로고침 뒤에도 그대로 보여 줄 수 있는 화면.
 *
 * 여기 없는 화면은 되살리지 않는다. 되살릴 근거(연결·인증 절차)가 같이
 * 남아 있지 않아서, 화면만 띄우면 빈 껍데기가 된다.
 */
const 이어볼수있는화면 = new Set<Screen>([
  "welcome", "name", "setup", "greeting", "sheet", "saved", "a11y", "privacy", "execution",
]);

/**
 * 되살릴 수 없는 화면을 어디로 보낼지.
 *
 * 그냥 welcome 으로 몰면 로그인한 사람도 처음 화면으로 튕긴다. 무엇을 하다 말았는지에
 * 따라 갈 곳이 다르다.
 */
const 대신갈곳: Partial<Record<Screen, Screen>> = {
  // 아이디도 비밀번호도 남기지 않는다. 중간에 끊긴 절차라 처음으로 돌린다.
  login: "welcome",
  signup: "welcome",
  // 연결을 되살리지 않으므로 확인 카드는 보여 줄 내용이 없다. 목록으로 보낸다.
  "order-confirm": "saved",
};

const 장소들: PlaceType[] = ["카페", "음식점", "병원", "관공서", null];
const 탭들: MainTab[] = ["qr", "menu", "account"];

export interface 이어쓸것 {
  screen: Screen;
  tab: MainTab;
  /** 부르는 호칭. 화면에 띄우는 데만 쓰고 이 기기 밖으로 나가지 않는다. */
  name: string;
  /** 로그인한 계정. 토큰이 아니라 식별자다(account.ts 의 1번 주석). */
  account: Account | null;
  sheets: OrderSheet[];
  /** 서버에서 불러온 주문표의 id. 로그아웃할 때 이것만 목록에서 뺀다. */
  fromServer: string[];
  /** 도움 설정. 킷의 일곱 칸 + 소리 안내. */
  a11y: 도움설정;
  /**
   * 이번 이용의 가격 한도(원). 안 정했으면 null 이다.
   *
   * 오래 붙들 값이 아니라 "오늘은 얼마까지" 라서 이번 이용에만 둔다. 다만 새로고침
   * 한 번에 풀리면 안 된다 — 한도를 넘는 메뉴는 후보에서 빠지므로, 조용히 풀리면
   * 아까 안 보이던 메뉴가 갑자기 보이고 사용자는 이유를 알 수 없다.
   */
  budget: number | null;
  /**
   * 실행 중인 계획.
   *
   * 연결(pairingId)은 안 남기는데 이것만 남기는 이유는, 이 값으로 하는 일이
   * 읽기뿐이라서다. getPlanStatus 는 GET 이고, 계획을 새로 만들거나 실행하지
   * 않는다 — 그건 승인 버튼에서만 일어난다(P0-4). 되살린 값으로는 새 승인도
   * 못 한다. 연결이 없기 때문이다.
   *
   * 안 남기면 더 나쁘다. 키오스크는 계속 움직이는데 앱만 목록 화면으로 돌아가서,
   * 사용자는 자기 주문이 어떻게 됐는지 볼 방법이 없어진다. 지켜보라고 만든
   * 화면인데 지켜볼 수 없게 되는 것이다.
   */
  planId: string | null;
}

/**
 * 쓸 수 있는 저장소인지 실제로 써 보고 판단한다.
 *
 * Safari 사생활 모드는 sessionStorage 객체를 주고도 setItem 에서 던진다.
 * 있는지만 보면 통과하고 쓸 때 터진다. 저장은 있으면 좋은 것이지 없으면
 * 앱이 멈춰야 하는 것이 아니므로, 안 되면 조용히 없는 셈 친다.
 */
const 저장소 = (): Storage | null => {
  try {
    const s = globalThis.sessionStorage;
    const 시험 = `${KEY}::probe`;
    s.setItem(시험, "1");
    s.removeItem(시험);
    return s;
  } catch {
    return null;
  }
};

const 글자인가 = (v: unknown): v is string => typeof v === "string";

/**
 * 저장된 주문표가 우리가 아는 모양인지 본다.
 *
 * sessionStorage 는 사용자가 개발자 도구로 고칠 수 있다. 고친 값을 그대로 믿으면
 * 화면이 알 수 없는 것을 그리거나, P0-1 이 금지한 상품 ID 같은 것이 주문표에
 * 섞여 들어온다. 우리가 아는 칸만 골라 새 객체를 만든다 — 모르는 칸은 버린다.
 */
const 주문표읽기 = (v: unknown): OrderSheet | null => {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!글자인가(o.id) || o.id === "") return null;
  if (!글자인가(o.menuName)) return null;
  if (!장소들.includes(o.place as PlaceType)) return null;
  if (!글자인가(o.memo)) return null;
  if (typeof o.selections !== "object" || o.selections === null) return null;
  const selections: Record<string, string[]> = {};
  for (const [축, 값] of Object.entries(o.selections as Record<string, unknown>)) {
    if (!Array.isArray(값) || !값.every(글자인가)) return null;
    selections[축] = [...(값 as string[])];
  }
  return { id: o.id, menuName: o.menuName, place: o.place as PlaceType, selections, memo: o.memo };
};

const 계정읽기 = (v: unknown): Account | null => {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  // userId 는 경로에 들어가는 값이다. 정수가 아니면 요청 자체를 만들지 않는다.
  if (typeof o.userId !== "number" || !Number.isInteger(o.userId) || o.userId <= 0) return null;
  if (!글자인가(o.loginId) || o.loginId === "") return null;
  return { userId: o.userId, loginId: o.loginId };
};

/** 여덟 칸을 하나씩 본다. boolean 이 아닌 칸은 기본값으로 둔다. */
const 접근성읽기 = (v: unknown): 도움설정 => {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const 값 = { ...기본도움설정 };
  for (const 칸 of Object.keys(기본도움설정) as (keyof 도움설정)[]) {
    if (typeof o[칸] === "boolean") 값[칸] = o[칸];
  }
  return 값;
};

/**
 * 이 사람에 대해 남길 것이 하나라도 있는가.
 *
 * screen·tab 은 세지 않는다. 그 둘만 남은 것은 '아무것도 안 한 사람이 어느 화면에
 * 있었다' 는 뜻이라, 다음에 되살릴 값어치가 없다.
 */
const 남길것이있나 = (v: 이어쓸것): boolean =>
  v.account !== null
  || v.name !== ""
  || v.sheets.length > 0
  || v.planId !== null
  || v.budget !== null
  || Object.values(v.a11y).some(Boolean);

export const 이어쓰기 = {
  /**
   * 저장해 둔 이용을 읽는다. 없거나 모양이 다르면 null 이다.
   *
   * 한 칸이라도 이상하면 통째로 버린다. 반쯤 살린 상태가 가장 다루기 어렵다 —
   * 로그인은 돼 있는데 주문표는 비어 있는 화면을 사용자는 설명할 수 없다.
   */
  읽기(): 이어쓸것 | null {
    const s = 저장소();
    if (!s) return null;
    let 날것: unknown;
    try {
      const 글 = s.getItem(KEY);
      if (!글) return null;
      날것 = JSON.parse(글);
    } catch {
      // 판이 바뀌었거나 누가 손을 댔다. 남겨 두면 다음 새로고침마다 또 터진다.
      this.비우기();
      return null;
    }
    if (typeof 날것 !== "object" || 날것 === null) { this.비우기(); return null; }
    const o = 날것 as Record<string, unknown>;

    const account = 계정읽기(o.account);
    const sheets: OrderSheet[] = [];
    if (Array.isArray(o.sheets)) {
      for (const 하나 of o.sheets) {
        const p = 주문표읽기(하나);
        if (!p) { this.비우기(); return null; }
        sheets.push(p);
      }
    }
    const 아는id = new Set(sheets.map((p) => p.id));
    const fromServer = Array.isArray(o.fromServer)
      // 목록에 없는 id 는 버린다. 남겨 두면 로그아웃이 있지도 않은 것을 빼려 든다.
      ? o.fromServer.filter((x): x is string => 글자인가(x) && 아는id.has(x))
      : [];

    const 적힌화면 = 글자인가(o.screen) ? (o.screen as Screen) : "welcome";
    const planId = 글자인가(o.planId) && o.planId !== "" ? o.planId : null;
    // 계획이 없으면 실행 화면을 되살릴 수 없다. 띄워 봐야 물어볼 곳이 없다.
    const 실행못함 = 적힌화면 === "execution" && !planId;
    const screen: Screen = !실행못함 && 이어볼수있는화면.has(적힌화면)
      ? 적힌화면
      : (대신갈곳[적힌화면] ?? (실행못함 ? "saved" : "welcome"));

    return {
      screen,
      tab: 탭들.includes(o.tab as MainTab) ? (o.tab as MainTab) : "menu",
      name: 글자인가(o.name) ? o.name : "",
      account,
      sheets,
      fromServer,
      a11y: 접근성읽기(o.a11y),
      // 계약이 minimum: 0 인 number 다. 양의 정수가 아니면 안 정한 것으로 본다 —
      // 손대서 음수를 넣어 두면 서버가 400 으로 되돌려서 주문 자체가 안 된다.
      budget: typeof o.budget === "number" && Number.isInteger(o.budget) && o.budget > 0
        ? o.budget : null,
      // 실행 화면으로 돌아가지 못하면 계획도 들고 있을 이유가 없다.
      planId: screen === "execution" ? planId : null,
    };
  },

  /**
   * 이번 이용을 적어 둔다.
   *
   * 남길 것이 하나도 없으면 아예 지운다. '이 기기에서 정보 지우기' 를 누른 직후에도
   * 이 함수가 한 번 더 불리는데, 그때 빈 껍데기를 새로 써 두면 화면은 "모두 지워요"
   * 라고 말해 놓고 저장소에는 우리가 쓴 항목이 남는다. 안에 아무것도 없더라도
   * 지웠다고 한 뒤에 다시 쓰는 것은 앞뒤가 안 맞는다.
   *
   * 실패해도 던지지 않는다. 저장 공간이 꽉 찼다고 주문이 멈추면 안 된다 —
   * 이어 쓰기는 편의지 이 앱이 하는 일이 아니다.
   */
  쓰기(값: 이어쓸것): void {
    const s = 저장소();
    if (!s) return;
    if (!남길것이있나(값)) { this.비우기(); return; }
    try {
      s.setItem(KEY, JSON.stringify(값));
    } catch {
      /* 꽉 찼거나 막혔다. 이번 이용은 메모리로만 간다. */
    }
  },

  /** 로그아웃·정보 지우기가 부른다. 화면이 "지웠어요" 라고 말한 것에 이것도 들어간다. */
  비우기(): void {
    try {
      globalThis.sessionStorage?.removeItem(KEY);
    } catch {
      /* 못 지웠으면 어차피 쓴 적도 없다. */
    }
  },
};
