import { describe, expect, it } from "vitest";
import { 연동기록 } from "./devlog";

describe("연동기록 — 화면에 뜨는 값이라 누구인지는 가린다", () => {
  /*
   * 백엔드가 토큰을 발급하지 않아서 userId 자체가 열쇠다. 숫자만 알면 그 사람의
   * 주문표를 읽고 쓸 수 있다. 이 기록은 구석 패널과 ?log 화면에 그대로 뜨고
   * 시연 녹화에도 같이 찍히므로, 띄우는 것이 곧 그 열쇠를 보여 주는 일이 된다.
   */
  const 남기고읽기 = (경로: string) => {
    연동기록.남기기({ 방법: "GET", 경로, 상태: 200, 걸린시간: 1, 시각: Date.now() });
    return 연동기록.읽기()[0].경로;
  };

  it("주문표 경로의 userId 를 가린다", () => {
    expect(남기고읽기("/api/v1/users/12345/profiles")).toBe("/api/v1/users/***/profiles");
    expect(남기고읽기("/api/v1/users/7/profiles")).not.toContain("7");
  });

  it("무엇을 불렀는지는 그대로 남긴다", () => {
    expect(남기고읽기("/internal/orchestrator/approve")).toBe("/internal/orchestrator/approve");
    expect(남기고읽기("/api/v1/auth/login")).toBe("/api/v1/auth/login");
  });

  it("비우면 남지 않는다 — '이 기기에서 정보 지우기' 가 여기까지 닿아야 한다", () => {
    남기고읽기("/api/v1/recommendations");
    expect(연동기록.읽기().length).toBeGreaterThan(0);
    연동기록.비우기();
    expect(연동기록.읽기()).toEqual([]);
  });
});

describe("연동기록 — 자유 입력은 본문에서도 가린다", () => {
  /*
   * memo 는 이 앱에서 사용자가 아무거나 적을 수 있는 유일한 칸이다.
   * 저장 전에 전화번호.주민등록번호.주소 모양은 걸러 막지만 이름은 못 거른다.
   * 그 값이 로그 본문에 남아 화면과 시연 녹화에 그대로 뜨면 안 된다.
   */
  const 남기고읽기 = (요청: string) => {
    연동기록.남기기({ 방법: "POST", 경로: "/api/v1/profile-normalizations", 상태: 200, 걸린시간: 1, 시각: Date.now(), 요청 });
    return 연동기록.읽기()[0].요청 ?? "";
  };

  it("어느 깊이에 있든 memo 값을 가린다", () => {
    const 남은 = 남기고읽기(JSON.stringify({
      environmentId: "chicken-store",
      profileInput: { profileId: "p1", memo: "김할머니 앞으로 해주세요" },
    }));
    expect(남은).not.toContain("김할머니");
    expect(남은).toContain('"memo":"***"');
    // 무엇을 보냈는지는 그대로 알 수 있어야 한다.
    expect(남은).toContain("chicken-store");
    expect(남은).toContain("p1");
  });

  it("응답 본문에서도 memo 를 가리고, JSON 이 아니면 안 남긴다", () => {
    /*
     * 남기기() 는 요청.응답 양쪽에 같은 가리기를 건다. 그런데 테스트가 요청만
     * 보고 있으면, 응답 쪽 가리기가 빠져도 초록으로 통과한다.
     * 주문표 조회 응답에는 저장해 둔 memo 가 그대로 실려 온다.
     */
    연동기록.남기기({
      방법: "GET", 경로: "/api/v1/users/7/profiles", 상태: 200, 걸린시간: 1, 시각: Date.now(),
      응답: JSON.stringify([{ profileId: "p1", memo: "김할머니 앞으로 해주세요" }]),
    });
    const 응답 = 연동기록.읽기()[0].응답 ?? "";
    expect(응답).not.toContain("김할머니");
    expect(응답).toContain('"memo":"***"');

    /*
     * not.toContain 하나로는 부족하다. 응답이 undefined 여도 통과한다 - 가리기가
     * 통째로 빠져도 초록이다. 무엇으로 바뀌었는지까지 본다.
     *
     * 기록 자체는 남는다. 본문만 통째로 갈린다 - 무엇을 불렀는지는 알아야
     * 로그가 쓸모 있고, 못 가리는 본문만 안 보여 주면 된다.
     */
    const 이전 = 연동기록.읽기().length;
    연동기록.남기기({
      방법: "GET", 경로: "/api/v1/users/7/profiles", 상태: 200, 걸린시간: 1, 시각: Date.now(),
      응답: "<html>프록시가 끼워 넣은 것</html>",
    });
    expect(연동기록.읽기()).toHaveLength(이전 + 1);
    expect(연동기록.읽기()[0].응답 ?? "").not.toContain("html");
    expect(연동기록.읽기()[0].응답).toContain("가리지 못했습니다");
  });

  it("JSON 이 아니면 아예 남기지 않는다", () => {
    const 남은 = 남기고읽기("<html>프록시가 끼워 넣은 것</html>");
    expect(남은).not.toContain("html");
  });
});
