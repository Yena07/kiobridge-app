/**
 * 접근성 설정.
 *
 * 킷 계약(`Accessibility`)이 요구하는 일곱 가지를 그대로 담는다. 백엔드는 이 값을
 * 받을 준비가 돼 있는데(CanonicalProfile.accessibility) 화면이 안 묻고 있었다 —
 * 큰 글씨를 켜 놓고 주문해도 서버는 그 사실을 몰랐다.
 *
 * ── 두 가지를 구분한다 ────────────────────────────────────────────────────────
 *
 *   이 앱이 바로 바꾸는 것   큰 글씨 · 고대비
 *   키오스크에 전달하는 것    나머지 다섯
 *
 * 뒤의 다섯은 이 앱 화면을 바꾸지 않는다. 대신 서버로 나가서 추천과 안내가
 * 그 사정을 반영하는 데 쓰인다(킷의 EXPLAINABLE_RECOMMENDATION_GUIDE 가
 * ACCESSIBILITY 를 추천 이유의 한 갈래로 두고 있다).
 *
 * **바꾸지 않는 것을 바꾼다고 말하지 않는다.** 화면에도 두 무리를 나눠서 적는다.
 * 켰는데 아무 일도 안 일어나면 사용자는 앱이 고장 났다고 생각한다.
 *
 * 메모리에만 둔다. 이 앱은 아무것도 저장하지 않겠다고 화면에서 약속했고,
 * 접근성 설정도 예외가 아니다. 새로고침하면 기본값으로 돌아간다.
 */

export interface 접근성 {
  /** 앱 전체의 글씨와 버튼을 키운다. 화면이 바로 바뀐다. */
  largeText: boolean;
  /** 화면 대비를 높인다. 화면이 바로 바뀐다. */
  highContrast: boolean;
  /** 단계를 줄이고 한 번에 하나만 묻기를 바란다. */
  simpleSteps: boolean;
  /** 글보다 그림·화면 안내가 더 편하다. */
  visualGuidance: boolean;
  /** 소리 안내를 못 듣는다 — 소리로만 알리지 말 것. */
  hearingSupport: boolean;
  /** 오래 서 있기 어렵거나 손 조작이 힘들다 — 시간 여유가 필요하다. */
  mobilitySupport: boolean;
  /** 막히면 직원이 도와주는 편이 낫다. */
  staffAssistancePreferred: boolean;
}

export const 기본접근성: 접근성 = {
  largeText: false,
  highContrast: false,
  simpleSteps: false,
  visualGuidance: false,
  hearingSupport: false,
  mobilitySupport: false,
  staffAssistancePreferred: false,
};

let 값: 접근성 = { ...기본접근성 };
const 듣는이 = new Set<() => void>();

export const 접근성설정 = {
  읽기: (): 접근성 => 값,
  바꾸기(한칸: Partial<접근성>): void {
    값 = { ...값, ...한칸 };
    for (const f of 듣는이) f();
  },
  비우기(): void {
    값 = { ...기본접근성 };
    for (const f of 듣는이) f();
  },
  구독(f: () => void): () => void {
    듣는이.add(f);
    return () => { 듣는이.delete(f); };
  },
};
