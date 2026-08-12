/**
 * 말을 듣는다.
 *
 * ── 지금은 브라우저가 듣는다 ────────────────────────────────────────────────
 *
 * 브라우저의 SpeechRecognition 을 쓴다. 그래서 **소리가 이 기기 밖으로 안 나간다.**
 *
 * 백엔드로 오디오를 보내 STT 를 돌리는 길도 있다. 그쪽이 잘 알아듣지만, 지금
 * 개인정보 화면은 "이 기기 밖으로 나가지 않아요" 라고 말하고 있다. 목소리는 그
 * 자체로 사람을 알아볼 수 있는 값이라, 그 문장을 고치지 않고 내보낼 수는 없다.
 *
 * 서버로 옮기게 되면 고쳐야 할 것이 이 파일 하나가 아니다 — 개인정보 화면 문구,
 * 동의 받는 자리, 오디오를 안 남긴다는 약속까지 같이 간다. 그때 볼 것은
 * docs/VOICE_PROFILE_BUILD_SPEC.md 에 적어 두었다.
 *
 * ── 되는지 먼저 보고 내민다 ─────────────────────────────────────────────────
 *
 * 안 되는 기기에서는 단추 자체를 안 보여 준다. 눌렀는데 아무 일도 안 일어나면
 * 사용자는 앱이 고장 났다고 생각한다. speech.ts 의 `소리를낼수있나` 와 같은
 * 판단이다 — 못 하는 것을 한다고 말하지 않는다.
 */

interface 듣기엔진 {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

const 엔진만들기 = (): 듣기엔진 | null => {
  try {
    const g = globalThis as unknown as {
      SpeechRecognition?: new () => 듣기엔진;
      webkitSpeechRecognition?: new () => 듣기엔진;
    };
    const 만들기 = g.SpeechRecognition ?? g.webkitSpeechRecognition;
    return 만들기 ? new 만들기() : null;
  } catch {
    return null;
  }
};

/** 이 기기에서 말을 들을 수 있는가. 화면이 단추를 내밀지 말지 이걸로 정한다. */
export const 들을수있나 = (): boolean => 엔진만들기() !== null;

export type 못들은이유 = "권한없음" | "소리없음" | "안됨";

/**
 * 한 번 듣는다.
 *
 * 성공하면 들은 글, 실패하면 왜 못 들었는지를 준다. 던지지 않는다 — 음성은
 * 더해 주는 길이고, 안 되면 손으로 고르는 길이 그대로 있다.
 *
 * `그만두기` 를 부르면 지금까지 들은 것으로 끝낸다. 말을 마쳤는데 앱이 계속
 * 듣고 있으면 사용자는 언제 끝나는지 알 수 없다.
 */
export const 들어보기 = (
  언어: string,
  받기: (결과: { 들은말: string } | { 못들은이유: 못들은이유 }) => void,
): { 그만두기: () => void } => {
  const 엔진 = 엔진만들기();
  if (!엔진) {
    받기({ 못들은이유: "안됨" });
    return { 그만두기: () => {} };
  }

  let 끝났나 = false;
  const 한번만 = (결과: { 들은말: string } | { 못들은이유: 못들은이유 }) => {
    if (끝났나) return;
    끝났나 = true;
    받기(결과);
  };

  엔진.lang = 언어;
  // 한 번 말하고 끝낸다. 계속 듣게 두면 옆 사람 말까지 들어간다.
  엔진.continuous = false;
  엔진.interimResults = false;
  엔진.maxAlternatives = 1;

  엔진.onresult = (e) => {
    const 글 = e.results?.[0]?.[0]?.transcript ?? "";
    한번만(글.trim() ? { 들은말: 글.trim() } : { 못들은이유: "소리없음" });
  };
  엔진.onerror = (e) => {
    const 코드 = e?.error ?? "";
    한번만({
      못들은이유:
        코드 === "not-allowed" || 코드 === "service-not-allowed" ? "권한없음"
          : 코드 === "no-speech" ? "소리없음"
            : "안됨",
    });
  };
  // 아무 결과 없이 끝나는 경우가 있다(조용히 시간이 다 간 때). 그때도 답한다.
  엔진.onend = () => 한번만({ 못들은이유: "소리없음" });

  try {
    엔진.start();
  } catch {
    한번만({ 못들은이유: "안됨" });
  }

  return {
    그만두기: () => {
      try { 엔진.stop(); } catch { /* 이미 끝났다 */ }
    },
  };
};
