// 팔레트 — 초록 대표색 + 에디토리얼 미니멀.
// 위계는 여전히 크기·여백·굵기로 만든다. 초록은 "누를 수 있는 것/성공한 것"에만 쓴다.
// P 는 흰 글씨 대비 5.08:1 로 WCAG AA 를 통과하는 값이다. 더 밝은 초록(#03C75A 등)은
// 2.25:1 밖에 안 나와서 고령 사용자 기준에 미달하므로 쓰지 않는다.
export const P = "#0A7F45";          // primary (CTA, 선택 상태)
// P_LIGHT / P_DARK 는 지웠다. 쓰는 곳이 한 곳도 없었다.
// 눌린 상태는 지금 배경색 전환으로 표현하고 있어서 별도 값이 필요하지 않다.
export const ACCENT = "#0A7F45";     // 아주 드물게 쓰는 강조 (이름 호명 등)
export const TEXT_1 = "#111111";     // heading — 본문은 검정 유지
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
export const BACKDROP = "#1A1A1A";   // 폰 프레임 밖 배경 (레퍼런스의 어두운 보드)

// 상태색은 최소한만. 흑백 안에서 튀지 않게 채도를 낮춘다.
export const SUCCESS = "#0A7F45";
export const SUCCESS_BG = "#EAF6EF";
export const WARN = "#8A5A00";
export const WARN_BG = "#FDF6E9";
// WARN_BG 위에서 1.29:1 이라 컨트롤 경계(3:1)로 쓸 수 없어서 뺐다.
// 다시 쓰고 싶으면 대비부터 재고 쓴다.
// 예전 값 #D92D20 은 옅은 빨강(FAIL_BG) 위에서 4.35:1 로 AA 에 못 미쳤다.
// "오늘은 제공되지 않아요" 같은 12px 배지가 이 조합으로 그려지므로 지나칠 수 없다.
// #CE2A1F 는 FAIL_BG 위 4.75:1, 흰 배경 5.28:1 이고 눈으로는 거의 같은 빨강이다.
export const FAIL = "#CE2A1F";
export const FAIL_BG = "#FDF0EF";

export const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";
// 로고·큰 숫자에만 쓰는 세리프. 레퍼런스의 에디토리얼 감각을 담당한다.
export const SERIF = "'Instrument Serif', 'Playfair Display', Georgia, 'Times New Roman', serif";

// ─── 타이포 스케일 ────────────────────────────────────────────────────────────
// 굵기는 400/600/700 세 단계만. 본문 17px 는 고령 사용자 기준 하한이라 더 줄이지 않는다.
export const TYPE = {
  display: { fontSize: 26, fontWeight: 700, lineHeight: 1.45, letterSpacing: "-0.03em" },
  title:   { fontSize: 22, fontWeight: 600, lineHeight: 1.5, letterSpacing: "-0.03em" },
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
export const RADIUS = { card: 16, button: 100, pill: 100, input: 12 } as const;

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
    --kb-text-2: #6B6B70;
    --kb-text-3: #C4C4C8;
    --kb-text-btn: #4A4A4F;
    --kb-text-chip: #4E5968;
    --kb-border: #EDEDEF;
    --kb-surface: #F7F7F8;
    --kb-canvas: #F4F4F5;
  }
  [data-contrast="high"] {
    --kb-text-2: #3A3A3F;
    --kb-text-3: #6B6B70;
    --kb-text-btn: #2A2A2E;
    --kb-text-chip: #2E3540;
    --kb-border: #7A7A80;
    --kb-surface: #E8E8EA;
    --kb-canvas: #E2E2E5;
  }
`;

export const FOCUS_STYLES = `

  button:focus-visible,
  input:focus-visible,
  textarea:focus-visible,
  [role="radio"]:focus-visible,
  [role="checkbox"]:focus-visible,
  [tabindex]:focus-visible {
    outline: 3px solid ${P};
    outline-offset: 2px;
    border-radius: 8px;
  }
  ::selection { background: ${P}; color: #fff; }
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
