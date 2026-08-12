/**
 * 화면에 나온 안내를 소리로 읽어 준다.
 *
 * ── 왜 접근성 일곱 칸에 안 넣었나 ───────────────────────────────────────────
 *
 * 킷 계약의 `accessibility` 는 `additionalProperties: false` 이고 일곱 칸이 전부
 * required 다. 여덟 번째를 끼우면 제출이 스키마에서 막힌다.
 *
 * 대신 계약에 제자리가 따로 있다 — `interaction.preferredInput` 이다.
 *
 *   enum: TOUCH · VOICE · KEYBOARD · SWITCH · ASSISTED · MULTIMODAL
 *
 * 지금까지 "TOUCH" 로 박아 보내고 있었다. 소리로 듣기를 바라는 분이 켜면
 * "VOICE" 로 나간다. 로컬 백엔드로 직접 확인했다 — status VALID,
 * contractValidation.valid true.
 *
 * ── 이 앱이 원래 하던 약속과 어긋나지 않는다 ────────────────────────────────
 *
 * 접근성 화면은 "소리로만 알리는 것은 하나도 없어요" 라고 말한다. 그건 소리에만
 * 기대지 않는다는 뜻이고, 소리를 **더해 주는** 것은 그 약속과 다른 얘기다.
 * 화면 글은 그대로 두고 같은 내용을 소리로 한 번 더 읽는다.
 *
 * ── 되는지 먼저 보고 내민다 ─────────────────────────────────────────────────
 *
 * 브라우저에 speechSynthesis 가 없으면 스위치 자체를 안 보여 준다. 켰는데 아무
 * 소리도 안 나면 사용자는 앱이 고장 났다고 생각한다 — 이 앱은 못 하는 것을
 * 한다고 말하지 않는다.
 */

/** 이 브라우저에서 소리 안내가 되는가. 화면이 스위치를 내밀지 말지 이걸로 정한다. */
export const 소리를낼수있나 = (): boolean => {
  try {
    return typeof globalThis.speechSynthesis?.speak === "function"
      && typeof globalThis.SpeechSynthesisUtterance === "function";
  } catch {
    return false;
  }
};

/**
 * 읽어 준다.
 *
 * `이어서` 가 아니면 읽던 것을 끊는다. 화면이 바뀌면 앞 화면 안내는 이미 지난
 * 얘기다. 쌓아 두면 세 화면을 지나온 뒤에도 첫 화면을 읽고 있고, 사용자는 지금
 * 어디인지 알 수 없게 된다.
 *
 * 반대로 **같은 화면에 새 내용이 붙었을 때는 끊지 않는다**(`이어서`). 제외 이유가
 * 늦게 도착했다고 읽던 후보 설명을 잘라 버리면, 듣는 사람은 문장 하나를 통째로
 * 잃는다. 그때는 뒤에 붙여 읽는다.
 *
 * 실패해도 던지지 않는다. 소리는 더해 주는 것이지 이 앱이 하는 일이 아니다.
 */
export const 읽어주기 = (
  글: string,
  { 언어 = "ko-KR", 이어서 = false }: { 언어?: string; 이어서?: boolean } = {},
): void => {
  const 말 = 글
    .replace(/\s+/g, " ")
    // 줄을 ". " 로 이어 붙이는데, 마침표로 끝나는 줄 뒤에서는 점이 둘이 된다.
    // ("...닫으면 처음으로 돌아가요.. 이 앱은") 버전 표기(1.0.0)는 점 사이에
    // 숫자가 있어 여기 안 걸린다.
    .replace(/\.\s*\./g, ".")
    .trim();
  if (!말 || !소리를낼수있나()) return;
  try {
    if (!이어서) globalThis.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(말);
    /*
     * 화면에 나온 글을 그대로 읽는 것이라, 목소리도 그 글의 언어여야 한다.
     *
     * 예전에는 늘 ko-KR 이었다. 그때는 화면이 언제나 한국어였기 때문이다. 지금은
     * 안내 언어를 영어로 두면 화면 글이 영어라, ko-KR 목소리에게 영어 문장을
     * 주면 알아들을 수 없는 소리가 난다. 반대도 마찬가지다.
     *
     * 그래서 부르는 쪽이 '지금 화면의 언어' 를 준다(a11y 의 language).
     */
    u.lang = 언어;
    // 기본 속도는 이 앱을 쓰는 분들에게 빠르다. 조금 늦춘다.
    u.rate = 0.95;
    globalThis.speechSynthesis.speak(u);
  } catch {
    /* 목소리가 없거나 브라우저가 막았다. 화면 글은 그대로 있다. */
  }
};

/**
 * 화면에서 읽어 줄 글을 줄 단위로 모은다.
 *
 * 눈으로 보이는 것만 모은다 — 안 보이는 것을 읽으면 화면과 소리가 어긋난다.
 * 빼는 것은 넷이다.
 *
 *   - `data-devlog`  개발용 연동 기록. 사용자에게 하는 말이 아니다.
 *   - `aria-hidden`  장식이라고 우리가 표시해 둔 것. 스크린리더도 안 읽는다.
 *   - `inert`        겹 아래에 덮인 화면. 스크린리더가 못 읽도록 막아 둔 자리다.
 *                    소리 안내만 그 약속을 깨면 안 된다(#36 리뷰).
 *   - 자리를 차지하지 않는 것(getClientRects 가 빈 것). 접힌 목록·가려진 화면이다.
 *
 * `바뀌는것빼고` 를 켜면 `data-소리조용` 안쪽도 뺀다. 사용자가 적는 동안 따라
 * 바뀌는 글(가격 한도 안내)과 1초마다 바뀌는 글(남은 시간)이 거기 든다.
 * 화면에 처음 왔을 때는 읽어야 하지만 **바뀔 때마다 읽으면 안 된다** — 한 글자
 * 칠 때마다 "8원보다 비싼 메뉴는", "80원보다 비싼 메뉴는" 을 듣게 되고, 연결
 * 화면에서는 1초에 한 번씩 남은 시간을 듣는다.
 *
 * 줄 단위로 돌려주는 이유는, 같은 화면에서 **새로 붙은 줄만** 골라 읽기 위해서다.
 * 통째로 비교하면 글자 하나만 달라져도 화면 전체를 다시 읽는다.
 */
export const 화면글 = (뿌리: HTMLElement, { 바뀌는것빼고 = false } = {}): string[] => {
  const 줄: string[] = [];
  const 훑기 = document.createTreeWalker(뿌리, NodeFilter.SHOW_TEXT);
  for (let n = 훑기.nextNode(); n; n = 훑기.nextNode()) {
    const 말 = (n.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (!말) continue;
    const el = n.parentElement;
    if (!el) continue;
    if (el.closest("[data-devlog]")) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    if (el.closest("[inert]")) continue;
    if (바뀌는것빼고 && el.closest("[data-소리조용]")) continue;
    if (el.getClientRects().length === 0) continue;
    줄.push(말);
  }
  return 줄;
};

/** 읽던 것을 멈춘다. 스위치를 끄거나 화면을 떠날 때 부른다. */
export const 그만읽기 = (): void => {
  try {
    globalThis.speechSynthesis?.cancel();
  } catch {
    /* 읽고 있던 것이 없으면 할 일도 없다. */
  }
};
