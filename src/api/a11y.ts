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
 * 이 파일은 메모리에만 둔다. 저장은 화면 쪽(app/App.tsx)이 이번 이용 기록에 얹어서
 * 같이 한다(api/session.ts). 여기서 직접 저장소를 만지지 않는 이유는, 연동 계층도
 * 이 값을 읽어야 해서 이 파일이 어느 쪽에도 딸리지 않아야 하기 때문이다.
 *
 * 새로고침해도 켜 둔 설정은 그대로 남는다. 큰 글씨를 켜 둔 사람에게 새로고침 한 번에
 * 작은 글씨를 돌려주는 것은, 도움이 필요해서 켠 사람에게 가장 나쁜 일이다.
 * 탭을 닫으면 사라진다 — sessionStorage 라서 그렇다.
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
  /**
   * 저장해 둔 값으로 되돌린다. **듣는이에게 알리지 않는다.**
   *
   * 화면이 첫 그림을 그리기 전에 한 번만 부른다. 그리는 도중에 알리면 React 가
   * "다른 컴포넌트를 그리는 중에 상태를 바꿨다" 고 경고한다 — 부르는 쪽이 자기
   * 상태도 이 값으로 시작하므로 알릴 것도 없다.
   *
   * 알림이 필요한 값 바꾸기는 바꾸기·비우기 쪽이다. 이 함수를 그 자리에 쓰면
   * 화면이 안 따라온다.
   */
  되살리기(한판: 접근성): void {
    값 = { ...기본접근성, ...한판 };
  },
  구독(f: () => void): () => void {
    듣는이.add(f);
    return () => { 듣는이.delete(f); };
  },
};
