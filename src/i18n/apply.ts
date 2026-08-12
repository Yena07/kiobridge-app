import { EN } from "@/i18n/en";

/**
 * 그려진 화면의 우리말을 고른 언어로 바꾼다.
 *
 * ── 왜 이렇게 하나 ─────────────────────────────────────────────────────────
 *
 * 흔한 방법은 화면 코드의 문장마다 `t("...")` 를 두르는 것이다. 이 앱은 화면에
 * 나가는 우리말이 600줄 가까이 되고, 그 문장들이 App.tsx 한 파일에 흩어져 있다.
 * 손으로 두르면 빠뜨리는 자리가 생기고, **빠뜨린 자리는 화면을 열어 보기 전까지
 * 아무도 모른다.** 반쯤 영어인 화면은 한국어 화면보다 나쁘다.
 *
 * 그래서 그린 뒤에 한 번에 바꾼다. 빠뜨릴 자리가 없고, 무엇이 안 바뀌었는지
 * 화면에서 바로 보인다(아래 `안바뀐것`).
 *
 * ── 안전한 이유 ────────────────────────────────────────────────────────────
 *
 * **글자만 만진다.** 주문표에 저장되는 값(selections)도, 서버로 나가는 값도
 * 건드리지 않는다 — 저 둘은 계속 우리말이다. canonical.ts 가 그 우리말을 enum
 * 으로 옮기고 있어서, 저장값을 건드리면 매핑이 통째로 깨진다.
 *
 * 표에 **정확히 같은 문장**이 있을 때만 바꾼다. 부분 일치로 자르지 않으므로
 * 사용자가 적은 메뉴 이름이나 메모가 뒤섞일 일이 없다.
 *
 * ── 못 하는 것 ─────────────────────────────────────────────────────────────
 *
 * 값이 끼는 문장은 글자 조각으로 쪼개져 들어온다. `반가워요, {name}님!` 은
 * "반가워요, " 와 "님!" 두 조각이라 표와 안 맞는다. 그런 자리는 조각째 표에
 * 넣어 두었다. 새로 생기면 `안바뀐것()` 이 잡아 준다.
 */

/**
 * 금액을 지금 언어로 적는다.
 *
 * 표에 넣을 수 없는 값이다 — 숫자가 매번 다르다. 단위가 붙는 자리도 언어마다
 * 다르다("6,000원" vs "KRW 6,000"). 그래서 만드는 쪽에서 언어를 보고 적는다.
 *
 * 통화는 원 그대로다. 이 앱은 한국 키오스크 앞에서 쓰는 것이고, 환산해서 적으면
 * 화면의 값과 키오스크의 값이 달라진다.
 */
export const 돈 = (n: number, 영어: boolean): string =>
  영어 ? `KRW ${n.toLocaleString("en-US")}` : `${n.toLocaleString("ko-KR")}원`;

/** 글자를 바꿀 곳. 화면 텍스트와, 눈에 안 보이지만 읽히는 것들. */
const 속성들 = ["aria-label", "placeholder", "title", "alt"] as const;

const 옮기기 = (글: string): string | null => {
  const 말 = 글.trim();
  if (!말) return null;
  if (!Object.hasOwn(EN, 말)) return null;
  // 앞뒤 공백을 지키면서 가운데만 바꾼다. 줄 사이 여백이 무너지지 않는다.
  const 앞 = 글.slice(0, 글.indexOf(말));
  const 뒤 = 글.slice(글.indexOf(말) + 말.length);
  return 앞 + EN[말] + 뒤;
};

/**
 * 뿌리 아래의 우리말을 영어로 바꾼다. 이미 바뀐 것은 표에 없으므로 그대로 둔다
 * (되풀이해서 불러도 안전하다 — 화면이 다시 그려질 때마다 부른다).
 */
export const 영어로바꾸기 = (뿌리: HTMLElement): void => {
  const 훑기 = document.createTreeWalker(뿌리, NodeFilter.SHOW_TEXT);
  const 바꿀것: [Text, string][] = [];
  for (let n = 훑기.nextNode(); n; n = 훑기.nextNode()) {
    const t = n as Text;
    // 개발용 화면(연동 기록)은 그대로 둔다. 서버와 오간 것을 보는 자리라
    // 옮기면 무엇이 원문인지 알 수 없어진다.
    if ((t.parentElement?.closest("[data-devlog]"))) continue;
    const 새것 = 옮기기(t.nodeValue ?? "");
    if (새것 !== null && 새것 !== t.nodeValue) 바꿀것.push([t, 새것]);
  }
  for (const [t, v] of 바꿀것) t.nodeValue = v;

  for (const el of 뿌리.querySelectorAll<HTMLElement>("*")) {
    for (const 속성 of 속성들) {
      const v = el.getAttribute(속성);
      if (!v) continue;
      const 새것 = 옮기기(v) ?? 토막내서옮기기(v);
      if (새것 !== null && 새것 !== v) el.setAttribute(속성, 새것);
    }
  }
};

/**
 * 쉼표로 이어 붙인 라벨을 토막마다 옮긴다. **속성에만 쓴다.**
 *
 * 주문표 카드의 aria-label 이 이런 모양이다 —
 * `"닭강정, 음식점, 포장하기, 매운맛, 순살, 종이컵, 1개"`.
 * 저장된 값들을 쉼표로 이어 만든 것이라 통째로는 표에 없다. 스크린리더로 듣는
 * 사람에게만 보이는 자리라, 여기가 우리말로 남으면 눈으로 읽는 사람은 영어를
 * 보고 귀로 듣는 사람은 우리말을 듣는다.
 *
 * 토막 중 하나라도 옮겨졌을 때만 바꾼다. 사용자가 적은 메뉴 이름은 표에 없어서
 * 그대로 남는다 — 자기가 적은 말이 바뀌면 안 된다.
 */
const 토막내서옮기기 = (글: string): string | null => {
  if (!글.includes(", ")) return null;
  let 바뀐게있나 = false;
  const 토막들 = 글.split(", ").map((조각) => {
    const 새것 = 옮기기(조각);
    if (새것 === null) return 조각;
    바뀐게있나 = true;
    return 새것;
  });
  return 바뀐게있나 ? 토막들.join(", ") : null;
};

/**
 * 아직 표에 없어서 우리말로 남은 문장들. 개발 중에 빠진 자리를 찾는 데 쓴다.
 *
 * 브라우저 콘솔에서 `window.__안바뀐것?.()` 로 부른다. 배포본에서도 부를 수는
 * 있지만 화면에는 아무 영향이 없다 — 읽기만 한다.
 */
export const 안바뀐것 = (뿌리: HTMLElement): string[] => {
  const 남은것 = new Set<string>();
  const 한글 = /[가-힣]/;
  const 훑기 = document.createTreeWalker(뿌리, NodeFilter.SHOW_TEXT);
  for (let n = 훑기.nextNode(); n; n = 훑기.nextNode()) {
    if ((n as Text).parentElement?.closest("[data-devlog]")) continue;
    const 말 = (n.nodeValue ?? "").trim();
    if (말 && 한글.test(말) && !Object.hasOwn(EN, 말)) 남은것.add(말);
  }
  for (const el of 뿌리.querySelectorAll<HTMLElement>("*")) {
    for (const 속성 of 속성들) {
      const v = (el.getAttribute(속성) ?? "").trim();
      if (v && 한글.test(v) && !Object.hasOwn(EN, v)) 남은것.add(v);
    }
  }
  return [...남은것];
};
