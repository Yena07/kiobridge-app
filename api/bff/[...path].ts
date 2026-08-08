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
 * vercel.json 의 SPA 폴백에서 /api 를 반드시 제외해야 한다.
 *   "source": "/((?!api/).*)"
 * 안 그러면 이 함수로 가야 할 요청까지 index.html 로 삼켜서 프록시가 아예
 * 실행되지 않는다. 실제로 그랬고, 배포본의 /api/bff/... 가 HTML 을 돌려줬다.
 * 환경변수를 아무리 맞춰도 이 규칙이 틀리면 아무 일도 일어나지 않는다.
 */

// 열린 프록시가 되지 않게 통과시킬 경로를 명시한다.
// 여기 없는 경로는 백엔드에 닿지 않는다. 백엔드가 사내망에 있을 때
// 이 함수가 통로가 되어 아무 데나 부를 수 있으면 안 된다.
// 경로만 검사하면 메서드는 무엇이든 통과한다. 백엔드에 DELETE 가 생기는 순간
// 이 함수가 그 통로가 된다. 지금 쓰는 두 가지만 연다.
const 허용메서드 = new Set(["GET", "POST"]);

const 허용경로 = [
  // 백엔드에 실제로 있는 것 (2026-08-07 dev 기준, ExecutionPlanController)
  /^internal\/simulation\/session$/,
  /^internal\/simulation\/submit-and-run$/,
  /^internal\/plan\/build$/,
  // 입력 정규화 계열 (CanonicalInputValidationController 등)
  /^api\/v1\/canonical-inputs\/validate$/,
  /^api\/v1\/profile-normalizations$/,
  /^api\/v1\/session-context-normalizations$/,
  // 아직 컨트롤러가 없는 것들. 생기면 바로 통하도록 미리 열어 둔다.
  // 여기 있다고 백엔드에 있는 건 아니다 — 없으면 404 가 그대로 올라온다.
  /^api\/v1\/candidate-filters$/,
  /^api\/v1\/recommendations$/,
  /^api\/v1\/environments(\/[^/]+(\/(fixture|input-options|compatibility-rules))?)?$/,
  /^api\/v1\/sessions(\/[^/]+(\/(submission|validate|execute))?)?$/,
];

export const config = { runtime: "nodejs" };

export default async function handler(req: Request): Promise<Response> {
  const base = process.env.KIOBRIDGE_API_BASE;
  if (!base) {
    // 설정이 없으면 조용히 실패하지 않는다. 붙이는 사람이 왜 안 되는지 알아야 한다.
    return json(503, { code: "BFF_NOT_CONFIGURED", message: "서버에 백엔드 주소가 설정되지 않았어요" });
  }

  if (!허용메서드.has(req.method)) {
    return json(405, { code: "METHOD_NOT_ALLOWED", message: "허용되지 않은 방식이에요" });
  }

  const url = new URL(req.url);
  const 경로 = url.pathname.replace(/^\/api\/bff\/?/, "");
  if (!허용경로.some((r) => r.test(경로))) {
    return json(404, { code: "NOT_ALLOWED", message: "허용되지 않은 경로예요" });
  }

  // 브라우저가 오래 매달리지 않게 여기서도 끊는다. 화면 쪽 타임아웃과 같은 이유다.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/${경로}${url.search}`, {
      method: req.method,
      signal: ac.signal,
      // 클라이언트 헤더를 그대로 넘기지 않는다. 쿠키·인증 헤더가 실려 가면
      // 이 함수가 의도치 않은 권한 통로가 된다.
      headers: { "content-type": "application/json" },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    });
    const body = await res.text();
    return new Response(body || null, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    const 시간초과 = (e as Error)?.name === "AbortError";
    return json(시간초과 ? 504 : 502, {
      code: 시간초과 ? "TIMEOUT" : "UPSTREAM_ERROR",
      message: 시간초과 ? "응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요" : "서버에 연결하지 못했어요",
    });
  } finally {
    clearTimeout(t);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
