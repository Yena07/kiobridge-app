import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/*
 * BFF 의 통과 규칙을 잠근다.
 *
 * api/bff.ts 는 Vercel 서버 함수라 브라우저 테스트 환경에서 import 할 수 없다
 * (node:http 타입에 기대고 있다). 대신 소스에서 규칙만 뽑아 와 검사한다.
 *
 * 왜 잠그나 — 개발 서버는 /api/bff 를 그냥 프록시한다. 그래서 로컬에서는
 * 무엇이든 통하고 **배포본에서만 막힌다.** 실제로 삭제 API 를 붙일 때 이 파일을
 * 빠뜨려서 로컬은 되는데 프로덕션은 405 가 나는 상태를 만들 뻔했다.
 * 로컬에서 안 보이는 규칙일수록 테스트로 붙잡아 둔다.
 */
const 소스 = readFileSync(path.join(process.cwd(), "api", "bff.ts"), "utf8");

/** 소스에 적힌 정규식 목록을 그대로 꺼내 온다. */
const 정규식들 = (블록: string): RegExp[] =>
  [...블록.matchAll(/\/\^api[^\n]*?\/(?=[,\s])/g)].map((m) => {
    const 원문 = m[0];
    return new RegExp(원문.slice(1, 원문.lastIndexOf("/")));
  });

const 허용경로 = 정규식들(소스.slice(소스.indexOf("const 허용경로"), 소스.indexOf("const 기본허용메서드")));
const 경로가되나 = (p: string) => 허용경로.some((r) => r.test(p));

describe("BFF 통과 규칙", () => {
  it("주문표 하나를 가리키는 경로가 열려 있다", () => {
    // 이게 없으면 삭제 요청이 배포본에서 404 로 막힌다.
    expect(경로가되나("api/v1/users/7/profiles/p1")).toBe(true);
    expect(경로가되나("api/v1/users/7/profiles")).toBe(true);
  });

  it("경로 한 칸만 받는다 — 더 깊이 들어가지 못한다", () => {
    expect(경로가되나("api/v1/users/7/profiles/p1/뭔가")).toBe(false);
  });

  it("userId 자리는 숫자만 받는다", () => {
    // [^/]+ 로 두면 경로 한 칸을 아무 문자열이나 통과시키게 된다.
    expect(경로가되나("api/v1/users/..%2Fadmin/profiles/p1")).toBe(false);
    expect(경로가되나("api/v1/users/abc/profiles")).toBe(false);
  });

  it("DELETE 는 주문표 하나에만 열려 있다", () => {
    const 열린DELETE = /\{\s*메서드:\s*"DELETE",\s*경로:\s*(\/\^api[^\n]*?\/)\s*\}/.exec(소스);
    expect(열린DELETE).not.toBeNull();
    const 원문 = 열린DELETE![1];
    const r = new RegExp(원문.slice(1, 원문.lastIndexOf("/")));

    expect(r.test("api/v1/users/7/profiles/p1")).toBe(true);
    // 목록을 통째로 지우는 길이 열리면 안 된다.
    expect(r.test("api/v1/users/7/profiles")).toBe(false);
    // 세션.추천 쪽으로도 못 간다.
    expect(r.test("api/v1/sessions/s1")).toBe(false);
    expect(r.test("internal/orchestrator/approve")).toBe(false);
  });

  it("기본 허용 메서드에는 DELETE 가 없다", () => {
    // DELETE 를 통째로 열면 이 함수가 지우는 통로가 된다.
    const 기본 = /const 기본허용메서드 = new Set\(\[([^\]]*)\]\)/.exec(소스);
    expect(기본).not.toBeNull();
    expect(기본![1]).not.toContain("DELETE");
  });

  it("메서드 검사가 경로를 안 뒤에 온다", () => {
    // 순서가 뒤집히면 경로별 허용이 동작하지 않는다.
    expect(소스.indexOf("const 경로 =")).toBeLessThan(소스.indexOf("메서드가되나(req.method"));
  });
});
