// 팔레트 — 초록 대표색 + 에디토리얼 미니멀.
// 위계는 여전히 크기·여백·굵기로 만든다. 초록은 "누를 수 있는 것/성공한 것"에만 쓴다.
// P 는 흰 글씨 대비 5.08:1 로 WCAG AA 를 통과하는 값이다. 더 밝은 초록(#03C75A 등)은
// 2.25:1 밖에 안 나와서 고령 사용자 기준에 미달하므로 쓰지 않는다.
export const P = "#0A7F45";          // primary (CTA, 선택 상태)
export const P_LIGHT = "#EAF6EF";    // primary light bg
export const P_DARK = "#076235";     // primary pressed
export const ACCENT = "#0A7F45";     // 아주 드물게 쓰는 강조 (이름 호명 등)
export const TEXT_1 = "#111111";     // heading — 본문은 검정 유지
export const TEXT_2 = "#8A8A8E";     // subtext
export const TEXT_3 = "#C4C4C8";     // placeholder / disabled
export const BORDER = "#EDEDEF";     // hairline
export const SURFACE = "#F7F7F8";    // 옅은 면
export const CANVAS = "#F4F4F5";     // 입력 필드 배경
export const BACKDROP = "#1A1A1A";   // 폰 프레임 밖 배경 (레퍼런스의 어두운 보드)

// 상태색은 최소한만. 흑백 안에서 튀지 않게 채도를 낮춘다.
export const SUCCESS = "#0A7F45";
export const SUCCESS_BG = "#EAF6EF";
export const WARN = "#8A5A00";
export const WARN_BG = "#FDF6E9";
export const WARN_BORDER = "#EBD9B4";
export const FAIL = "#D92D20";
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

export const FOCUS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');

  button:focus-visible,
  input:focus-visible,
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
  input::placeholder { color: ${TEXT_3}; font-weight: 400; }
  /* 내려받은 픽토그램에는 width/height 가 없고 viewBox 만 있다.
     감싼 span 크기에 맞춰 늘어나도록 여기서 한 번만 정해 준다. */
  [data-pictogram] > svg { width: 100%; height: 100%; display: block; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  }
`;
