/**
 * 백엔드가 제대로 붙었는지 한 번에 확인한다.
 *
 *   npm run check:backend
 *
 * 앱이 실제로 부르는 경로를, 앱이 부르는 순서대로, 앱이 보내는 모양으로 부른다.
 * 그래서 여기서 통과하면 화면에서도 통과한다.
 *
 * 기본은 개발 서버(:5199)의 /api/bff 를 거친다. 배포본을 확인하려면
 * 주소를 넘긴다:  node tools/check-backend.mjs https://kiobridge-app.vercel.app
 */

const 기준 = (process.argv[2] ?? "http://localhost:5199").replace(/\/$/, "");
const BFF = `${기준}/api/bff`;

const 초록 = (s) => `\x1b[32m${s}\x1b[0m`;
const 빨강 = (s) => `\x1b[31m${s}\x1b[0m`;
const 회색 = (s) => `\x1b[90m${s}\x1b[0m`;

let 실패 = 0;

async function 확인(이름, 경로, 본문, 검사) {
  const 시작 = Date.now();
  let res, body;
  try {
    res = await fetch(`${BFF}/${경로}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(본문),
    });
    const t = await res.text();
    body = t ? JSON.parse(t) : {};
  } catch (e) {
    실패++;
    console.log(`${빨강("✗")} ${이름}\n  ${회색(`연결 실패 — ${e.message}`)}`);
    return null;
  }
  const 걸린 = Date.now() - 시작;

  if (!res.ok) {
    실패++;
    console.log(`${빨강("✗")} ${이름}  ${res.status}`);
    console.log(`  ${회색(JSON.stringify(body).slice(0, 160))}`);
    return null;
  }
  const 문제 = 검사?.(body);
  if (문제) {
    실패++;
    console.log(`${빨강("✗")} ${이름}  200  ${회색(`${걸린}ms`)}\n  ${빨강(문제)}`);
    return body;
  }
  console.log(`${초록("✓")} ${이름}  ${회색(`${res.status} · ${걸린}ms`)}`);
  return body;
}

const 프로필 = {
  profileId: "check-1",
  collectionChannel: "WEB_FORM",
  collectedAt: "2026-08-01T05:30:00.000Z",
  accessibility: {
    largeText: false, simpleSteps: false, visualGuidance: false, hearingSupport: false,
    mobilitySupport: false, highContrast: false, staffAssistancePreferred: false,
  },
  interaction: { preferredInput: "TOUCH", language: "ko-KR", confirmationRequired: true },
  consent: { personalization: true, retentionPolicy: "SESSION_ONLY" },
};

const 맥락입력 = {
  contextInput: {
    serviceType: "TAKE_OUT", spicyLevel: "HOT", boneType: "BONELESS",
    cupOption: "PAPER", quantity: 1, allergenIds: ["PEANUT"],
  },
  collectionMetadata: {
    source: "WEB_FORM", confidence: 1, confirmedByUser: true,
    capturedAt: "2026-08-01T05:30:00.000Z",
  },
};

console.log(`\n대상: ${기준}\n`);

// 1. 세션
const 세션 = await 확인("세션 생성", "internal/simulation/session",
  { environmentId: "chicken-store", claimCode: "kb_check" },
  (b) => (b.sessionId ? null : "sessionId 가 없습니다"));
const environmentId = 세션?.environmentId ?? "chicken-store";
if (세션 && !세션.environmentId) console.log(`  ${회색("environmentId 를 안 줍니다 — 화면이 카탈로그를 고정값으로 씁니다")}`);

// 2~3. 정규화
const pn = await 확인("프로필 정규화", "api/v1/profile-normalizations",
  { environmentId, profileInput: 프로필 },
  (b) => (b.profile ? null : "profile 이 없습니다"));
const sn = await 확인("세션 맥락 정규화", "api/v1/session-context-normalizations",
  { environmentId, ...맥락입력 },
  (b) => (b.sessionContext ? null : "sessionContext 가 없습니다"));

// 4. 통합 검증
if (pn && sn) {
  await 확인("통합 검증 (recommendationReady)", "api/v1/canonical-inputs/validate",
    { environmentId, profile: pn.profile, sessionContext: sn.sessionContext },
    (b) => (b.recommendationReady ? null : `recommendationReady=false (${b.status})`));
}

// 5. 후보 필터 — 이름·가격이 오는지가 중요하다
const cf = sn && await 확인("후보 필터", "api/v1/candidate-filters",
  { environmentId, sessionContext: sn.sessionContext },
  (b) => {
    const list = b.eligibleCandidates ?? [];
    if (list.length === 0) return "담을 수 있는 후보가 없습니다";
    if (!list.some((c) => c.name)) return "후보에 이름이 없습니다 — 화면에 상품 ID 밖에 못 띄웁니다";
    const 품절 = list.filter((c) => c.available === false);
    if (품절.length) return `팔지 않는 후보가 섞여 있습니다: ${품절.map((c) => c.name).join(", ")}`;
    return null;
  });
if (cf) {
  const c = (cf.eligibleCandidates ?? [])[0];
  console.log(`  ${회색(`후보 ${cf.eligibleCandidates.length}개 · 예: ${c?.name} ${c?.price}원`)}`);
}

// 6. 추천
const rec = pn && sn && await 확인("추천", "api/v1/recommendations",
  { environmentId, profile: pn.profile, sessionContext: sn.sessionContext },
  (b) => (b.recommendedCandidateId ? null : "추천 후보가 없습니다"));
if (rec && cf) {
  const 이름 = (id) => (cf.eligibleCandidates ?? []).find((c) => c.candidateId === id)?.name ?? id;
  console.log(`  ${회색(`1순위 ${이름(rec.recommendedCandidateId)} · 확신도 ${rec.confidence} · 재확인 ${rec.requiresReconfirmation}`)}`);
  // 고른 조건이 순위에 반영되는지. 안 되면 조건이 맞아도 화면이 매번 되묻는다.
  if (!("boneTypeMatch" in (rec.scoreBreakdown ?? {}))) {
    console.log(`  ${회색("scoreBreakdown 에 boneTypeMatch 가 없습니다 — 형태가 순위에 반영되지 않습니다")}`);
  }
}

// 7. 승인 — 실제로 담긴다
if (세션 && pn && sn && rec) {
  const 결과 = await 확인("승인 (실제로 담김)", "internal/orchestrator/approve",
    {
      sessionId: 세션.sessionId, profile: pn.profile, sessionContext: sn.sessionContext,
      recommendation: rec,
      userDecision: { approved: true, decision: "APPROVE", confirmedAt: new Date().toISOString() },
    },
    (b) => {
      const r = b.raw ?? b;                       // #48 이후에는 raw 안에 들어온다
      if (!r.valid) {
        const e = (r.validation?.errors ?? []).map((x) => x.message).slice(0, 2).join(" / ");
        return `검증에서 막혔습니다 — ${e || "사유 없음"}`;
      }
      return r.evidence ? null : "증거가 없습니다";
    });
  const e = (결과?.raw ?? 결과)?.evidence;
  if (e) {
    const cart = e.reviewSnapshot ?? {};
    console.log(`  ${회색(`${e.result} · 실행 ${e.executedActions?.length ?? 0}단계 · 장바구니 ${cart.total ?? "?"}원`)}`);
  }
}

console.log("");
if (실패 === 0) {
  console.log(초록("백엔드가 제대로 붙어 있습니다. 화면에서도 그대로 됩니다.\n"));
} else {
  console.log(빨강(`${실패}곳에서 막혔습니다. 위의 ✗ 를 보세요.\n`));
  console.log(회색("자주 있는 원인"));
  console.log(회색("  · 킷(:4000)이 안 떠 있음 — 백엔드가 킷을 부르므로 먼저 띄워야 합니다"));
  console.log(회색("  · 백엔드가 옛 코드 — dev 최신을 받아 다시 띄워 보세요"));
  console.log(회색("  · 배포본을 확인 중이면 main 에 컨트롤러가 아직 없을 수 있습니다\n"));
  process.exitCode = 1;
}
