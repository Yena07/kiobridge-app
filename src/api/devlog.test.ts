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
