import { afterEach, describe, expect, it } from "vitest";
import { 접근토큰 } from "./token";

/*
 * 이 파일이 지키는 것 — **토큰이 어디에도 안 적힌다.**
 *
 * 값 하나로 남의 주문표를 읽고 지울 수 있다. 새로고침을 넘겨 잇는 값들과 달리
 * 이것만은 메모리에 둔다(token.ts).
 */

afterEach(() => 접근토큰.비우기());

describe("접근토큰", () => {
  it("담은 것을 그대로 돌려준다", () => {
    접근토큰.담기("abc.def.ghi");
    expect(접근토큰.읽기()).toBe("abc.def.ghi");
  });

  it("처음에는 없다", () => {
    expect(접근토큰.읽기()).toBeNull();
  });

  it("문자열이 아니거나 비어 있으면 없는 것으로 본다", () => {
    // 서버가 안 주거나 모양이 달라졌을 때, 빈 값을 Bearer 뒤에 붙여 보내면
    // 무슨 일이 일어나는지 알 수 없다. 아예 안 붙이는 쪽이 낫다.
    for (const 나쁜값 of [undefined, null, "", "   ", 123, {}, []]) {
      접근토큰.담기(나쁜값);
      expect(접근토큰.읽기()).toBeNull();
    }
  });

  it("비우면 없어진다", () => {
    접근토큰.담기("t");
    접근토큰.비우기();
    expect(접근토큰.읽기()).toBeNull();
  });

  it("sessionStorage 에 남지 않는다", () => {
    /*
     * 적어 두면 개발자 도구를 열 수 있는 사람이 그대로 읽는다. 비밀번호를 안
     * 남기는 것과 같은 판단이다(session.ts 의 '담지 않는 것').
     */
    접근토큰.담기("secret-token-value");
    const 저장소 = globalThis.sessionStorage;
    if (!저장소) return; // node 환경에는 없다. 있으면 확인한다.
    for (let i = 0; i < 저장소.length; i += 1) {
      expect(저장소.getItem(저장소.key(i)!)).not.toContain("secret-token-value");
    }
  });
});
