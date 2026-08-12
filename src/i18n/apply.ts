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

/**
 * 우리 문구가 아닌 글자가 사는 곳. 여기 안은 손대지 않는다.
 *
 *   - `data-devlog` : 서버와 오간 것을 그대로 보는 개발 화면. 옮기면 무엇이
 *     원문인지 알 수 없어진다.
 *   - `data-원문` : 사용자가 적은 말과 서버가 준 이름. 주문표 이름·메모·후보
 *     이름이 여기 든다.
 *
 * 뒤엣것이 필요한 이유는 이 옮기기가 **문장이 정확히 같을 때** 바꾸기 때문이다.
 * 표에 있는 문구를 사용자가 그대로 적을 수 있다 — 주문표 이름을 '포장하기' 로
 * 지으면 영어 화면에서 그 이름이 'Takeout' 이 된다. 자기가 적은 말은 자기가 적은
 * 대로 있어야 한다(#34 리뷰).
 */
const 건드리지않을곳 = (n: Node): boolean =>
  (n.nodeType === 1 ? (n as Element) : n.parentElement)
    ?.closest("[data-devlog],[data-원문]") != null;

/**
 * 우리가 바꾼 자리와 그 자리의 원문.
 *
 * 영어에서 한국어로 되돌릴 때 필요하다. 우리가 DOM 을 직접 고쳤기 때문에
 * React 는 자기가 그린 것이 아직 화면에 그대로 있다고 여긴다 — 언어만 바꾸면
 * 화면은 영어로 남는다. 실제로 그랬다: 설정은 ko-KR 인데 글자는 영어였고,
 * 새로고침 전에는 한국어로 돌아올 길이 없었다(#34 리뷰).
 *
 * 그래서 바꾼 자리를 적어 두었다가 우리 손으로 되돌린다.
 */
interface 되돌릴것 { 원문: string; 쓴것: string }
const 바꾼글자 = new Map<Text, 되돌릴것>();
const 바꾼속성 = new Map<Element, Map<string, 되돌릴것>>();

/**
 * 영어로 바꿔 둔 것을 원문으로 되돌린다.
 *
 * **우리가 쓴 값이 아직 그대로일 때만** 되돌린다. 그 사이 React 가 다시 그려
 * 다른 값이 들어왔다면 그건 최신 값이고, 우리가 기억하는 원문은 낡은 것이다.
 */
export const 되돌리기 = (): void => {
  for (const [노드, { 원문, 쓴것 }] of 바꾼글자) {
    if ((노드.nodeValue ?? "") === 쓴것) 노드.nodeValue = 원문;
  }
  바꾼글자.clear();

  for (const [el, 칸들] of 바꾼속성) {
    for (const [속성, { 원문, 쓴것 }] of 칸들) {
      if (el.getAttribute(속성) === 쓴것) el.setAttribute(속성, 원문);
    }
  }
  바꾼속성.clear();
};

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
  /*
   * 화면에서 떨어져 나간 노드를 놓아 준다.
   *
   * 되돌릴 자리를 적어 두는 Map 의 열쇠가 DOM 노드다. 강한 참조라, React 가
   * 노드를 걷어 내도 이 Map 이 붙잡고 있으면 회수되지 않는다. 이 함수는 화면이
   * 다시 그려질 때마다 불리므로, 영어를 켜 둔 채 화면을 옮겨 다닐수록 사라진
   * 노드가 쌓인다. 비우는 것은 한국어로 되돌릴 때뿐이라 그때까지 계속 는다.
   *
   * 매번 훑어도 싸다 — 지금 화면에 있는 만큼만 들어 있기 때문이다(#98 리뷰).
   */
  for (const 노드 of 바꾼글자.keys()) if (!노드.isConnected) 바꾼글자.delete(노드);
  for (const el of 바꾼속성.keys()) if (!el.isConnected) 바꾼속성.delete(el);

  const 훑기 = document.createTreeWalker(뿌리, NodeFilter.SHOW_TEXT);
  const 바꿀것: [Text, string][] = [];
  for (let n = 훑기.nextNode(); n; n = 훑기.nextNode()) {
    const t = n as Text;
    if (건드리지않을곳(t)) continue;
    const 새것 = 옮기기(t.nodeValue ?? "");
    if (새것 !== null && 새것 !== t.nodeValue) 바꿀것.push([t, 새것]);
  }
  for (const [t, v] of 바꿀것) {
    /*
     * 원문은 **지금 지우는 값**이다. 처음 본 것을 붙들면 안 된다.
     *
     * 영어인 채로 React 가 같은 자리에 다른 우리말을 그려 넣는 일이 있다.
     * 그때 처음 원문을 그대로 두면, 한국어로 돌아올 때 화면에 없던 옛 문장이
     * 되살아난다 — 되돌리기가 화면을 과거로 돌려놓는 셈이다(#34 리뷰).
     */
    바꾼글자.set(t, { 원문: t.nodeValue ?? "", 쓴것: v });
    t.nodeValue = v;
  }

  const 그대로 = 그대로둘말(뿌리);
  for (const el of 뿌리.querySelectorAll<HTMLElement>("*")) {
    if (건드리지않을곳(el)) continue;
    for (const 속성 of 속성들) {
      const v = el.getAttribute(속성);
      if (!v) continue;
      const 새것 = 그대로.has(v.trim()) ? null : (옮기기(v) ?? 토막내서옮기기(v, 그대로));
      if (새것 === null || 새것 === v) continue;
      let 칸들 = 바꾼속성.get(el);
      if (!칸들) { 칸들 = new Map(); 바꾼속성.set(el, 칸들); }
      // 글자와 같은 이유로, 원문은 지금 지우는 값이다.
      칸들.set(속성, { 원문: v, 쓴것: 새것 });
      el.setAttribute(속성, 새것);
    }
  }
};

/**
 * 지금 화면이 원문으로 보여 주고 있는 말들. 속성에서도 이 말들은 안 옮긴다.
 *
 * 카드의 aria-label 은 저장된 값들을 쉼표로 이어 만든다. 그 안에는 사용자가
 * 적은 주문표 이름과 메모도 섞여 있는데, 토막마다 옮기다 보면 그것까지 옮겨진다.
 * 주문표 이름을 '포장하기' 로 지어 두면 눈으로는 '포장하기' 를 보고 귀로는
 * 'Take out' 을 듣게 된다 — 실제로 그랬다(#34 리뷰).
 *
 * **틀 전체에서 모은다.** 라벨을 단 자리가 그 글자를 품고 있지 않을 때가 있다 —
 * 주문표 카드의 aria-label 은 눈에 안 보이는 radio 에 붙어 있고, 그 radio 는
 * 자식이 없다. 카드 안쪽만 뒤지면 아무것도 못 찾는다.
 *
 * 넓게 잡아서 손해 볼 것은 없다. 여기 모이는 말은 사용자가 적었거나 서버가 준
 * 이름이고, 그런 말은 화면 어디에서도 옮기지 않는 것이 맞다.
 */
const 그대로둘말 = (뿌리: Element): Set<string> => {
  const 것들 = new Set<string>();
  for (const 안 of 뿌리.querySelectorAll("[data-원문]")) {
    const 말 = (안.textContent ?? "").trim();
    if (!말) continue;
    것들.add(말);
    /*
     * 토막도 같이 지킨다. 모으는 단위와 지키는 단위가 달라서다.
     *
     * 여기서는 요소 하나의 글자를 통째로 담는데, 라벨을 옮기는 쪽은 그 라벨을
     * ", " 로 쪼개어 조각마다 표를 본다. 메모를 "얼음 적게, 포장하기" 로 적어
     * 두면 통째로는 안 걸리고 '포장하기' 조각만 따로 걸려서, 사용자가 적은 말의
     * 절반이 Take out 이 된다(#98 리뷰).
     */
    for (const 조각 of 말.split(", ")) {
      const t = 조각.trim();
      if (t) 것들.add(t);
    }
  }
  return 것들;
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
const 토막내서옮기기 = (글: string, 그대로: Set<string> = new Set()): string | null => {
  if (!글.includes(", ")) return null;
  let 바뀐게있나 = false;
  const 토막들 = 글.split(", ").map((조각) => {
    if (그대로.has(조각.trim())) return 조각;
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
    if (건드리지않을곳(n)) continue;
    const 말 = (n.nodeValue ?? "").trim();
    if (말 && 한글.test(말) && !Object.hasOwn(EN, 말)) 남은것.add(말);
  }
  for (const el of 뿌리.querySelectorAll<HTMLElement>("*")) {
    if (건드리지않을곳(el)) continue;
    for (const 속성 of 속성들) {
      const v = (el.getAttribute(속성) ?? "").trim();
      if (v && 한글.test(v) && !Object.hasOwn(EN, v)) 남은것.add(v);
    }
  }
  return [...남은것];
};
