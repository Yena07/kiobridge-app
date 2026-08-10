import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccountMock, createTeamAccount, mockAccount, setAccountMockDelay,
  아이디검사, 비밀번호검사, 올릴수있나,
  LOGIN_ID_MAX, PASSWORD_MIN,
} from "./account";
import { KioBridgeError } from "./client";
import type { ProfileData } from "@/domain/types";

// 이 파일이 잠그는 것은 하나다 — 로그인은 선택이지만, 하기로 한 사람에게는
// 화면이 말한 그대로 동작해야 한다. 저장했다고 했으면 저장돼 있어야 하고,
// 안 된 것은 안 됐다고 말해야 한다.

const 프로필 = (over: Partial<ProfileData> = {}): ProfileData => ({
  id: "p1",
  menuName: "닭강정",
  place: "음식점",
  selections: { "맵기": ["매운맛"], "형태": ["순살"] },
  memo: "",
  ...over,
});

beforeEach(() => {
  setAccountMockDelay(0);
  clearAccountMock();
});

// ─── 입력 규칙 ────────────────────────────────────────────────────────────────

describe("아이디검사 — 서버가 막을 것을 먼저 막는다", () => {
  it("비어 있으면 이유를 준다", () => {
    expect(아이디검사("")).toBe("아이디를 적어 주세요");
  });

  it("공백만 적은 것도 비어 있는 것이다", () => {
    // 서버가 trim() 한 뒤 @NotBlank 로 본다. 여기서 안 막으면 code 없는 400 만 돌아온다.
    expect(아이디검사("   ")).toBe("아이디를 적어 주세요");
  });

  it(`${LOGIN_ID_MAX}자를 넘으면 막는다`, () => {
    expect(아이디검사("가".repeat(LOGIN_ID_MAX))).toBeNull();
    expect(아이디검사("가".repeat(LOGIN_ID_MAX + 1))).not.toBeNull();
  });

  it("앞뒤 공백은 길이에 넣지 않는다", () => {
    expect(아이디검사(`  ${"a".repeat(LOGIN_ID_MAX)}  `)).toBeNull();
  });
});

describe("비밀번호검사 — 길이는 글자로, 상한은 바이트로", () => {
  it(`${PASSWORD_MIN}자 미만은 막는다`, () => {
    expect(비밀번호검사("abc")).not.toBeNull();
    expect(비밀번호검사("abcd")).toBeNull();
  });

  it("한글 비밀번호는 24자까지다 — 서버가 UTF-8 바이트로 재기 때문", () => {
    // 한 글자가 3바이트라 24자 = 72바이트로 딱 맞고, 25자면 75바이트로 넘는다.
    // 글자 수로만 재면 여기서 통과시켜 놓고 서버에서 거절당한다.
    expect(비밀번호검사("가".repeat(24))).toBeNull();
    expect(비밀번호검사("가".repeat(25))).toBe("비밀번호가 너무 길어요. 조금 줄여 주세요");
  });

  it("영문은 72자까지 통과한다", () => {
    expect(비밀번호검사("a".repeat(72))).toBeNull();
    expect(비밀번호검사("a".repeat(73))).not.toBeNull();
  });

  it("공백도 비밀번호의 일부다 — 잘라내지 않는다", () => {
    // 아이디와 다르다. 비밀번호는 서버도 trim 하지 않으므로 여기서도 그대로 센다.
    expect(비밀번호검사("  a ")).toBeNull();
  });
});

describe("올릴수있나 — 서버가 받아 주지 않을 프로필을 미리 가린다", () => {
  it("장소가 없으면 못 올린다", () => {
    // 서버의 place 가 @NotBlank 다. 올려 봐야 code 없는 400 이라 이유를 전할 수 없다.
    expect(올릴수있나(프로필({ place: null }))).toBe("장소를 정해 두시면 다음에도 불러올 수 있어요");
  });

  it("장소가 있으면 올릴 수 있다", () => {
    expect(올릴수있나(프로필())).toBeNull();
  });

  it("메뉴 이름이 100자를 넘으면 못 올린다", () => {
    expect(올릴수있나(프로필({ menuName: "가".repeat(101) }))).not.toBeNull();
  });

  it("메모가 500자를 넘으면 못 올린다", () => {
    expect(올릴수있나(프로필({ memo: "가".repeat(501) }))).not.toBeNull();
  });
});

// ─── 목 구현 ──────────────────────────────────────────────────────────────────

describe("목 — 회원가입", () => {
  it("가입하면 userId 와 아이디를 돌려준다", async () => {
    const a = await mockAccount.signup("할머니1", "1234");
    expect(a.loginId).toBe("할머니1");
    expect(typeof a.userId).toBe("number");
  });

  it("돌려주는 값에 비밀번호가 섞이지 않는다", async () => {
    const a = await mockAccount.signup("할머니1", "1234");
    // 화면이 받은 객체를 그대로 어딘가에 넘길 수 있다. 비밀번호가 타고 나가면 안 된다.
    expect(Object.keys(a).sort()).toEqual(["loginId", "userId"]);
    expect(JSON.stringify(a)).not.toContain("1234");
  });

  it("같은 아이디로 두 번 가입할 수 없다", async () => {
    await mockAccount.signup("할머니1", "1234");
    await expect(mockAccount.signup("할머니1", "5678")).rejects.toMatchObject({
      code: "LOGIN_ID_DUPLICATED",
    });
  });

  it("앞뒤 공백은 서버처럼 떼고 본다", async () => {
    await mockAccount.signup("  할머니1  ", "1234");
    // 서버가 trim 하므로 "할머니1" 과 "  할머니1  " 은 같은 아이디다.
    await expect(mockAccount.signup("할머니1", "1234")).rejects.toMatchObject({
      code: "LOGIN_ID_DUPLICATED",
    });
  });

  it("규칙에 맞지 않는 비밀번호는 목도 거절한다", async () => {
    // 화면이 먼저 막지만 목도 자기 검사를 한다. 한쪽만 막으면 구현을 바꿀 때 샌다.
    await expect(mockAccount.signup("할머니1", "12")).rejects.toBeInstanceOf(KioBridgeError);
  });
});

describe("목 — 로그인", () => {
  it("가입한 계정으로 들어갈 수 있다", async () => {
    const 가입 = await mockAccount.signup("할머니1", "1234");
    const 로그인 = await mockAccount.login("할머니1", "1234");
    expect(로그인.userId).toBe(가입.userId);
  });

  it("없는 아이디와 틀린 비밀번호를 구분해서 알리지 않는다", async () => {
    await mockAccount.signup("할머니1", "1234");
    // 구분해 주면 어떤 아이디가 있는지 하나씩 확인할 수 있다.
    const 없는아이디 = await mockAccount.login("없는사람", "1234").catch((e: KioBridgeError) => e);
    const 틀린비번 = await mockAccount.login("할머니1", "틀림").catch((e: KioBridgeError) => e);
    expect((없는아이디 as KioBridgeError).code).toBe("INVALID_CREDENTIALS");
    expect((틀린비번 as KioBridgeError).code).toBe("INVALID_CREDENTIALS");
    expect((없는아이디 as KioBridgeError).message).toBe((틀린비번 as KioBridgeError).message);
  });
});

describe("목 — 프로필", () => {
  it("올린 프로필을 그대로 돌려준다", async () => {
    const a = await mockAccount.signup("할머니1", "1234");
    await mockAccount.saveProfile(a.userId, 프로필());
    expect(await mockAccount.listProfiles(a.userId)).toEqual([프로필()]);
  });

  it("같은 id 로 다시 올리면 덮어쓴다", async () => {
    // 서버가 (userId, profileId) 유일 제약으로 upsert 한다. 목도 같아야
    // 프로필을 고쳤을 때 화면이 목과 실서버에서 다르게 동작하지 않는다.
    const a = await mockAccount.signup("할머니1", "1234");
    await mockAccount.saveProfile(a.userId, 프로필());
    await mockAccount.saveProfile(a.userId, 프로필({ menuName: "고친 이름" }));
    const 것들 = await mockAccount.listProfiles(a.userId);
    expect(것들).toHaveLength(1);
    expect(것들[0].menuName).toBe("고친 이름");
  });

  it("다른 사람 프로필은 보이지 않는다", async () => {
    const a = await mockAccount.signup("할머니1", "1234");
    const b = await mockAccount.signup("할머니2", "1234");
    await mockAccount.saveProfile(a.userId, 프로필());
    expect(await mockAccount.listProfiles(b.userId)).toEqual([]);
  });

  it("장소 없는 프로필은 받지 않는다", async () => {
    const a = await mockAccount.signup("할머니1", "1234");
    await expect(mockAccount.saveProfile(a.userId, 프로필({ place: null }))).rejects.toBeInstanceOf(KioBridgeError);
  });

  it("저장한 뒤 원본을 고쳐도 저장된 것은 그대로다", async () => {
    // 참조를 그대로 들고 있으면 화면에서 프로필을 고치는 순간 '서버에 저장된 값' 도
    // 같이 바뀌어, 안 올린 변경이 올라간 것처럼 보인다.
    const a = await mockAccount.signup("할머니1", "1234");
    const p = 프로필();
    await mockAccount.saveProfile(a.userId, p);
    p.menuName = "몰래 고침";
    expect((await mockAccount.listProfiles(a.userId))[0].menuName).toBe("닭강정");
  });
});

// ─── 실서버 구현 ──────────────────────────────────────────────────────────────

const 원래fetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = 원래fetch; });

const 응답 = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
}) as Response;

const 부른것 = () =>
  (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;

describe("팀 백엔드 — 보내는 모양", () => {
  it("가입은 /api/bff 를 거쳐 auth/signup 으로 간다", async () => {
    globalThis.fetch = vi.fn(async () => 응답({ userId: 7, loginId: "할머니1" }, 201)) as unknown as typeof fetch;

    const a = await createTeamAccount().signup("  할머니1  ", "1234");

    const [url, init] = 부른것()[0];
    // 브라우저는 같은 출처로만 요청한다 — 백엔드 주소가 번들에 박히지 않는다.
    expect(url).toBe("/api/bff/api/v1/auth/signup");
    expect(init.method).toBe("POST");
    // 아이디는 떼서 보낸다. 서버도 trim 하지만 보내는 값과 저장되는 값이 달라지면
    // "  할머니1  " 로 가입한 사람이 "할머니1" 로 로그인하는 게 우연처럼 보인다.
    expect(JSON.parse(String(init.body))).toEqual({ loginId: "할머니1", password: "1234" });
    expect(a).toEqual({ userId: 7, loginId: "할머니1" });
  });

  it("로그인도 같은 자리로 간다", async () => {
    globalThis.fetch = vi.fn(async () => 응답({ userId: 7, loginId: "할머니1" })) as unknown as typeof fetch;
    await createTeamAccount().login("할머니1", "1234");
    expect(부른것()[0][0]).toBe("/api/bff/api/v1/auth/login");
  });

  it("프로필 조회는 GET 이라 본문을 싣지 않는다", async () => {
    globalThis.fetch = vi.fn(async () => 응답([])) as unknown as typeof fetch;
    await createTeamAccount().listProfiles(7);
    const [url, init] = 부른것()[0];
    expect(url).toBe("/api/bff/api/v1/users/7/profiles");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("프로필 저장은 서버 DTO 모양 그대로 보낸다", async () => {
    globalThis.fetch = vi.fn(async () => 응답({})) as unknown as typeof fetch;
    await createTeamAccount().saveProfile(7, 프로필({ memo: "  얼음 적게  " }));
    const [, init] = 부른것()[0];
    expect(JSON.parse(String(init.body))).toEqual({
      profileId: "p1",
      menuName: "닭강정",
      place: "음식점",
      selections: { "맵기": ["매운맛"], "형태": ["순살"] },
      memo: "  얼음 적게  ",
    });
  });

  it("장소 없는 프로필은 요청 자체를 보내지 않는다", async () => {
    globalThis.fetch = vi.fn(async () => 응답({})) as unknown as typeof fetch;
    // 보내 봐야 code 없는 400 이 돌아와 사용자에게 이유를 말해 줄 수 없다.
    await expect(createTeamAccount().saveProfile(7, 프로필({ place: null })))
      .rejects.toMatchObject({ code: "PROFILE_NOT_UPLOADABLE" });
    expect(부른것()).toHaveLength(0);
  });
});

describe("팀 백엔드 — 오류를 사용자가 할 수 있는 말로 바꾼다", () => {
  const 오류로 = (status: number, body: unknown) => {
    globalThis.fetch = vi.fn(async () => 응답(body, status)) as unknown as typeof fetch;
  };

  it("409 는 다른 아이디를 쓰라고 말한다", async () => {
    오류로(409, { code: "LOGIN_ID_DUPLICATED", message: "이미 사용 중인 아이디입니다." });
    const e = await createTeamAccount().signup("할머니1", "1234").catch((x: KioBridgeError) => x);
    expect((e as KioBridgeError).code).toBe("LOGIN_ID_DUPLICATED");
    expect((e as KioBridgeError).message).toContain("다른 아이디");
  });

  it("401 은 아이디와 비밀번호 중 어느 쪽인지 말하지 않는다", async () => {
    오류로(401, { code: "INVALID_CREDENTIALS", message: "아이디 또는 비밀번호가 올바르지 않습니다." });
    const e = await createTeamAccount().login("할머니1", "틀림").catch((x: KioBridgeError) => x);
    expect((e as KioBridgeError).message).toBe("아이디 또는 비밀번호가 맞지 않아요");
  });

  it("code 없는 400 도 빈칸을 보여 주지 않는다", async () => {
    // @Valid 실패는 GlobalExceptionHandler 를 타지 않아 스프링 기본 400 이 나간다.
    // 그 본문에는 code 도 message 도 없어서, 그대로 쓰면 화면이 빈칸이 된다.
    오류로(400, { timestamp: "2026-08-10T00:00:00Z", status: 400, error: "Bad Request" });
    const e = await createTeamAccount().signup("할머니1", "1").catch((x: KioBridgeError) => x);
    expect((e as KioBridgeError).message).toBe("적어 주신 내용을 다시 확인해 주세요");
  });

  it("서버가 죽으면 잠시 뒤 다시 하라고 말한다", async () => {
    오류로(500, {});
    const e = await createTeamAccount().login("할머니1", "1234").catch((x: KioBridgeError) => x);
    expect((e as KioBridgeError).message).toContain("잠시 뒤");
  });

  it("연결 자체가 안 되면 그렇게 말한다", async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    const e = await createTeamAccount().login("할머니1", "1234").catch((x: KioBridgeError) => x);
    expect((e as KioBridgeError).code).toBe("NETWORK_ERROR");
  });

  it("모든 계정 오류는 되돌아갈 길이 있다", async () => {
    // recoverable 이 false 면 화면이 막다른 곳으로 사용자를 보낸다. 계정 쪽에는 그런 게 없다 —
    // 아이디가 겹쳤으면 다른 아이디로, 비밀번호가 틀렸으면 다시 적으면 된다.
    오류로(409, { code: "LOGIN_ID_DUPLICATED" });
    const e = await createTeamAccount().signup("할머니1", "1234").catch((x: KioBridgeError) => x);
    expect((e as KioBridgeError).recoverable).toBe(true);
  });
});

describe("팀 백엔드 — 서버가 준 값을 화면 타입으로 좁힌다", () => {
  it("모르는 장소는 지어내지 않고 비워 둔다", async () => {
    // 병원 프로필이 음식점으로 되살아나면, 그 프로필로 주문했을 때
    // 어르신이 병원에서 닭강정을 승인하라는 화면을 받는다.
    globalThis.fetch = vi.fn(async () => 응답([
      { profileId: "p1", menuName: "닭강정", place: "음식점", selections: {}, memo: null },
      { profileId: "p2", menuName: "접수", place: "우주정거장", selections: {}, memo: null },
    ])) as unknown as typeof fetch;

    const 것들 = await createTeamAccount().listProfiles(7);
    expect(것들[0].place).toBe("음식점");
    expect(것들[1].place).toBeNull();
  });

  it("memo 가 null 이어도 화면은 빈 문자열을 받는다", async () => {
    globalThis.fetch = vi.fn(async () => 응답([
      { profileId: "p1", menuName: "닭강정", place: "음식점", selections: {}, memo: null },
    ])) as unknown as typeof fetch;
    expect((await createTeamAccount().listProfiles(7))[0].memo).toBe("");
  });

  it("빈 목록이어도 터지지 않는다", async () => {
    globalThis.fetch = vi.fn(async () => 응답([])) as unknown as typeof fetch;
    expect(await createTeamAccount().listProfiles(7)).toEqual([]);
  });
});
