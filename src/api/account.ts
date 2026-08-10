import type { PlaceType, ProfileData } from "@/domain/types";
// client.ts 의 KioBridgeError 를 그대로 쓴다. 화면은 이미 그 타입 하나로 오류를 다루고 있어서
// 계정 오류만 다른 타입이면 화면에 분기가 하나 더 생긴다. backend.ts 도 같은 방식이다.
import { KioBridgeError } from "@/api/client";
import { 연동기록, 팀백엔드모드 } from "@/api/devlog";

/**
 * 계정과 그 계정에 딸린 프로필.
 *
 * 로그인은 이 앱에서 끝까지 **선택**이다. 심사 항목이 "로그인하지 않아도 추천부터 최종
 * 확인까지 전 과정이 동작하는지" 이므로, 이 파일의 어떤 것도 주 흐름을 막지 않는다.
 * 로그인해서 얻는 것은 하나뿐이다 — 저장해 둔 프로필을 다음에도 불러오는 것.
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
 * 1. **토큰이 없다.** 응답이 { userId, loginId } 뿐이라 이후 프로필 요청은 userId 를
 *    경로에 넣어 부른다. 남의 userId 를 넣으면 남의 프로필이 열린다는 뜻이다.
 *    프론트에서 고칠 수 있는 문제가 아니라 docs/BACKEND_INTEGRATION.md 에 적어 두었다.
 *    그래서 화면 어디에도 "안전하게 보관됩니다" 같은 말을 쓰지 않는다.
 *
 * 2. **프로필 삭제 경로가 없다.** 화면에서 프로필을 지워도 서버에는 남는다.
 *    '이 기기에서 정보 지우기' 가 서버까지 닿지 못하므로 그 화면의 문구도 그렇게 적었다.
 *
 * 3. **place 가 @NotBlank 다.** 장소를 안 고른 프로필은 서버가 400 으로 막는다.
 *    올리기 전에 여기서 걸러내고, 왜 안 올라갔는지 화면이 말한다.
 */

export interface Account {
  userId: number;
  loginId: string;
}

export interface AccountApi {
  signup(loginId: string, password: string): Promise<Account>;
  login(loginId: string, password: string): Promise<Account>;
  /** 이 계정이 서버에 저장해 둔 프로필. 없으면 빈 배열. */
  listProfiles(userId: number): Promise<ProfileData[]>;
  /** (userId, profileId) 기준 upsert. 같은 id 로 다시 부르면 덮어쓴다. */
  saveProfile(userId: number, profile: ProfileData): Promise<void>;
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
 * 이 프로필을 서버에 올릴 수 있는가. 올릴 수 있으면 null, 아니면 못 올리는 이유.
 *
 * 지어내지 않는다 — 장소가 비어 있으면 서버가 받아 주지 않으므로, 올린 척하지 않고
 * 무엇을 하면 올라가는지 말한다.
 */
export const 올릴수있나 = (p: ProfileData): string | null => {
  if (!p.place) return "장소를 정해 두시면 다음에도 불러올 수 있어요";
  if (!p.menuName.trim()) return "메뉴 이름이 있어야 저장할 수 있어요";
  if (p.menuName.length > MENU_NAME_MAX) return `메뉴 이름은 ${MENU_NAME_MAX}자까지 저장돼요`;
  if ((p.memo ?? "").length > MEMO_MAX) return `메모는 ${MEMO_MAX}자까지 저장돼요`;
  if (p.id.length > PROFILE_ID_MAX) return "프로필을 저장할 수 없어요";
  return null;
};

// ─── 서버 응답 ↔ 화면 타입 ────────────────────────────────────────────────────

/** UserProfileResponse. place 가 문자열이라 화면 타입으로 좁혀서 받는다. */
interface UserProfileResponse {
  profileId: string;
  menuName: string;
  place: string;
  selections: Record<string, string[]>;
  memo: string | null;
}

const 장소목록: NonNullable<PlaceType>[] = ["카페", "음식점", "병원", "관공서"];

/**
 * 서버가 준 place 문자열을 화면이 아는 장소로 좁힌다.
 *
 * 모르는 값이면 null 이다. 아무 장소로나 떨어뜨리면 병원 프로필이 음식점으로 되살아나고,
 * 그 프로필로 주문하면 어르신이 병원에서 닭강정을 승인하라는 화면을 받는다.
 */
const 장소읽기 = (v: string): PlaceType =>
  (장소목록 as string[]).includes(v) ? (v as PlaceType) : null;

const 프로필로 = (r: UserProfileResponse): ProfileData => ({
  id: r.profileId,
  menuName: r.menuName,
  place: 장소읽기(r.place),
  selections: r.selections ?? {},
  memo: r.memo ?? "",
});

// ─── 목 구현 ──────────────────────────────────────────────────────────────────

let 목지연 = 500;
/** 시연에서는 기다리는 편이 자연스럽고 테스트에서는 순수한 대기다. client.ts 와 같은 손잡이. */
export const setAccountMockDelay = (ms: number): void => { 목지연 = ms; };

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/*
 * 목은 브라우저 메모리에만 있다. 새로고침하면 계정도 프로필도 사라진다.
 *
 * 비밀번호를 평문으로 들고 있는데, 이 Map 은 탭이 살아 있는 동안 그 탭 안에만 존재하고
 * 네트워크로 나가지도 디스크에 남지도 않는다. 실제 저장은 서버가 bcrypt 로 한다.
 * localStorage 로 옮기지 말 것 — 옮기는 순간 평문 비밀번호가 디스크에 남는다.
 */
const 계정들 = new Map<string, { userId: number; password: string }>();
const 서버프로필 = new Map<number, Map<string, ProfileData>>();
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

  async listProfiles(userId) {
    await delay(목지연);
    return [...(서버프로필.get(userId)?.values() ?? [])];
  },

  async saveProfile(userId, profile) {
    await delay(목지연);
    const 문제 = 올릴수있나(profile);
    if (문제) throw new KioBridgeError("INVALID_REQUEST", 문제, true);
    const 것들 = 서버프로필.get(userId) ?? new Map<string, ProfileData>();
    // 서버가 (userId, profileId) 유일 제약으로 upsert 한다. 목도 같게 둔다.
    것들.set(profile.id, { ...profile });
    서버프로필.set(userId, 것들);
  },
};

/** 테스트가 목 저장소를 비운다. 앱은 부르지 않는다. */
export const clearAccountMock = (): void => {
  계정들.clear();
  서버프로필.clear();
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
  const 부르기 = async <T>(방법: "GET" | "POST", path: string, body?: unknown): Promise<T> => {
    const 시작 = 팀백엔드모드 ? performance.now() : 0;
    const 적기 = (상태: number | "실패") => {
      if (!팀백엔드모드) return;
      // 경로와 상태만 남긴다. 본문은 남기지 않는다 — 비밀번호가 화면 구석 패널에 뜬다.
      연동기록.남기기({ 방법, 경로: path, 상태, 걸린시간: Math.round(performance.now() - 시작), 시각: Date.now() });
    };

    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        method: 방법,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      적기("실패");
      throw new KioBridgeError("NETWORK_ERROR", "연결하지 못했어요", true);
    }
    적기(res.status);

    if (!res.ok) {
      const b = await res.json().catch(() => ({} as { code?: string; message?: string }));
      const code = b.code ?? `HTTP_${res.status}`;
      // 계정 쪽 오류는 전부 recoverable 이다. 아이디가 겹쳤으면 다른 아이디로, 비밀번호가
      // 틀렸으면 다시 적으면 되고, 서버가 죽었으면 잠시 뒤 다시 하면 된다. 화면이
      // 되돌아갈 길 없는 막다른 곳으로 사용자를 보내지 않게 하는 값이라 여기서는 늘 참이다.
      throw new KioBridgeError(code, 문구(code, b.message, res.status), true);
    }
    const t = await res.text();
    return (t ? JSON.parse(t) : undefined) as T;
  };

  return {
    signup: (loginId, password) =>
      부르기<Account>("POST", "/api/v1/auth/signup", { loginId: loginId.trim(), password }),

    login: (loginId, password) =>
      부르기<Account>("POST", "/api/v1/auth/login", { loginId: loginId.trim(), password }),

    async listProfiles(userId) {
      const r = await 부르기<UserProfileResponse[]>("GET", `/api/v1/users/${encodeURIComponent(userId)}/profiles`);
      return (r ?? []).map(프로필로);
    },

    async saveProfile(userId, profile) {
      // 서버가 400 으로 막을 것을 미리 거른다. 400 은 code 없는 스프링 기본 응답이라
      // 사용자에게 무엇이 문제인지 말해 줄 수 없다.
      const 문제 = 올릴수있나(profile);
      if (문제) throw new KioBridgeError("PROFILE_NOT_UPLOADABLE", 문제, true);
      await 부르기<UserProfileResponse>("POST", `/api/v1/users/${encodeURIComponent(userId)}/profiles`, {
        profileId: profile.id,
        menuName: profile.menuName.trim(),
        // 위에서 place 가 비어 있으면 걸렀으므로 여기서는 반드시 있다.
        place: profile.place,
        selections: profile.selections ?? {},
        memo: profile.memo ?? "",
      });
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
  import.meta.env.VITE_BACKEND === "team" ? createTeamAccount() : mockAccount;
