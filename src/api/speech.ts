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
 * 한 문장을 읽는다. 읽던 것이 있으면 끊고 이걸 읽는다.
 *
 * 끊는 이유 — 화면이 바뀌면 앞 화면 안내는 이미 지난 얘기다. 쌓아 두면 세 화면을
 * 지나온 뒤에도 첫 화면을 읽고 있고, 사용자는 지금 어디인지 알 수 없게 된다.
 *
 * 실패해도 던지지 않는다. 소리는 더해 주는 것이지 이 앱이 하는 일이 아니다.
 */
export const 읽어주기 = (글: string): void => {
  const 말 = 글.replace(/\s+/g, " ").trim();
  if (!말 || !소리를낼수있나()) return;
  try {
    globalThis.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(말);
    u.lang = "ko-KR";
    // 기본 속도는 이 앱을 쓰는 분들에게 빠르다. 조금 늦춘다.
    u.rate = 0.95;
    globalThis.speechSynthesis.speak(u);
  } catch {
    /* 목소리가 없거나 브라우저가 막았다. 화면 글은 그대로 있다. */
  }
};

/** 읽던 것을 멈춘다. 스위치를 끄거나 화면을 떠날 때 부른다. */
export const 그만읽기 = (): void => {
  try {
    globalThis.speechSynthesis?.cancel();
  } catch {
    /* 읽고 있던 것이 없으면 할 일도 없다. */
  }
};
