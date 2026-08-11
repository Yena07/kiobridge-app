import type { PlaceType, OrderSheet } from "@/domain/types";
// client.ts 의 KioBridgeError 를 그대로 쓴다. 화면은 이미 그 타입 하나로 오류를 다루고 있어서
// 계정 오류만 다른 타입이면 화면에 분기가 하나 더 생긴다. backend.ts 도 같은 방식이다.
import { KioBridgeError } from "@/api/client";
import { 연동기록, 팀백엔드모드, 본문을남길까 } from "@/api/devlog";

/**
 * 계정과 그 계정에 딸린 주문표.
 *
 * 로그인은 이 앱에서 끝까지 **선택**이다. 심사 항목이 "로그인하지 않아도 추천부터 최종
 * 확인까지 전 과정이 동작하는지" 이므로, 이 파일의 어떤 것도 주 흐름을 막지 않는다.
 * 로그인해서 얻는 것은 하나뿐이다 — 저장해 둔 주문표를 다음에도 불러오는 것.
 *
 * ── 백엔드가 주는 것 (modules/member) ─────────────────────────────────────────
 *
 *   POST /api/v1/auth/signup   { loginId, password } → 201 { userId, loginId }
 *   POST /api/v1/auth/login    { loginId, password } → 200 { userId, loginId }
 *   GET  /api/v1/users/{id}/profiles                 → 200 [ UserProfileResponse ]
 *   POST /api/v1/users/{id}/profiles                 → 200   UserProfileResponse
 *
 * ── 알고 써야 하는 것 세 가지 ────────────────────────────────────────────────
 *
 * 1. **토큰이 없다.** 응답이 { userId, loginId } 뿐이라 이후 주문표 요청은 userId 를
 *    경로에 넣어 부른다. 남의 userId 를 넣으면 남의 주문표가 열린다는 뜻이다.
 *    프론트에서 고칠 수 있는 문제가 아니라 docs/BACKEND_INTEGRATION.md 에 적어 두었다.
 *    그래서 화면 어디에도 "안전하게 보관됩니다" 같은 말을 쓰지 않는다.
 *
 * 2. **주문표는 지울 수 있고, 주문 기록은 못 지운다.** (팀 #79)
 *    DELETE /api/v1/users/{userId}/profiles/{profileId} 가 생겨서 '이 기기에서
 *    정보 지우기' 가 서버의 주문표까지 닿는다. 다만 키오스크에 보낸 승인.거절
 *    기록은 여전히 지우는 경로가 없다. 화면 문구도 둘을 나눠 적는다 -
 *    뭉뚱그려 "다 지워져요" 라고 하면 그게 거짓말이 된다.
 *
 * 3. **place 가 @NotBlank 다.** 장소를 안 고른 주문표는 서버가 400 으로 막는다.
 *    올리기 전에 여기서 걸러내고, 왜 안 올라갔는지 화면이 말한다.
 */

export interface Account {
  userId: number;
  loginId: string;
}

export interface AccountApi {
  signup(loginId: string, password: string): Promise<Account>;
  login(loginId: string, password: string): Promise<Account>;
  /** 이 계정이 서버에 저장해 둔 주문표. 없으면 빈 배열. */
  listSheets(userId: number): Promise<OrderSheet[]>;
  /** (userId, profileId) 기준 upsert. 같은 id 로 다시 부르면 덮어쓴다. */
  saveSheet(userId: number, sheet: OrderSheet): Promise<void>;
  /**
   * 서버에 저장된 주문표 하나를 지운다.
   *
   * 없는 것을 지워도 성공으로 친다(서버가 204). '이 기기에서 정보 지우기' 는
   * 화면에 있는 것을 전부 지우려 드는데, 그중 서버에 안 올라간 것도 섞여 있다.
   * 거기서 오류가 나면 지우는 도중에 멈춘다.
   */
  deleteSheet(userId: number, profileId: string): Promise<void>;
}

// ─── 입력 규칙 — 백엔드 제약을 그대로 옮긴다 ──────────────────────────────────
//
// 서버도 검사하지만 화면이 먼저 막는다. 이유는 서버 쪽 사정이다:
// @Valid 실패는 GlobalExceptionHandler 가 다루지 않아 스프링 기본 400 이 나가고,
// 그 본문에는 code·message 가 없다. 그대로 두면 사용자는 "요청을 처리하지 못했어요"
// 만 보고 무엇이 틀렸는지 알 수 없다.

/** SignupRequest.loginId — @Size(max = 50) */
export const LOGIN_ID_MAX = 50;
/** SignupRequest.password — @Size(min = 4) */
export const PASSWORD_MIN = 4;
/** bcrypt 상한. 서버가 UTF-8 바이트로 센다(@AssertTrue). 한글이면 24자쯤이다. */
export const PASSWORD_MAX_BYTES = 72;
/** SaveProfileRequest.menuName — @Size(max = 100) */
export const MENU_NAME_MAX = 100;
/** SaveProfileRequest.memo — @Size(max = 500) */
export const MEMO_MAX = 500;
/** SaveProfileRequest.profileId — @Size(max = 100) */
export const PROFILE_ID_MAX = 100;

const 바이트수 = (s: string) => new TextEncoder().encode(s).length;

/**
 * 아이디로 쓸 수 있는 값인가. 쓸 수 있으면 null, 아니면 사용자에게 보여 줄 이유.
 *
 * 공백만으로 된 아이디를 막는 이유 — 서버가 trim() 한 뒤 저장하므로 "  " 는 빈 문자열이
 * 되어 @NotBlank 에 걸린다. 여기서 먼저 말해 주지 않으면 400 만 돌아온다.
 */
export const 아이디검사 = (v: string): string | null => {
  const 값 = v.trim();
  if (!값) return "아이디를 적어 주세요";
  if (값.length > LOGIN_ID_MAX) return `아이디는 ${LOGIN_ID_MAX}자까지 쓸 수 있어요`;
  return null;
};

/**
 * 비밀번호로 쓸 수 있는 값인가.
 *
 * 길이는 글자 수로, 상한은 바이트로 잰다. 서버가 그렇게 검사하기 때문이다.
 * 한글 비밀번호는 한 글자가 3바이트라 24자가 넘으면 서버가 거절한다 —
 * 그 사실을 400 을 받고 나서가 아니라 적는 중에 알려 준다.
 */
export const 비밀번호검사 = (v: string): string | null => {
  if (!v) return "비밀번호를 적어 주세요";
  if (v.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요`;
  if (바이트수(v) > PASSWORD_MAX_BYTES) return "비밀번호가 너무 길어요. 조금 줄여 주세요";
  return null;
};

/**
 * 이 주문표를 서버에 못 올리는 이유. 올릴 수 있으면 null.
 *
 * 지어내지 않는다 — 장소가 비어 있으면 서버가 받아 주지 않으므로, 올린 척하지 않고
 * 무엇을 하면 올라가는지 말한다.
 *
 * 이름이 '올릴수있나' 였는데 반환값은 boolean 이 아니라 이유 문자열이다. 그래서
 * `!올릴수있나(p)` 가 "올릴 수 없나" 로 읽혔고, 부호를 반대로 고치기 쉬웠다.
 * 뒤집히면 장소가 빈 주문표가 서버로 가서 이유 없는 실패 안내를 받는다.
 * 이름을 반환값에 맞춘다 — `!못올리는이유(p)` 는 "못 올릴 이유가 없으면" 으로 읽힌다.
 */
/*
 * 메모에 개인정보로 보이는 것이 들어 있는가.
 *
 * 메모는 자유 입력이다. "얼음 적게 부탁드려요" 처럼 주문에 필요한 말을 적으라고
 * 둔 칸인데, 자유 입력인 이상 무엇이든 적을 수 있다. 이 앱은 실제 개인정보를
 * 받지도 저장하지도 않겠다고 화면에서 약속했고, 그 약속은 칸 옆의 안내 한 줄만으로
 * 지켜지지 않는다. 안내를 못 보거나 습관대로 적는 사람이 있다.
 *
 * ── 이 검사가 무엇을 하고 무엇을 못 하는지 ─────────────────────────────────
 *
 *   막는다      전화번호, 주민등록번호, 주소로 보이는 것(행정구역 + 번지·호)
 *   못 막는다   사람 이름, 환자번호, 그 밖에 정해진 모양이 없는 것
 *
 * **못 막는 쪽이 있다는 것이 이 함수의 핵심이다.** 모양이 없는 값은 정규식으로
 * 가려낼 수 없다. "이름은 안 받습니다" 라고 말할 근거는 이 함수가 아니라,
 * 이 앱에 이름을 받는 칸이 하나도 없다는 사실이다(호칭은 이 기기 밖으로
 * 나가지 않는다). 메모는 그 원칙에 뚫린 구멍이고, 여기서는 모양이 있는 것만
 * 막는다. 그 한계를 docs/BACKEND_INTEGRATION.md 와 README 에도 같은 말로 적었다 —
 * 구현이 보장하지 못하는 것을 문서가 단정하면 그게 더 나쁘다.
 *
 * 걸러도 지우지는 않는다. 사용자가 적은 것을 앱이 말없이 고치면, 화면에 보이는
 * 것과 저장된 것이 달라진다. 무엇을 지워야 하는지 말해 주고 사용자가 고친다.
 */
const 전화번호꼴 = /\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}/;
const 주민번호꼴 = /\d{6}[-.\s]?[1-4]\d{6}/;
/*
 * 주소는 행정구역 이름만으로 보지 않는다. "강남역 앞에서 받을게요" 처럼 장소를
 * 가리키는 말은 주문에 필요한 정보다. 번지·호수까지 있어야 사는 곳으로 본다.
 *   막힌다  "서울시 강남구 역삼동 123-4"  ·  "역삼로 12길 5"  ·  "101동 202호"
 *   안 막힌다  "강남역 앞"  ·  "2층에서 받을게요"
 */
const 주소꼴 =
  /([가-힣]{2,}(시|군|구|읍|면|동|리)\s*)?[가-힣]{2,}(로|길)\s*\d+|[가-힣]{2,}(동|리)\s*\d+\s*-\s*\d+|\d+\s*동\s*\d+\s*호/;
export const 개인정보같은메모 = (memo: string): boolean =>
  주민번호꼴.test(memo) || 전화번호꼴.test(memo) || 주소꼴.test(memo);

export const 못올리는이유 = (p: OrderSheet): string | null => {
  if (!p.place) return "장소를 정해 두시면 다음에도 불러올 수 있어요";
  if (개인정보같은메모(p.memo ?? "")) {
    return "메모에 전화번호·주민등록번호·주소처럼 보이는 것이 있어요. 지우고 다시 저장해 주세요";
  }
  if (!p.menuName.trim()) return "메뉴 이름이 있어야 저장할 수 있어요";
  if (p.menuName.length > MENU_NAME_MAX) return `메뉴 이름은 ${MENU_NAME_MAX}자까지 저장돼요`;
  if ((p.memo ?? "").length > MEMO_MAX) return `메모는 ${MEMO_MAX}자까지 저장돼요`;
  if (p.id.length > PROFILE_ID_MAX) return "주문표를 저장할 수 없어요";
  /*
   * 값이 빈 축이 섞이면 서버가 400 으로 막는다(팀 #79 의 @NotEmpty).
   *
   * 화면(toggleChip)에서 애초에 빈 축을 안 만들도록 고쳤지만 여기에도 둔다.
   * 이 함수는 서버 제약을 그대로 옮겨 둔 자리이고, 서버가 막는 것을 여기서
   * 먼저 말해 주는 것이 이 파일의 방침이다. 화면 쪽 한 곳만 믿으면 다른 경로로
   * 만들어진 주문표에서 같은 400 이 되살아난다.
   */
  if (Object.values(p.selections ?? {}).some((v) => v.length === 0)) {
    return "고르신 항목 중 비어 있는 것이 있어요. 다시 골라 주세요";
  }
  return null;
};

// ─── 서버 응답 ↔ 화면 타입 ────────────────────────────────────────────────────

/**
 * UserProfileResponse.
 *
 * 필드를 전부 unknown 으로 받는다. 서버가 준 값이 선언한 모양이라고 단정하면
 * 그 단정이 틀렸을 때 화면이 대신 깨진다. 아래에서 하나씩 좁혀서 읽는다.
 */
interface UserProfileResponse {
  profileId: string;
  menuName: string;
  place: string;
  selections: unknown;
  memo: string | null;
}

const 장소목록: NonNullable<PlaceType>[] = ["카페", "음식점", "병원", "관공서"];

/**
 * 서버가 준 place 문자열을 화면이 아는 장소로 좁힌다.
 *
 * 모르는 값이면 null 이다. 아무 장소로나 떨어뜨리면 병원 주문표가 음식점으로 되살아나고,
 * 그 주문표로 주문하면 어르신이 병원에서 닭강정을 승인하라는 화면을 받는다.
 */
const 장소읽기 = (v: string): PlaceType =>
  (장소목록 as string[]).includes(v) ? (v as PlaceType) : null;

/**
 * 서버가 준 선택 항목을 화면이 아는 모양으로 좁힌다.
 *
 * place 는 좁히면서 selections 는 `?? {}` 만 하고 넘겼었다. 서버가
 * `{"맵기": "매운맛"}` 처럼 배열이 아닌 값을 주면 그게 그대로 화면까지 간다.
 * 이 값은 확인 카드가 "이렇게 고르셨어요" 라고 읽어 주는 값이라, 모양이
 * 어긋나면 사용자가 고른 적 없는 조건이 섞이거나 그리다가 터진다.
 *
 * 모르는 모양은 버린다. 지어내지 않는다 — 빠진 조건은 화면이 안 보여 주면 그만이지만,
 * 틀린 조건을 보여 주면 그걸 보고 승인한다.
 */
const 선택읽기 = (v: unknown): Record<string, string[]> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const 결과: Record<string, string[]> = {};
  for (const [축, 값] of Object.entries(v as Record<string, unknown>)) {
    if (!Array.isArray(값)) continue;
    const 고른것 = 값.filter((x): x is string => typeof x === "string");
    if (고른것.length > 0) 결과[축] = 고른것;
  }
  return 결과;
};

const 주문표읽기 = (r: UserProfileResponse): OrderSheet => ({
  id: r.profileId,
  menuName: r.menuName,
  place: 장소읽기(r.place),
  selections: 선택읽기(r.selections),
  memo: r.memo ?? "",
});

/**
 * 주문표를 한 겹 더 깊이 복사한다.
 *
 * `{ ...주문표 }` 는 한 겹만 복사해서 selections 의 배열이 그대로 공유된다. 목 저장소와
 * React 상태가 같은 객체를 가리키게 되고, 어느 쪽에서 제자리 수정이 일어나도 반대쪽이
 * 같이 바뀐다 — 올리지도 않은 변경이 '서버에 저장된 값' 으로 보인다.
 * 실서버는 JSON 을 오가므로 그런 일이 없다. 목도 같아야 목에서만 나는 버그가 안 생긴다.
 */
const 주문표복사 = (p: OrderSheet): OrderSheet => ({
  ...p,
  selections: Object.fromEntries(Object.entries(p.selections ?? {}).map(([축, 값]) => [축, [...값]])),
});

// ─── 목 구현 ──────────────────────────────────────────────────────────────────

let 목지연 = 500;
/** 시연에서는 기다리는 편이 자연스럽고 테스트에서는 순수한 대기다. client.ts 와 같은 손잡이. */
export const setAccountMockDelay = (ms: number): void => { 목지연 = ms; };

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/*
 * 목은 브라우저 메모리에만 있다. 새로고침하면 계정도 주문표도 사라진다.
 *
 * 비밀번호를 평문으로 들고 있는데, 이 Map 은 탭이 살아 있는 동안 그 탭 안에만 존재하고
 * 네트워크로 나가지도 디스크에 남지도 않는다. 실제 저장은 서버가 bcrypt 로 한다.
 * 어느 저장소로도 옮기지 말 것 — 옮기는 순간 평문 비밀번호가 디스크에 남는다.
 * 화면이 이어 쓰는 이용 기록(api/session.ts)에도 비밀번호는 담지 않는다.
 *
 * 그래서 목으로 돌릴 때는 새로고침 뒤에 화면만 로그인 상태로 남고 여기는 비어 있다.
 * 터지지는 않는다 — saveSheet 도 listSheets 도 계정이 있는지 따로 묻지 않고 userId
 * 로만 찾는다. 목은 붙이기 전에 화면을 굴려 보려고 두는 것이라 여기까지 맞추지 않는다.
 */
const 계정들 = new Map<string, { userId: number; password: string }>();
const 서버주문표 = new Map<number, Map<string, OrderSheet>>();
let 다음userId = 1;

export const mockAccount: AccountApi = {
  async signup(loginId, password) {
    await delay(목지연);
    const 아이디 = loginId.trim();
    // 서버와 같은 순서로 검사한다. 화면이 먼저 막지만 목도 자기 검사를 한다 —
    // 한쪽만 막으면 구현을 바꿀 때 샌다. backend.ts 의 승인 가드와 같은 이유다.
    const 아이디문제 = 아이디검사(아이디);
    if (아이디문제) throw new KioBridgeError("INVALID_REQUEST", 아이디문제, true);
    const 비번문제 = 비밀번호검사(password);
    if (비번문제) throw new KioBridgeError("INVALID_REQUEST", 비번문제, true);
    if (계정들.has(아이디)) {
      throw new KioBridgeError("LOGIN_ID_DUPLICATED", "이미 쓰고 있는 아이디예요", true);
    }
    const userId = 다음userId++;
    계정들.set(아이디, { userId, password });
    return { userId, loginId: 아이디 };
  },

  async login(loginId, password) {
    await delay(목지연);
    const 아이디 = loginId.trim();
    const 계정 = 계정들.get(아이디);
    // 아이디가 없는 것과 비밀번호가 틀린 것을 구분해서 답하지 않는다.
    // 구분해 주면 어떤 아이디가 있는지 하나씩 확인할 수 있다. 서버도 같은 예외를 쓴다.
    if (!계정 || 계정.password !== password) {
      throw new KioBridgeError("INVALID_CREDENTIALS", "아이디 또는 비밀번호가 맞지 않아요", true);
    }
    return { userId: 계정.userId, loginId: 아이디 };
  },

  async listSheets(userId) {
    await delay(목지연);
    // 저장된 객체를 그대로 돌려주면 화면이 그걸 React 상태에 넣고, 이후 화면에서
    // 고치는 순간 목 저장소도 같이 바뀐다. 나갈 때도 복사한다.
    return [...(서버주문표.get(userId)?.values() ?? [])].map(주문표복사);
  },

  async saveSheet(userId, sheet) {
    await delay(목지연);
    const 문제 = 못올리는이유(sheet);
    if (문제) throw new KioBridgeError("INVALID_REQUEST", 문제, true);
    const 것들 = 서버주문표.get(userId) ?? new Map<string, OrderSheet>();
    // 서버가 (userId, profileId) 유일 제약으로 upsert 한다. 목도 같게 둔다.
    것들.set(sheet.id, 주문표복사(sheet));
    서버주문표.set(userId, 것들);
  },

  async deleteSheet(userId, profileId) {
    await delay(목지연);
    // 없는 것을 지워도 오류로 두지 않는다. 서버가 204 라 목도 같게 둔다.
    서버주문표.get(userId)?.delete(profileId);
  },
};

/** 테스트가 목 저장소를 비운다. 앱은 부르지 않는다. */
export const clearAccountMock = (): void => {
  계정들.clear();
  서버주문표.clear();
  다음userId = 1;
};

// ─── 실서버 구현 ──────────────────────────────────────────────────────────────

/**
 * 서버 오류 코드를 사용자에게 할 말로 바꾼다.
 *
 * 서버 문구를 그대로 올리지 않는다. GlobalExceptionHandler 가 돌려주는 문장은
 * 개발자를 향해 쓰여 있고, @Valid 실패는 아예 code 도 message 도 없는 스프링 기본
 * 400 이라 그대로 보여 주면 빈칸이 된다. 모르는 코드일 때만 서버 문구로 물러난다.
 */
const 문구 = (code: string, 서버문구: string | undefined, status: number): string => {
  switch (code) {
    case "LOGIN_ID_DUPLICATED": return "이미 쓰고 있는 아이디예요. 다른 아이디로 해 주세요";
    case "INVALID_CREDENTIALS": return "아이디 또는 비밀번호가 맞지 않아요";
    case "USER_NOT_FOUND":      return "계정을 찾을 수 없어요. 다시 로그인해 주세요";
    case "INVALID_REQUEST":     return 서버문구 || "적어 주신 내용을 다시 확인해 주세요";
    default:
      if (status === 400) return "적어 주신 내용을 다시 확인해 주세요";
      if (status >= 500) return "서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요";
      return 서버문구 || "요청을 처리하지 못했어요";
  }
};

/**
 * 기본 주소는 /api/bff 다. 이 앱의 서버 함수가 백엔드로 대신 보내 주므로 브라우저는
 * 같은 출처로만 요청하고 CORS 가 발생하지 않는다. backend.ts 의 createTeamBackend 와 같다.
 */
export function createTeamAccount(baseUrl = "/api/bff"): AccountApi {
  const 부르기 = async <T>(방법: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> => {
    const 시작 = 팀백엔드모드 ? performance.now() : 0;
    /*
     * 가입.로그인 경로는 본문을 남기지 않는다 — 비밀번호가 화면 구석 패널과
     * ?log=1 화면에 그대로 뜬다. 안 남겼다는 사실은 '가림' 으로 표시해서,
     * 보는 사람이 '비어 있는 것' 과 '일부러 안 남긴 것' 을 헷갈리지 않게 한다.
     *
     * 주문표 경로(users/{id}/profiles)는 남긴다. 실리는 것이 주문 조건뿐이고,
     * 그게 서버에서 온 값이라는 걸 확인하려고 만든 화면이라 안 남기면 쓸모가 없다.
     */
    const 남길까 = 본문을남길까(path);
    const 적기 = (상태: number | "실패", 응답본문?: string) => {
      if (!팀백엔드모드) return;
      연동기록.남기기({
        방법, 경로: path, 상태,
        걸린시간: Math.round(performance.now() - 시작), 시각: Date.now(),
        ...(남길까
          ? {
              ...(body === undefined ? {} : { 요청: JSON.stringify(body) }),
              ...(응답본문 === undefined ? {} : { 응답: 응답본문 }),
            }
          : { 가림: true as const }),
      });
    };

    /*
     * 브라우저 ↔ BFF 구간도 끊는다.
     *
     * api/bff.ts 가 15초에 끊는 것은 BFF ↔ 백엔드 구간이다. 브라우저에서 BFF 까지
     * 가는 길이 매달리면 이 프로미스는 영영 끝나지 않는다. 그러면 SignupScreen 과
     * LoginScreen 은 보내는중 을 .catch 에서만 되돌리므로 버튼이 잠긴 채로 남고,
     * 사용자는 나갈 길 없이 "가입하는 중" 앞에 갇힌다.
     * BFF 상한보다 넉넉히 두어, 백엔드가 늦은 경우에는 BFF 의 504 가 먼저 오게 한다.
     */
    const ac = new AbortController();
    const 시계 = setTimeout(() => ac.abort(), 20_000);

    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        method: 방법,
        signal: ac.signal,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      적기("실패");
      const 시간초과 = (e as Error)?.name === "AbortError";
      throw new KioBridgeError(
        시간초과 ? "TIMEOUT" : "NETWORK_ERROR",
        시간초과 ? "응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요" : "연결하지 못했어요",
        true,
      );
    } finally {
      clearTimeout(시계);
    }
    // 본문은 한 번만 읽을 수 있다. 성공.실패 양쪽에서 쓰므로 먼저 문자열로 받아 둔다.
    // 스트림이 중간에 끊기면 여기서 null 이 된다 — res.json() 과 달리 막혀 있지 않아서
    // 예전에는 TypeError 가 그대로 화면까지 올라갔다.
    const t = await res.text().catch(() => null);
    적기(res.status, t ?? undefined);

    if (!res.ok) {
      const b = (() => {
        try { return JSON.parse(t ?? "") as { code?: string; message?: string }; } catch { return {}; }
      })();
      const code = b.code ?? `HTTP_${res.status}`;
      // 계정 쪽 오류는 전부 recoverable 이다. 아이디가 겹쳤으면 다른 아이디로, 비밀번호가
      // 틀렸으면 다시 적으면 되고, 서버가 죽었으면 잠시 뒤 다시 하면 된다. 화면이
      // 되돌아갈 길 없는 막다른 곳으로 사용자를 보내지 않게 하는 값이라 여기서는 늘 참이다.
      throw new KioBridgeError(code, 문구(code, b.message, res.status), true);
    }

    if (t === null) throw new KioBridgeError("BAD_RESPONSE", "서버 응답을 읽지 못했어요", true);
    if (!t) return undefined as T;
    try {
      return JSON.parse(t) as T;
    } catch {
      /*
       * 이 함수는 "모든 실패를 KioBridgeError 로 바꾼다" 가 계약이다. 여기가 뚫려 있었다.
       * 백엔드가 200 으로 JSON 이 아닌 것(프록시가 끼워 넣은 HTML 같은 것)을 주면
       * SyntaxError 가 그대로 올라가고, 화면은 e.message 를 그대로 보여 준다 —
       * 어르신 화면에 "Unexpected token '<'" 가 뜬다. recoverable 도 undefined 가 된다.
       */
      throw new KioBridgeError("BAD_RESPONSE", "서버 응답을 읽지 못했어요", true);
    }
  };

  return {
    signup: (loginId, password) =>
      부르기<Account>("POST", "/api/v1/auth/signup", { loginId: loginId.trim(), password }),

    login: (loginId, password) =>
      부르기<Account>("POST", "/api/v1/auth/login", { loginId: loginId.trim(), password }),

    async listSheets(userId) {
      const r = await 부르기<UserProfileResponse[]>("GET", `/api/v1/users/${encodeURIComponent(userId)}/profiles`);
      if (r == null) return [];
      // 배열이 아닌 것이 오면 .map 에서 TypeError 가 난다. 그 오류는 KioBridgeError 가
      // 아니라서 화면이 개발자 문장을 그대로 보여 준다. 이 함수의 계약을 지킨다.
      if (!Array.isArray(r)) throw new KioBridgeError("BAD_RESPONSE", "서버 응답을 읽지 못했어요", true);
      // 원소가 객체가 아니면 그 항목만 버린다. 하나가 이상하다고 저장해 둔 주문표를
      // 전부 못 불러오게 하지 않는다.
      return r.filter((x): x is UserProfileResponse => Boolean(x) && typeof x === "object").map(주문표읽기);
    },

    async saveSheet(userId, sheet) {
      // 서버가 400 으로 막을 것을 미리 거른다. 400 은 code 없는 스프링 기본 응답이라
      // 사용자에게 무엇이 문제인지 말해 줄 수 없다.
      const 문제 = 못올리는이유(sheet);
      if (문제) throw new KioBridgeError("PROFILE_NOT_UPLOADABLE", 문제, true);
      await 부르기<UserProfileResponse>("POST", `/api/v1/users/${encodeURIComponent(userId)}/profiles`, {
        profileId: sheet.id,
        menuName: sheet.menuName.trim(),
        // 위에서 place 가 비어 있으면 걸렀으므로 여기서는 반드시 있다.
        place: sheet.place,
        selections: sheet.selections ?? {},
        memo: sheet.memo ?? "",
      });
    },

    async deleteSheet(userId, profileId) {
      await 부르기<void>(
        "DELETE",
        `/api/v1/users/${encodeURIComponent(userId)}/profiles/${encodeURIComponent(profileId)}`,
      );
    },
  };
}

/**
 * 화면이 쓰는 계정 API.
 *
 * client.ts 의 api 와 같은 스위치를 쓴다. 목과 실서버가 따로 놀면 npm run dev:team 에서
 * 주문은 실서버로 가는데 로그인은 목으로 가는 상태가 되고, 그때 화면은 아무 말도 하지 않는다.
 */
export const account: AccountApi =
  __TEAM_BACKEND__ ? createTeamAccount() : mockAccount;
