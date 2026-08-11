// 팔레트 — 초록 대표색 + 에디토리얼 미니멀.
// 위계는 여전히 크기·여백·굵기로 만든다. 초록은 "누를 수 있는 것/성공한 것"에만 쓴다.
// P 는 흰 글씨 대비 5.08:1 로 WCAG AA 를 통과하는 값이다. 더 밝은 초록(#03C75A 등)은
// 2.25:1 밖에 안 나와서 고령 사용자 기준에 미달하므로 쓰지 않는다.
export const P = "var(--kb-green)";          // 초록. 화면당 한 곳에만 쓴다(연결·조건 일치·담기 성공)
// P_LIGHT / P_DARK 는 지웠다. 쓰는 곳이 한 곳도 없었다.
// 눌린 상태는 지금 배경색 전환으로 표현하고 있어서 별도 값이 필요하지 않다.
export const ACCENT = "var(--kb-green)";     // 아주 드물게 쓰는 강조 (이름 호명 등)
export const TEXT_1 = "var(--kb-text-1)";     // heading
// 읽어야 하는 글자는 전부 이 색을 쓴다.
// 예전 값 #8A8A8E 는 흰 배경에서 3.44:1 로 WCAG AA(4.5:1)에 미달했다.
// 옅은 면(SURFACE #F7F7F8) 위에서는 3.21:1 까지 떨어져서 더 나빴다.
// #6B6B70 은 흰 배경 5.30:1, SURFACE 위 4.95:1 로 두 경우 모두 통과한다.
export const TEXT_2 = "var(--kb-text-2)";     // subtext
// 글자에 쓰지 않는다. 머리카락 선·점·비활성 컨트롤처럼 읽을 필요가 없는 것에만 쓴다.
// 읽어야 하는 글자에 이 색을 쓰면 1.74:1 이라 사실상 안 보인다.
export const TEXT_3 = "var(--kb-text-3)";     // hairline / dot / disabled — 글자 금지
// 아래 둘은 App.tsx 에 직접 적혀 있던 값이다. 대비는 각각 8.2:1, 6.5:1 로 통과하지만
// 색이 토큰 밖에 흩어져 있으면 이 파일이 팔레트의 기준이라는 말이 사실이 아니게 된다.
// 보이는 색은 그대로 두고 이름만 여기로 가져왔다.
export const TEXT_BTN = "var(--kb-text-btn)";   // 테두리 버튼 글자
export const TEXT_CHIP = "var(--kb-text-chip)";  // 안 고른 칩 글자
export const BORDER = "var(--kb-border)";     // hairline
export const SURFACE = "var(--kb-surface)";    // 옅은 면
export const CANVAS = "var(--kb-canvas)";     // 입력 필드 배경
// 폰 프레임 밖 책상. 어두운 보드에서 종이색 데스크로 바꿨다 - 화면 전체가
// 한 톤으로 이어져서 프레임이 '올려둔 종이' 처럼 보인다.
export const BACKDROP = "var(--kb-desk)";

/** 종이색 바탕. 흰 화면은 형광등 아래에서 눈이 부시고 글자 가장자리가 번져 보인다. */
export const PAPER = "var(--kb-paper)";
/*
 * 늘 어두운 판 위에 얹는 흰색.
 *
 * 사진 위 · 카메라 화면처럼 팔레트와 무관하게 어두운 자리가 있다. 거기에
 * PAPER 를 쓰면 다크에서 함께 검어져 글자가 사라진다. 이 자리는 뒤집지 않는다.
 */
export const ON_DARK = "#FFFFFF";
/** 섹션 머리의 굵은 줄(2px). 이 디자인에서 화면을 자르는 유일한 선이다. */
export const RULE = "var(--kb-rule)";

// 상태색은 최소한만. 흑백 안에서 튀지 않게 채도를 낮춘다.
export const SUCCESS = "var(--kb-green)";
export const SUCCESS_BG = "var(--kb-green-bg)";
export const WARN = "var(--kb-warn)";
export const WARN_BG = "var(--kb-warn-bg)";
// WARN_BG 위에서 1.29:1 이라 컨트롤 경계(3:1)로 쓸 수 없어서 뺐다.
// 다시 쓰고 싶으면 대비부터 재고 쓴다.
// 예전 값 #D92D20 은 옅은 빨강(FAIL_BG) 위에서 4.35:1 로 AA 에 못 미쳤다.
// "오늘은 제공되지 않아요" 같은 12px 배지가 이 조합으로 그려지므로 지나칠 수 없다.
// #CE2A1F 는 FAIL_BG 위 4.75:1, 흰 배경 5.28:1 이고 눈으로는 거의 같은 빨강이다.
export const FAIL = "var(--kb-fail)";
export const FAIL_BG = "var(--kb-fail-bg)";

export const FONT = "'Noto Sans KR', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
// 로고·이탤릭 영문 머리말·숫자에만 쓰는 세리프.
export const SERIF = "'Playfair Display', 'Instrument Serif', Georgia, 'Times New Roman', serif";

/*
 * 제목 위에 얹는 이탤릭 영문 한 줄(accessibility · connected · in the cart).
 *
 * 뜻을 여기에 담지 않는다. 읽어야 할 말은 전부 아래 한글 제목에 있다.
 * 영어를 못 읽어도 잃는 정보가 없어야 해서, aria-hidden 으로 두어 스크린리더가
 * 읽지도 않는다. 눈으로 볼 때만 "화면이 바뀌었다" 는 표식이다.
 *
 * 색은 본문색(TEXT_2)을 쓴다.
 *
 * 처음에는 TEXT_3 를 썼는데 이 파일에 "글자 금지" 라고 적어 둔 값이다 -
 * 종이 위 2.06:1 이라 읽으라고 둔 글자가 사실상 안 보인다. aria-hidden 이라
 * 정보는 없지만 **화면에는 19px 글자로 보인다.** 안 읽히는 글자를 화면에
 * 두는 것과 안 두는 것은 다르다.
 *
 * 낮춰 보이는 것은 색이 아니라 크기와 자리로 만든다 - 아래 제목이 34px/900 이라
 * 같은 색이어도 위계는 충분히 갈린다.
 */
export const KICKER = {
  fontFamily: "'Playfair Display', 'Instrument Serif', Georgia, serif",
  fontStyle: "italic", fontSize: 19, fontWeight: 400,
  letterSpacing: "0.01em", lineHeight: 1.2,
} as const;

// ─── 타이포 스케일 ────────────────────────────────────────────────────────────
// 굵기는 400/600/700 세 단계만. 본문 17px 는 고령 사용자 기준 하한이라 더 줄이지 않는다.
export const TYPE = {
  // 두 줄로 끊어 쓰는 것을 전제로 한 크기다. 화면마다 '지금 무엇을 하는 중인지' 가
  // 한 덩어리로 먼저 읽히게 한다.
  display: { fontSize: 34, fontWeight: 900, lineHeight: 1.24, letterSpacing: "-0.5px" },
  title:   { fontSize: 22, fontWeight: 800, lineHeight: 1.4, letterSpacing: "-0.4px" },
  body:    { fontSize: 17, fontWeight: 400, lineHeight: 1.6, letterSpacing: "-0.01em" },
  bodyBold:{ fontSize: 17, fontWeight: 600, lineHeight: 1.5, letterSpacing: "-0.01em" },
  caption: { fontSize: 15, fontWeight: 400, lineHeight: 1.55, letterSpacing: "-0.01em" },
  label:   { fontSize: 13, fontWeight: 600, lineHeight: 1.4, letterSpacing: "0" },
} as const;

// 가격·타이머처럼 자릿수가 흔들리면 안 되는 숫자에 쓴다.
export const NUM = { fontVariantNumeric: "tabular-nums" } as const;

// ─── 간격 ─────────────────────────────────────────────────────────────────────
export const GAP = { screenX: 24, section: 28, card: 20 } as const;
// 버튼은 완전한 알약. 카드는 테두리 대신 여백으로 나눈다.
export const RADIUS = { card: 16, button: 999, pill: 999, input: 12 } as const;
/** 대표 버튼 높이. 명세의 60px. */
export const BTN_H = 60;

// Instrument Serif 는 styles/fonts.css 로 옮겼다.
// @import 는 스타일시트 맨 위에만 유효한데 이 문자열은 런타임에 <style> 로 꽂히므로
// 앞에 다른 규칙이 오면 브라우저가 조용히 무시한다. 폰트가 안 뜨는데 이유도 안 보인다.

/*
 * 고대비 팔레트.
 *
 * 처음에는 filter: contrast() 로 만들었는데 그게 화면을 더 나쁘게 만들었다.
 * contrast 는 중간 회색을 축으로 벌리므로 흰색에 가까운 값이 전부 순백으로
 * 뭉개진다 - SURFACE(#F7F7F8) 1.109, CANVAS(#F4F4F5) 1.094, 흰 배경 1.150 이
 * 모두 1.0 으로 잘려서 카드 경계가 사라졌다. 대비를 높이겠다고 만든 기능이
 * 정작 경계 대비를 없앤 셈이다.
 *
 * 그래서 값을 직접 바꾼다. 위의 색 토큰은 CSS 변수를 가리키고, 아래 두 벌이
 * 그 변수를 채운다. 화면 코드는 한 줄도 바뀌지 않는다 - 토큰을 쓰는 곳이
 * 220 군데라 거기를 다 고치는 대신 값이 사는 자리를 하나로 모았다.
 *
 * 흰 배경 위 대비 (WCAG: 본문 4.5 · 큰 글씨 3 · 컨트롤 경계 3)
 *   TEXT_2     5.30 -> 11.31
 *   TEXT_3     1.74 ->  5.30   (원래 글자 금지 값이었다. 고대비에서는 읽힌다)
 *   TEXT_BTN            14.29
 *   TEXT_CHIP           12.36
 * 면은 흰 배경과 갈리게 조금 더 어둡게 둔다 - 카드가 배경에 붙지 않도록.
 *
 * BORDER 은 흰 배경만 보면 안 된다. 처음에 #8A8A90 으로 두고 "흰 배경 위 3.43,
 * 기준 통과" 라고 적었는데, 화면에서 재 보니 이 색이 실제로 칠해지는 곳은
 * **카드 면 위의 토글 스위치 트랙(52x31)** 이었다. 흰 배경이 아니다.
 *
 *   #8A8A90  면 #E8E8EA 위 2.80 · 배경 #E2E2E5 위 2.65   <- 컨트롤 기준 미달
 *   #7A7A80  면 3.49 · 배경 3.30 · 흰 배경 4.26          <- 셋 다 넘긴다
 *
 * 스위치 트랙은 꺼진 상태를 알아보는 유일한 단서다. 면에 붙어 버리면 켜졌는지
 * 꺼졌는지 알 수 없다 - 고대비를 켠 사람에게 가장 곤란한 실패다.
 */
export const PALETTE_STYLES = `
  :root {
    --kb-paper: #FAF8F3;
    --kb-desk: #E7E4DC;
    /* rule 은 '종이의 반대색' 이다. 이 둘만 뒤집으면 버튼.선택.토글이 통째로
       반전된다 - 검은 알약이 흰 알약이 되고, 켜진 토글은 흰 트랙+검은 노브가 된다.
       화면 코드는 한 줄도 안 바뀐다. */
    --kb-rule: #111111;
    --kb-text-1: #111111;
    --kb-green: #1E7A4A;
    --kb-green-bg: #E8F1EB;
    --kb-warn: #7A5200;
    --kb-warn-bg: #F5EFE0;
    --kb-fail: #B3261E;
    --kb-fail-bg: #F7EDEC;
    --kb-text-2: #6d6a63;
    --kb-text-3: #B3AFA5;
    --kb-text-btn: #3A3830;
    --kb-text-chip: #3A3830;
    --kb-border: #DBD7CD;
    --kb-surface: #F0EDE5;
    --kb-canvas: #F0EDE5;
    --kb-toggle-off: #DAD5CB;
  }
  /*
   * 고대비 = 다크.
   *
   * 밝은 바탕에서 글자를 더 어둡게 하는 방식은 한계가 있다 - 종이색 위에서
   * 아무리 어둡게 해도 11:1 언저리다. 검은 바탕에 밝은 글자는 19:1 이 그냥 나온다.
   *
   * paper 와 rule 을 맞바꾸면 나머지는 따라온다. 대표 버튼은 흰 알약에 검은
   * 글자가 되고(명세의 "다크 화면에선 화이트 필"), 켜진 토글은 흰 트랙에
   * 검은 노브가 된다. 고른 줄도 흰 면에 검은 글자다.
   *
   * 검은 바탕 위 대비 (전부 화면에서 재서 확인했다)
   *   TEXT_1  #FAF8F3  19.0    TEXT_2  #B8B4AC   9.5
   *   초록    #4FBF85   8.5    빨강    #E8776C   6.8
   *   경고    #E0B24D   9.9    토글 off #6B675E  3.6  (컨트롤 경계 3 통과)
   * TEXT_3 는 여기서도 '글자 금지' 다 - 2.9:1 이라 읽으라고 두면 안 된다.
   */
  [data-contrast="high"] {
    --kb-paper: #0C0C0C;
    --kb-desk: #050505;
    --kb-rule: #FAF8F3;
    --kb-text-1: #FAF8F3;
    --kb-text-2: #B8B4AC;
    --kb-text-3: #6E6A62;
    --kb-text-btn: #FAF8F3;
    --kb-text-chip: #FAF8F3;
    --kb-border: #3A3A3A;
    --kb-surface: #1A1A1A;
    --kb-canvas: #1A1A1A;
    --kb-toggle-off: #6B675E;
    --kb-green: #4FBF85;
    --kb-green-bg: #16301F;
    --kb-warn: #E0B24D;
    --kb-warn-bg: #2E2515;
    --kb-fail: #E8776C;
    --kb-fail-bg: #2E1614;
  }
  /* 흰 바탕을 쓰던 자리. 한 곳에서 종이색으로 바꾼다. */
  .kb-paper { background-color: var(--kb-paper); }
`;

/** 꺼진 토글 트랙. 명세의 #DAD5CB. */
export const TOGGLE_OFF = "var(--kb-toggle-off)";

export const FOCUS_STYLES = `

  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  [role="radio"]:focus-visible,
  [role="checkbox"]:focus-visible,
  [tabindex]:focus-visible {
    outline: 3px solid ${RULE};
    outline-offset: 2px;
    border-radius: 8px;
  }
  /* 고른 글자. 배경이 TEXT_1 이므로 글자는 반드시 그 반대색(PAPER)이어야 한다.
     #fff 로 박아 두면 다크에서 흰 배경에 흰 글자가 된다. */
  ::selection { background: ${TEXT_1}; color: ${PAPER}; }
  /* 확인 카드의 마지막 행에는 구분선을 남기지 않는다.
     행의 구분선은 인라인 스타일로 들어가므로 !important 가 없으면 덮이지 않는다. */
  [data-confirm-body] > div:last-child { border-bottom: none !important; }
  /* placeholder 는 장식이 아니라 '무엇을 적어야 하는지' 를 알려 주는 글이다.
     '예: 할머니, 김씨' 처럼 예시를 담고 있어서 안 보이면 무엇을 적을지 알 수 없다.
     TEXT_3 는 1.74:1 이라 사실상 안 보인다. TEXT_2 는 입력 배경 위에서 AA 를 넘는다. */
  input::placeholder { color: ${TEXT_2}; font-weight: 400; }
  /* 내려받은 픽토그램에는 width/height 가 없고 viewBox 만 있다.
     감싼 span 크기에 맞춰 늘어나도록 여기서 한 번만 정해 준다. */
  [data-pictogram] > svg { width: 100%; height: 100%; display: block; }
  /* 진행 중 표시의 회전. SVG SMIL 이 아니라 CSS 로 두어야 아래 축소 블록이 멈춘다. */
  @keyframes kb-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    /* iteration-count 를 안 막으면 무한 반복 애니메이션이 0.01ms 마다 계속 돈다.
       느려 보이지만 않을 뿐 멈추지는 않아서, 어지럼을 느끼는 분에게는 그대로다. */
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
    }
  }
`;
