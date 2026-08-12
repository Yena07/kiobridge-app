/**
 * 말을 듣는다.
 *
 * ── 기기 안에서 처리될 때만 듣는다 ──────────────────────────────────────────
 *
 * 브라우저의 SpeechRecognition 을 쓴다. **다만 이것만으로는 소리가 기기 밖으로
 * 안 나간다고 말할 수 없다.**
 *
 * 처음에 그렇게 적었는데 틀렸다. 표준의 `processLocally` 는 기본값이 false 이고,
 * 그 상태에서는 브라우저가 기기 안에서 처리할지 **제 서버로 보낼지 마음대로
 * 고른다.** 크롬 계열은 실제로 구글 서버로 보낸다. 개인정보 화면이 "이 기기
 * 밖으로 나가지 않아요" 라고 말하고 있는데, 목소리는 그 자체로 사람을 알아볼 수
 * 있는 값이라 그 문장을 어긴 셈이 됐다(#39 리뷰).
 *
 * 그래서 두 가지를 한다.
 *
 *   1. `processLocally = true` 를 켠다. 기기 안에서 처리하라고 명시한다.
 *   2. **그 스위치가 있는 브라우저에서만 단추를 내민다.** 없는 브라우저에서는
 *      소리가 어디로 가는지 우리가 알 수 없으므로 아예 안 듣는다.
 *
 * 쓸 수 있는 사람이 줄어드는 것은 안다. 그래도 "안 나간다" 고 말해 놓고 나가는
 * 것보다 낫다. 손으로 고르는 길은 그대로 있다.
 *
 * 서버로 보내 STT 를 돌리는 길은 그쪽이 훨씬 잘 알아듣는다. 그렇게 하려면 고칠
 * 것이 이 파일 하나가 아니다 — 개인정보 화면 문구, 동의 받는 자리, 오디오를 안
 * 남긴다는 약속까지 같이 간다. 그때 볼 것은 docs/VOICE_PROFILE_BUILD_SPEC.md 다.
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
  /** 기기 안에서 처리하라. 표준 기본값은 false 라 반드시 켜서 보낸다. */
  processLocally: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

const 만들기찾기 = (): (new () => 듣기엔진) | null => {
  try {
    const g = globalThis as unknown as {
      SpeechRecognition?: new () => 듣기엔진;
      webkitSpeechRecognition?: new () => 듣기엔진;
    };
    return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
  } catch {
    return null;
  }
};

const 엔진만들기 = (): 듣기엔진 | null => {
  const 만들기 = 만들기찾기();
  try {
    return 만들기 ? new 만들기() : null;
  } catch {
    return null;
  }
};

/**
 * 이 기기에서 말을 들을 수 있는가. 화면이 단추를 내밀지 말지 이걸로 정한다.
 *
 * 인식기가 있는 것만으로는 부족하다. **기기 안에서 처리하라고 말할 수 있는
 * 브라우저인지**까지 본다. 그 스위치가 없으면 소리가 어디로 가는지 우리가 알 수
 * 없고, 모르는 채로 마이크를 켜면 개인정보 화면의 약속을 어기게 된다.
 *
 * 스위치가 있는지는 프로토타입에 그 이름이 있는지로 본다. 없는 브라우저에 그냥
 * 대입하면 아무 일도 안 일어나고 조용히 서버로 나간다 — 그게 제일 나쁘다.
 */
export const 들을수있나 = (): boolean => {
  const 만들기 = 만들기찾기();
  return 만들기 !== null && "processLocally" in 만들기.prototype;
};

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
  // 들을수있나() 를 한 번 더 본다. 화면이 안 물어보고 부를 수도 있고, 그때
  // 조용히 서버로 나가는 것보다 안 듣는 쪽이 맞다.
  const 엔진 = 들을수있나() ? 엔진만들기() : null;
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
  // 기기 안에서 처리하라. 이 줄이 이 파일에서 제일 중요하다 — 안 켜면 브라우저가
  // 제 서버로 보내도 되고, 그러면 "이 기기 밖으로 나가지 않아요" 가 거짓이 된다.
  엔진.processLocally = true;
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
