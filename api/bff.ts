import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * 백엔드로 가는 요청을 이 앱의 서버가 대신 보내 준다 (BFF).
 *
 * 브라우저가 백엔드를 직접 부르면 CORS 를 맞춰야 한다. 팀 백엔드는
 * kiobridge.cors.allowed-origin 으로 origin 을 하나만 허용하는데,
 * 개발 서버(5199) · Vercel 배포 · 미리보기 배포가 서로 다른 주소라 셋을 동시에
 * 만족시킬 수 없다. 미리보기 URL 은 배포마다 바뀌기도 한다.
 *
 * 이 함수를 거치면 브라우저는 같은 출처(/api/bff/...)로만 요청하므로
 * CORS 자체가 발생하지 않는다. 백엔드는 CORS 설정을 몰라도 된다.
 *
 * 백엔드 주소는 서버 환경변수로만 둔다. 번들에 넣으면 주소가 공개된다.
 *   Vercel 프로젝트 설정 → Environment Variables → KIOBRIDGE_API_BASE
 *   VITE_ 를 붙이면 안 된다. 그건 브라우저 번들에 박혀서 주소가 그대로 노출된다.
 *
 * ── 배포에서 두 번 데었다. 둘 다 vercel.json 문제였다 ──────────────────────
 *
 * 1) SPA 폴백이 /api 까지 삼켰다.
 *    "source": "/(.*)" 로 두면 이 함수로 가야 할 요청도 index.html 이 된다.
 *    실제로 배포본의 /api/bff/... 가 HTML 을 돌려줬다.
 *    지금은 "/((?!api/).*)" 로 /api 를 빼 두었다.
 *
 * 2) 파일명을 api/bff/[...path].ts 로 두었더니 한 단계 경로만 잡히고
 *    /api/bff/internal/simulation/session 처럼 여러 단계는 404 가 났다.
 *    Next.js 밖에서는 catch-all 파일명을 기대하지 않는 편이 안전하다.
 *    지금은 평범한 api/bff.ts 하나를 두고, vercel.json 의 rewrite 가
 *    뒤쪽 경로를 ?p= 로 넘겨 준다.
 *
 *    { "source": "/api/bff/(.*)", "destination": "/api/bff?p=$1" }
 *
 * 핸들러 모양도 Node 방식(req, res)으로 둔다. Request/Response 웹 방식으로
 * 두었더니 req.url 이 절대 주소가 아니라 new URL(req.url) 에서 터졌다(500).
 */

// 열린 프록시가 되지 않게 통과시킬 경로를 명시한다.
// 여기 없는 경로는 백엔드에 닿지 않는다. 백엔드가 사내망에 있을 때
// 이 함수가 통로가 되어 아무 데나 부를 수 있으면 안 된다.
const 허용경로 = [
  // 승인 한 번으로 조립·제출·검증·실행까지. 프론트가 실제로 쓰는 경로다.
  /^internal\/orchestrator\/approve$/,
  // 추천 계열 (RecommendationController)
  /^api\/v1\/candidate-filters$/,
  /^api\/v1\/recommendations$/,
  /^api\/v1\/recommendation-output-validations$/,
  // 세션 생성 (ExecutionPlanController)
  /^internal\/simulation\/session$/,
  // 이미 조립된 제출물을 다루는 저수준 경로. 프론트는 안 쓰지만 남겨 둔다.
  /^internal\/simulation\/submit-and-run$/,
  /^internal\/plan\/build$/,
  // 입력 정규화 계열 (CanonicalInputValidationController 등)
  /^api\/v1\/canonical-inputs\/validate$/,
  /^api\/v1\/profile-normalizations$/,
  /^api\/v1\/session-context-normalizations$/,
  /*
   * 계정 계열 (AuthController · UserProfileController)
   *
   * 이 함수는 인증 없이 열려 있고 허용 경로 하나만 알면 누구든 부를 수 있다.
   * 아래 두 경로에는 그래서 각각 다른 위험이 붙는다. 둘 다 여기서 못 막는다.
   *
   *   auth/login      무차별 대입의 대리 창구가 된다. Vercel 서버 함수는 인스턴스가
   *                   여러 개라 메모리 카운터로 세면 인스턴스 수만큼 상한이 늘어나
   *                   세지 않느니만 못하다. 시도 횟수 제한은 서버가 해야 한다.
   *
   *   users/{id}/profiles
   *                   백엔드가 토큰을 발급하지 않아 이 경로에 인증 검사가 없다.
   *                   userId 는 1부터 올라가는 숫자라, 숫자만 바꾸면 남의 주문표를
   *                   읽고 남의 계정에 쓴다. 여기를 닫아도 해결되지 않는다 —
   *                   백엔드가 열려 있는 한 누구든 직접 부를 수 있고, 닫으면
   *                   우리 화면만 못 쓰게 된다. 막는 자리는 서버다.
   *
   * 둘 다 docs/BACKEND_INTEGRATION.md 에 요청으로 적어 두었다.
   * 이 앱이 여기 싣는 것은 주문 조건뿐이고(장소·맵기·형태·컵·수량·알레르기·메모)
   * 실명·전화번호는 받지도 저장하지도 않는다. 그래서 지금은 열어 둔다.
   *
   * 여기서 할 수 있는 것은 해 둔다 — 정확히 이 두 경로만 열고, 본문은 아래
   * 상한까지만 받고, 클라이언트 헤더는 떼고, 오간 내용은 아무것도 기록하지 않는다.
   */
  /^api\/v1\/auth\/(signup|login)$/,
  // userId 는 숫자다. [^/]+ 로 두면 경로 한 칸을 아무 문자열이나 통과시키게 된다.
  /^api\/v1\/users\/\d+\/profiles$/,
  // 명세에는 있고 아직 컨트롤러가 없는 것들. 생기면 바로 통하도록 열어 둔다.
  // 여기 있다고 백엔드에 있는 건 아니다 — 없으면 404 가 그대로 올라온다.
  /^api\/v1\/environments(\/[^/]+(\/(fixture|input-options|compatibility-rules))?)?$/,
  /^api\/v1\/sessions(\/[^/]+(\/(submission|validate|execute))?)?$/,
];

// 경로만 검사하면 메서드는 무엇이든 통과한다. 백엔드에 DELETE 가 생기는 순간
// 이 함수가 그 통로가 된다. 지금 쓰는 두 가지만 연다.
const 허용메서드 = new Set(["GET", "POST"]);

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const 보내기 = (status: number, body: unknown, type = "application/json") => {
    res.statusCode = status;
    res.setHeader("content-type", type);
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const base = process.env.KIOBRIDGE_API_BASE;
  if (!base) {
    // 설정이 없으면 조용히 실패하지 않는다. 붙이는 사람이 왜 안 되는지 알아야 한다.
    return 보내기(503, { code: "BFF_NOT_CONFIGURED", message: "서버에 백엔드 주소가 설정되지 않았어요" });
  }
  if (!허용메서드.has(req.method ?? "")) {
    return 보내기(405, { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 방식이에요" });
  }

  // req.url 은 "/api/bff?p=internal/..." 처럼 경로+쿼리만 온다. 절대 주소가 아니라
  // 기준 주소를 붙여야 URL 로 읽을 수 있다. 기준값 자체는 쓰지 않는다.
  const url = new URL(req.url ?? "/", "http://localhost");
  // rewrite 가 넘겨 준 뒤쪽 경로. rewrite 없이 직접 부른 경우도 받아 준다.
  const 경로 = (url.searchParams.get("p") ?? url.pathname.replace(/^\/api\/bff\/?/, "")).replace(/^\/+/, "");
  if (!허용경로.some((r) => r.test(경로))) {
    return 보내기(404, { code: "NOT_ALLOWED", message: "허용되지 않은 경로예요" });
  }

  // p 는 우리가 만든 값이라 그대로 넘기면 안 된다. 백엔드로 보낼 쿼리에서 뺀다.
  const 쿼리 = new URLSearchParams(url.searchParams);
  쿼리.delete("p");
  const 쿼리문자열 = 쿼리.toString();

  // 브라우저가 오래 매달리지 않게 여기서도 끊는다. 화면 쪽 타임아웃과 같은 이유다.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  try {
    const 본문 = req.method === "GET" || req.method === "HEAD" ? undefined : await 본문읽기(req);
    const 응답 = await fetch(`${base.replace(/\/$/, "")}/${경로}${쿼리문자열 ? `?${쿼리문자열}` : ""}`, {
      method: req.method,
      signal: ac.signal,
      // 클라이언트 헤더를 그대로 넘기지 않는다. 쿠키·인증 헤더가 실려 가면
      // 이 함수가 의도치 않은 권한 통로가 된다.
      headers: { "content-type": "application/json" },
      ...(본문 === undefined || 본문 === "" ? {} : { body: 본문 }),
    });
    const text = await 응답.text();
    return 보내기(응답.status, text, 응답.headers.get("content-type") ?? "application/json");
  } catch (e) {
    if ((e as Error)?.name === "BodyTooLarge") {
      return 보내기(413, { code: "BODY_TOO_LARGE", message: "보낸 내용이 너무 커요" });
    }
    const 시간초과 = (e as Error)?.name === "AbortError";
    return 보내기(시간초과 ? 504 : 502, {
      code: 시간초과 ? "TIMEOUT" : "UPSTREAM_ERROR",
      message: 시간초과 ? "응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요" : "서버에 연결하지 못했어요",
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Node 요청은 스트림이라 직접 모아야 한다.
 *
 * 상한이 없으면 큰 본문 하나로 이 프로세스의 메모리가 계속 늘어난다.
 * 이 함수는 인증 없이 열려 있고, 허용 경로 하나만 알면 누구든 부를 수 있다.
 * 이 앱이 보내는 제출물은 수십 KB 라 1MB 를 넘으면 우리 요청이 아니다.
 * 바이트로 센다 — 글자 수로 재면 한글에서 상한이 셋 배가 된다.
 */
const 최대본문 = 1_000_000;

function 본문읽기(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    // 글자 수가 아니라 바이트로 센다. 한글은 UTF-8 로 한 글자가 3바이트라,
    // 글자 수로 재면 100만 자 = 약 3MB 까지 통과한다. 상한이 셋 배가 되는 셈이다.
    const 조각: Buffer[] = [];
    let 바이트 = 0;
    req.on("data", (c: Buffer) => {
      바이트 += c.length;
      if (바이트 > 최대본문) {
        req.destroy();
        reject(Object.assign(new Error("BODY_TOO_LARGE"), { name: "BodyTooLarge" }));
        return;
      }
      조각.push(c);
    });
    // 여기서 한 번에 문자열로 만든다. 조각 경계에서 한글이 잘리는 일이 없다.
    req.on("end", () => resolve(Buffer.concat(조각).toString("utf8")));
    req.on("error", reject);
  });
}
