import type {
  ApproveInput, CartResult, MappingResponse, PairingResult, PlanCreated, PlanStatus, StepStatus,
} from "@/domain/types";
import { KioBridgeError, type KioBridgeApi } from "@/api/client";
import { STEPS } from "@/domain/catalog";

/**
 * 팀 API 명세서의 경로와 1:1 로 맞춘 계층.
 *
 * 화면이 쓰는 것(KioBridgeApi)은 네 개의 굵은 동작이고, 실제 백엔드는 그보다
 * 잘게 나뉘어 있다. 그 조립을 화면에 떠넘기면 화면이 백엔드 사정을 알게 되므로
 * 여기서 끝낸다. 백엔드는 아래 Backend 인터페이스만 구현하면 되고,
 * 화면 코드는 한 줄도 바뀌지 않는다.
 *
 * 붙이는 방법:
 *   // src/api/client.ts 의 마지막 줄만 바꾼다
 *   export const api = createApi(createHttpBackend("https://<서버>"));
 */

// ─── 백엔드가 구현할 것 — 명세서의 경로와 1:1 ────────────────────────────────

export interface Backend {
  /** POST /api/v1/sessions */
  createSession(input: { environmentId: string; claimCode: string }): Promise<{
    sessionId: string;
    kioskName: string;
    expiresAt: number;
  }>;

  /** POST /api/v1/candidate-filters — severity=BLOCK 위반 후보를 제외하고 생존 후보 반환 */
  filterCandidates(input: { environmentId: string; profileId: string }): Promise<{
    survivingCandidateIds: string[];
    excluded: { candidateId: string; reasonCode: string; explanation: string }[];
  }>;

  /** POST /api/v1/recommendations — 1순위 추천·이유·대안·제외 사유·확신도 */
  recommend(input: {
    environmentId: string;
    profileId: string;
    survivingCandidateIds: string[];
  }): Promise<RecommendationResult>;

  /** POST /api/v1/sessions/:sessionId/submission — 검증 X, 저장만 */
  submit(sessionId: string, submission: unknown): Promise<void>;

  /** POST /api/v1/sessions/:sessionId/validate */
  validate(sessionId: string): Promise<{ valid: boolean; errors?: string[] }>;

  /** POST /api/v1/sessions/:sessionId/execute — 검증 통과한 계획만 실행 */
  execute(sessionId: string): Promise<{ planId: string }>;

  /** GET /internal/simulation/evidence/{sessionId} */
  getEvidence(sessionId: string): Promise<EvidenceSummary>;

  /**
   * 이 세션에 남은 사용자 정보를 서버에서 지운다.
   *
   * 명세에 아직 경로가 없다. 자리를 비워 두면 백엔드 팀이 이 요구를 모른 채
   * 가게 되므로 선택 메서드로 미리 만들어 둔다. 화면의 '이 기기에서 정보
   * 지우기' 가 서버까지 닿으려면 이게 있어야 한다.
   * 구현하지 않으면 이 계층이 들고 있는 것만 지워진다.
   */
  forgetSession?(sessionId: string): Promise<void>;
}

/** recommendations 응답 중 화면이 쓰는 부분. */
export interface RecommendationResult {
  recommendedCandidateId: string | null;
  alternativeCandidateIds: string[];
  excludedCandidates: { candidateId: string; reasonCode: string; explanation: string }[];
  recommendationReasons: string[];
  confidence: number;
  requiresReconfirmation: boolean;
  /** 후보 표시 정보. 상품 ID 가 아니라 사람이 읽는 값이어야 한다. */
  display: Record<string, { displayName: string; priceText: string; imageUrl?: string }>;
  /** 사용자가 고른 조건이 반영됐는지 항목별로. 1순위 추천 기준이다. */
  matchedOptions: { label: string; value: string; matched: boolean; note?: string }[];
  /**
   * 후보별로 어긋나는 축의 이름. 예: { "CHICKEN-003": ["형태"] }
   *
   * matchedOptions 는 1순위 하나에 대한 답이라, 대안 후보를 고른 사용자에게는
   * 쓸 수 없다. 그걸 그대로 쓰면 '매운 뼈' 를 고른 사람에게
   * "형태: 순살, 그대로예요" 라고 말하게 된다.
   *
   * 없으면 화면이 후보별 불일치를 표시하지 않는다. 짐작하지 않는다.
   */
  unmatchedLabelsByCandidate?: Record<string, string[]>;
}

/** evidence 중 화면이 쓰는 부분. 39개 필드 전부를 화면이 알 필요는 없다. */
export interface EvidenceSummary {
  /** running | cart_ready | aborted 로 정규화해서 준다. */
  state: "running" | "cart_ready" | "aborted";
  reachedStep: number;
  cart?: CartResult;
  abort?: { code: string; title: string; message: string; userAction: string };
}

// ─── 확신도 경계 ─────────────────────────────────────────────────────────────
// 심사 필수 기준: "신뢰도 낮을 때 사용자 재확인 수행".
// 서버가 requiresReconfirmation 을 켜 주면 그걸 따르고, 안 켜 줘도
// 확신도가 이 값 아래면 화면이 스스로 재확인을 요구한다. 낮은 확신을
// 조용히 통과시키는 것보다 한 번 더 묻는 쪽이 안전하다.
export const LOW_CONFIDENCE = 0.7;

// ─── 조립 — 화면이 쓰는 네 동작을 위 호출들로 만든다 ──────────────────────────

export function createApi(backend: Backend, environmentId = "chicken-store"): KioBridgeApi {
  // 세션 하나에 대해 서버가 뭐라고 답했는지. 승인 검사와 실행 조회의 기준이 된다.
  // 페어링 만료 시각. 승인 때 끝난 연결인지 다시 보려면 필요하다.
  const 만료 = new Map<string, number>();
  /**
   * 이 계층이 매핑과 승인 사이에 들고 있는 것.
   *
   * P0-1 은 상품 ID 를 앱이 다루거나 저장하지 말라고 한다. 화면(App.tsx)은
   * 실제로 c1·c2·c3 과 사람이 읽는 값만 받는다 — 위 테스트가 응답 전체를
   * 훑어서 잠가 두었다.
   *
   * 다만 이 Map 은 서버가 준 rec 를 그대로 들고 있고, 그 안에 서버의 후보
   * 식별자가 들어 있다. 이 계층도 브라우저에서 돈다. 승인할 때 "사용자가 고른
   * 그 후보" 를 서버에 되돌려 줘야 하는데, 지금 API 가 후보를 식별자로만
   * 받기 때문이다.
   *
   * 없애려면 서버가 세션 안에서 후보를 기억하고 c1·c2·c3 같은 표식을 직접
   * 발급해야 한다. docs/BACKEND_INTEGRATION.md 에 요청으로 적어 두었다.
   * 그때 이 Map 은 expiresAt·result 만 남는다.
   */
  const 세션 = new Map<string, {
    rec: RecommendationResult;
    result: MappingResponse["result"];
    profileId: string;
    expiresAt: number;
    executed?: boolean;
  }>();

  const 판정 = (r: RecommendationResult): MappingResponse["result"] => {
    if (!r.recommendedCandidateId) return "not_found";
    if (r.alternativeCandidateIds.length > 0 && r.requiresReconfirmation) return "clarification";
    // 못 맞춘 조건이 있으면 그걸 먼저 알린다. 확신도가 낮다고 low_confidence 로
    // 먼저 빠지면, 확신도 낮고 조건도 못 맞춘 경우에 "무엇을 못 맞췄는지" 가
    // 화면에서 사라진다. 가장 조심해야 할 상황에서 정보가 가장 적어진다.
    // low_confidence 화면도 이제 확인 카드를 그리므로 changed 를 먼저 봐도 잃는 게 없다.
    if (r.matchedOptions.some((o) => !o.matched)) return "changed";
    if (r.requiresReconfirmation || r.confidence < LOW_CONFIDENCE) return "low_confidence";
    return "exact";
  };

  return {
    async claimPairing(claimCode) {
      const s = await backend.createSession({ environmentId, claimCode });
      만료.set(s.sessionId, s.expiresAt);
      const out: PairingResult = { pairingId: s.sessionId, kioskName: s.kioskName, expiresAt: s.expiresAt };
      return out;
    },

    async requestMapping(pairingId, profileId) {
      const filtered = await backend.filterCandidates({ environmentId, profileId });
      const rec = await backend.recommend({
        environmentId, profileId, survivingCandidateIds: filtered.survivingCandidateIds,
      });
      const result = 판정(rec);
      세션.set(pairingId, {
        rec, result, profileId,
        // 페어링을 안 거치고 바로 매핑을 부르는 경우는 없어야 하지만,
        // 없으면 만료를 알 수 없으므로 0 으로 두어 승인에서 막힌다.
        expiresAt: 만료.get(pairingId) ?? 0,
      });

      // 무엇을 왜 뺐는지는 후보 필터와 추천 양쪽에서 온다. 둘 다 사용자에게 보여 준다.
      const 제외 = [...filtered.excluded, ...rec.excludedCandidates];
      const reasons: MappingResponse["reasons"] = [
        ...rec.recommendationReasons.map((text) => ({ kind: "used" as const, text })),
        ...제외.map((e) => ({ kind: "excluded" as const, text: e.explanation })),
      ];

      // 서버가 display 를 빠뜨리면 이름 없는 후보가 화면에 뜬다.
      // 빈칸을 보여 주느니 그 후보를 빼는 게 낫다.
      const 보이기 = (id: string) => rec.display[id];
      const 보일수있나 = (id: string) => Boolean(rec.display[id]?.displayName);
      const 고름 = rec.recommendedCandidateId ? 보이기(rec.recommendedCandidateId) : undefined;

      if (result === "not_found") {
        return { result, reasons, message: "담을 수 있는 메뉴가 없어요" };
      }
      if (result === "clarification") {
        // 이름 없는 후보를 걸러내고 나면 하나도 안 남을 수 있다. 그대로 내보내면
        // 화면은 "비슷한 메뉴가 여러 개예요" 라고 말하면서 고를 것을 하나도
        // 못 보여 준다. 승인은 CANDIDATE_REQUIRED 를 요구하는데 고를 방법이 없으니
        // 사용자는 그 화면에서 빠져나갈 수 없다. 담을 게 없다고 답한다.
        const 보일후보 = [rec.recommendedCandidateId!, ...rec.alternativeCandidateIds].filter(보일수있나);
        if (보일후보.length === 0) {
          return { result: "not_found", reasons, message: "담을 수 있는 메뉴가 없어요" };
        }
        return {
          result, reasons,
          reason: "비슷한 메뉴가 여러 개예요",
          // 목에만 넣고 여기를 빼면, 실서버로 바꾸는 순간 조건표가 다시 통째로
          // 사라진다. 사용자는 포장인지 종이컵인지 못 보고 승인하게 된다.
          // '맞았는지' 는 판단하지 않는다 — 어느 후보를 고르느냐에 따라 달라진다.
          // 서버가 준 matched 를 그대로 쓴다. 전부 true 로 덮으면
          // 어느 후보를 고르든 안 맞는 축이 있다는 사실이 사라진다.
          profileOptions: rec.matchedOptions,
          // 상품 ID 를 화면으로 내보내지 않는다. 이번 응답 안에서만 쓰는 표식으로 바꾼다.
          candidates: 보일후보
            .map((id, i) => ({
              candidateId: `c${i + 1}`,
              ...보이기(id),
              // 서버가 후보별 불일치를 알려 주면 그대로 싣는다. 안 주면 비워 둔다.
              // 화면은 비어 있으면 아무것도 표시하지 않는다 — 이름을 뜯어보고
              // 짐작하는 것보다 조용한 편이 낫다.
              ...(rec.unmatchedLabelsByCandidate?.[id]
                ? { unmatchedLabels: rec.unmatchedLabelsByCandidate[id] }
                : {}),
            })),
        };
      }
      // 이름 없는 후보는 화면에 그릴 수 없다. item 없이 exact 를 보내면
      // 사용자는 빈 화면 앞에서 승인 버튼을 누르게 된다. 담을 게 없다고 답한다.
      if (!고름?.displayName) {
        return { result: "not_found", reasons, message: "담을 수 있는 메뉴가 없어요" };
      }
      return {
        result, reasons,
        ...(result === "changed" ? { diffNote: "저장하신 주문과 달라진 점이 있어요. 이대로 진행할까요?" } : {}),
        item: { ...고름, options: rec.matchedOptions },
      };
    },

    // P0-4: 실행 계획은 이 안에서만 만들어진다.
    async approve(input: ApproveInput): Promise<PlanCreated> {
      const s = 세션.get(input.pairingId);
      if (!s) throw new KioBridgeError("MAPPING_REQUIRED", "메뉴를 먼저 찾아야 해요", false);
      // client.ts 와 같은 검사를 여기서도 한다. 한쪽만 막으면 구현을 바꿀 때 샌다.
      if (s.profileId !== input.profileId) {
        throw new KioBridgeError("PROFILE_MISMATCH", "메뉴를 다시 찾아 주세요", true);
      }
      if (s.expiresAt <= Date.now()) {
        throw new KioBridgeError("CLAIM_EXPIRED", "연결 시간이 지났어요", true);
      }

      // 승인 조건은 서버가 답한 내용을 기준으로 본다. 클라이언트가 보낸 값을 믿지 않는다.
      if (s.result === "not_found") throw new KioBridgeError("MENU_NOT_FOUND", "담을 수 있는 메뉴가 없어요", false);
      if (s.result === "clarification" && !input.candidateId)
        throw new KioBridgeError("CANDIDATE_REQUIRED", "메뉴를 선택해 주세요", true);
      if (s.result === "changed" && !input.acknowledgedDiff)
        throw new KioBridgeError("DIFF_NOT_ACKNOWLEDGED", "달라진 내용을 확인해 주세요", true);
      if (s.result === "low_confidence" && !input.confirmedLowConfidence)
        throw new KioBridgeError("CONFIRMATION_REQUIRED", "이 메뉴가 맞는지 확인해 주세요", true);
      // 후보를 고르는 화면이 아닌데 candidateId 가 오면 무언가 어긋난 것이다.
      // client.ts 는 이미 이 경우를 막는데 여기만 열려 있으면, 붙이는 구현을
      // 바꾸는 것만으로 사용자가 고른 적 없는 메뉴가 담긴다.
      if (input.candidateId && s.result !== "clarification") {
        throw new KioBridgeError("CANDIDATE_UNEXPECTED", "메뉴를 다시 찾아 주세요", true);
      }

      // 사용자가 고른 표식(c1·c2·c3)을 서버가 아는 실제 후보로 되돌린다.
      // 우리가 준 표식인지 반드시 확인한다. 예전에는 숫자로 바꾸기만 해서
      // c99 는 undefined 를 제출했고, cabc·c0 는 조용히 1순위로 되돌아갔다.
      // 사용자가 고르지 않은 메뉴가 담긴다는 뜻이다.
      // 응답에서 걸러낸 후보(display 없음)를 빼고 센다.
      // 화면이 본 c1·c2·c3 은 걸러진 뒤의 순서라, 여기서 원본 순서로 세면
      // 사용자가 고르지 않은 메뉴가 제출된다.
      const 후보목록 = [s.rec.recommendedCandidateId!, ...s.rec.alternativeCandidateIds]
        .filter((id) => Boolean(s.rec.display[id]?.displayName));
      let candidateId = s.rec.recommendedCandidateId;
      if (input.candidateId) {
        const m = /^c(\d+)$/.exec(input.candidateId);
        const 순번 = m ? Number(m[1]) - 1 : -1;
        if (순번 < 0 || 순번 >= 후보목록.length) {
          throw new KioBridgeError("CANDIDATE_UNKNOWN", "선택한 메뉴를 찾을 수 없어요", true);
        }
        candidateId = 후보목록[순번];
      }

      // 실행은 세션당 한 번이다. 두 번 나가면 키오스크에 두 번 담긴다.
      //
      // 검사와 확정 사이에 await 가 있으면 안 된다. 예전에는 submit·validate 를
      // 기다린 뒤에 검사해서, 동시에 들어온 승인 두 건이 모두 통과하고 둘 다
      // 실행됐다. 사용자는 한 번 승인하고 두 개를 받는다.
      // 첫 await 전에 표시하고, 실패하면 되돌린다.
      if (s.executed) {
        throw new KioBridgeError("ALREADY_APPROVED", "이미 담았어요", false);
      }
      s.executed = true;

      let planId: string;
      try {
        // 제출 → 검증 → 실행. 어느 단계에서 멈췄는지 구분해서 알린다.
        await backend.submit(input.pairingId, { ...input, candidateId });
        const v = await backend.validate(input.pairingId);
        if (!v.valid) {
          throw new KioBridgeError("VALIDATION_FAILED", v.errors?.[0] ?? "계획을 검증하지 못했어요", false);
        }
        ({ planId } = await backend.execute(input.pairingId));
      } catch (e) {
        // 실행에 이르지 못했으면 다시 시도할 수 있어야 한다.
        s.executed = false;
        throw e;
      }
      // 실행 조회는 sessionId 기준이므로 화면이 들고 다닐 값에 함께 실어 둔다.
      return { planId: `${input.pairingId}::${planId}` };
    },

    // 서버에 지우기 경로가 생기면 여기서 함께 부른다. 지금은 이 계층이 들고 있는
    // 것만 지운다. 세션 Map 은 비우는 경로가 없으면 무한히 자라기도 한다.
    async forgetAll() {
      // 서버에 지우기 경로가 있으면 함께 부른다. 없으면 이 계층 것만 지운다.
      const ids = [...세션.keys()];
      세션.clear();
      만료.clear();
      if (backend.forgetSession) {
        await Promise.all(ids.map((id) => backend.forgetSession!(id)));
      }
    },

    async getPlanStatus(planId): Promise<PlanStatus> {
      const sessionId = planId.split("::")[0];
      const e = await backend.getEvidence(sessionId);
      const steps: StepStatus[] =
        e.state === "aborted"
          ? STEPS.map((_, i) => (i < e.reachedStep ? "done" : i === e.reachedStep ? "failed" : "waiting"))
          : e.state === "cart_ready"
            ? STEPS.map(() => "done")
            : STEPS.map((_, i) => (i < e.reachedStep ? "done" : i === e.reachedStep ? "active" : "waiting"));

      if (e.state === "aborted") {
        return {
          state: "aborted", steps,
          abort: { ...(e.abort ?? { code: "UNKNOWN", title: "안전을 위해 중단되었습니다", message: "예상하지 못한 화면이 감지되어 작동을 멈췄어요.", userAction: "직원 초기화를 기다려 주세요" }), recoverable: false },
        };
      }
      if (e.state === "cart_ready") return { state: "cart_ready", steps, cart: e.cart };
      return { state: "running", steps };
    },
  };
}

// ─── HTTP 구현 — 서버 주소만 넣으면 된다 ─────────────────────────────────────

/**
 * 팀 백엔드가 실제로 구현한 경로에 맞춘 구현.
 *
 * 명세서와 다른 점이 있어서 그대로 옮기면 안 붙는다. 확인한 것:
 *
 *   명세서                              실제 구현
 *   POST /api/v1/sessions               POST /internal/simulation/session
 *   submission → validate → execute     POST /internal/simulation/submit-and-run  (일괄)
 *   POST /api/v1/candidate-filters      아직 없음
 *   POST /api/v1/recommendations        아직 없음
 *
 * 그래서 지금 붙일 수 있는 건 세션 생성과 실행뿐이다. 추천 계열이 생기면
 * filterCandidates·recommend 만 채우면 된다.
 *
 * 기본 주소는 /api/bff 다. 이 앱의 서버 함수가 백엔드로 대신 보내 주므로
 * 브라우저는 같은 출처로만 요청하고 CORS 가 발생하지 않는다.
 * 백엔드 주소는 Vercel 환경변수 KIOBRIDGE_API_BASE 로 준다.
 *
 * 백엔드를 직접 부르고 싶으면 주소를 넘기면 된다. 그 경우에는
 * kiobridge.cors.allowed-origin 을 이 앱 주소로 맞춰야 한다.
 */
/** 킷 드라이버가 verify 단계에서 만드는 읽기 전용 값. 환경마다 키가 다르다. */
interface ReviewSnapshot {
  cartItems?: { name?: string; price?: number; quantity?: number }[];
  total?: number;
  [label: string]: unknown;
}

/**
 * POST /internal/simulation/submit-and-run 응답.
 * 백엔드 `ExecuteResult` 레코드와 같은 모양이다.
 * 제출·검증·실행·증거가 이 한 응답에 전부 들어 있다.
 */
interface ExecuteResult {
  valid: boolean;
  validation?: { valid: boolean; errors?: { path?: string; code?: string; message: string }[] };
  run?: { terminalState?: string; stopType?: string; stopReason?: string };
  evidence?: {
    runId?: string;
    result?: "PASS" | "FAIL";
    stopType?: "NORMAL_BOUNDARY_STOP" | "SAFETY_STOP" | "NONE";
    stopReason?: string;
    executedActions?: unknown[];
    reviewSnapshot?: ReviewSnapshot;
  };
}

export function createTeamBackend(baseUrl = "/api/bff"): Pick<Backend, "createSession" | "submit" | "validate" | "execute" | "getEvidence"> {
  const 보내기 = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetch(baseUrl + path, {
      // body 가 없으면 조회다. 명세의 evidence 는 GET 이라 POST 로 부르면 405 가 난다.
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new KioBridgeError(b.code ?? `HTTP_${res.status}`, b.message ?? "요청을 처리하지 못했어요", res.status >= 500);
    }
    const t = await res.text();
    return (t ? JSON.parse(t) : undefined) as T;
  };

  // submit-and-run 이 일괄이라 3단계로 나눌 수 없다. 응답을 통째로 담아 두고
  // validate·execute·getEvidence 가 나눠 읽는다. 화면은 여전히 세 단계로 본다.
  const 실행결과 = new Map<string, ExecuteResult>();

  /**
   * reviewSnapshot 을 장바구니 요약으로 옮긴다.
   *
   * 킷의 시뮬레이션 드라이버가 verify 단계에서 만드는 읽기 전용 값이다.
   * chicken-store 는 cartItems 와 total 을 함께 넣어 준다(simulation-driver 의 reviewOf).
   * 다른 환경은 라벨→표시값 쌍만 들어오므로 개수·금액을 알 수 없다.
   *
   * 모르는 값은 지어내지 않는다. 확인 화면에서 본 값과 결과가 어긋나면
   * 승인이라는 절차 자체가 무의미해진다.
   */
  const 장바구니 = (r: ReviewSnapshot | undefined): CartResult | undefined => {
    if (!r) return undefined;
    const items = Array.isArray(r.cartItems) ? r.cartItems : undefined;
    if (!items) return undefined;
    const 개수 = items.reduce((s, i) => s + (Number(i?.quantity) || 0), 0);
    const 합계 = typeof r.total === "number"
      ? r.total
      : items.reduce((s, i) => s + (Number(i?.price) || 0) * (Number(i?.quantity) || 0), 0);
    return {
      itemCountText: `${개수}개`,
      totalText: `${합계.toLocaleString("ko-KR")}원`,
      evidenceLabel: "화면 인식으로 확인됨",
      handoff: "키오스크 화면에서 장바구니를 확인해 주세요",
    };
  };

  return {
    async createSession({ environmentId, claimCode }) {
      // claimCode 를 버리면 QR 로 읽은 그 키오스크와 무관하게 세션이 열린다.
      // 다른 기계 앞에 서 있어도 같은 세션을 받는다는 뜻이다.
      // 백엔드가 아직 이 값을 받지 않지만, 여기서 빼 두면 받게 되는 날에도
      // 아무도 눈치채지 못한다. 보내고, 서버가 무시하면 서버 사정이다.
      const r = await 보내기<{ sessionId: string; initialState: string; submissionEndpoint: string }>(
        "/internal/simulation/session", { environmentId, claimCode },
      );
      return {
        sessionId: r.sessionId,
        // 백엔드가 키오스크 이름과 만료를 아직 안 준다. 받게 되면 여기서 쓴다.
        // 만료를 클라이언트 시계로 가정하고 있어서, 서버가 먼저 끝내면 앱은 모른다.
        // docs/BACKEND_INTEGRATION.md 질문 ① 이 이것이다.
        kioskName: "키오스크",
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
    },

    // 제출·검증·실행·증거가 이 한 번의 호출로 전부 돌아온다.
    // 여기서 통째로 받아 두고 아래 셋이 나눠 읽는다. 두 번 부르지 않는다.
    async submit(sessionId, submission) {
      const r = await 보내기<ExecuteResult>("/internal/simulation/submit-and-run", { sessionId, submission });
      실행결과.set(sessionId, r);
    },

    // 서버가 실제로 판단한 결과를 읽는다.
    //
    // 백엔드의 submit-and-run 은 '제출 → 검증 → (통과 시) 실행' 이다.
    // 그래서 valid 가 false 면 키오스크에 아무것도 하지 않은 것이 보장된다.
    // 이 한 비트가 사용자에게 할 말을 가른다 — 다시 해 보시라고 할지,
    // 직원을 부르시라고 할지. 예전에는 알 방법이 없어 true 를 박아 뒀다.
    async validate(sessionId) {
      const r = 실행결과.get(sessionId);
      if (!r) throw new KioBridgeError("PLAN_NOT_FOUND", "실행 정보를 찾을 수 없어요", false);
      if (r.valid) return { valid: true };
      // 서버가 준 문장을 그대로 올린다. 없으면 화면이 기본 문구를 쓴다.
      const errors = (r.validation?.errors ?? []).map((e) => e.message).filter(Boolean);
      return { valid: false, ...(errors.length > 0 ? { errors } : {}) };
    },

    async execute(sessionId) {
      const r = 실행결과.get(sessionId);
      if (!r) throw new KioBridgeError("PLAN_NOT_FOUND", "실행 정보를 찾을 수 없어요", false);
      // runId 는 이 실행 하나를 가리키는 값이다. 없으면 세션으로 대신한다.
      return { planId: r.evidence?.runId ?? sessionId };
    },

    // 증거는 submit-and-run 응답에 이미 실려 왔다. 따로 조회하지 않는다.
    // 예전에는 명세에만 있는 GET 경로를 불렀는데 백엔드에 그 경로가 없다.
    async getEvidence(sessionId) {
      const r = 실행결과.get(sessionId);
      const e = r?.evidence;
      if (!e) return { state: "running", reachedStep: 0 };

      // 킷의 stopType 은 NORMAL_BOUNDARY_STOP · SAFETY_STOP · NONE 이고
      // result 는 PASS · FAIL 이다. 안전 중단과 그냥 실패는 사용자에게
      // 할 말이 다르므로 SAFETY_STOP 만 중단 화면으로 보낸다.
      const state: EvidenceSummary["state"] =
        e.result === "PASS" ? "cart_ready" : e.stopType === "SAFETY_STOP" ? "aborted" : "running";

      return {
        state,
        // 몇 번째 화면까지 갔는지. 실행한 동작 수가 그대로 진행도다.
        reachedStep: e.executedActions?.length ?? 0,
        ...(state === "cart_ready" ? { cart: 장바구니(e.reviewSnapshot) } : {}),
        ...(state === "aborted"
          ? {
              abort: {
                code: e.stopType ?? "UNKNOWN",
                title: "안전을 위해 중단되었습니다",
                // 서버가 이유를 주면 그대로 쓴다. 지어내지 않는다.
                message: e.stopReason ?? "예상하지 못한 화면이 감지되어 작동을 멈췄어요.",
                userAction: "직원 초기화를 기다려 주세요",
              },
            }
          : {}),
      };
    },
  };
}

export function createHttpBackend(baseUrl: string): Backend {
  // 타임아웃이 없으면 서버가 응답하지 않을 때 화면이 '연결 중' 에서 멈춘다.
  // 그 화면에는 취소 버튼도 하단 탭도 없어서 사용자가 할 수 있는 게 없다.
  const TIMEOUT_MS = 15_000;
  const 부르기 = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        ...init,
        signal: ac.signal,
        headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      });
    } catch (e) {
      throw new KioBridgeError(
        (e as Error)?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
        (e as Error)?.name === "AbortError" ? "응답이 너무 늦어요. 잠시 뒤 다시 시도해 주세요" : "연결하지 못했어요",
        true,
      );
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      // 서버가 준 코드·문구를 그대로 화면까지 올린다. 삼키면 사용자가 왜 막혔는지 알 수 없다.
      const body = await res.json().catch(() => ({}));
      throw new KioBridgeError(
        body.code ?? `HTTP_${res.status}`,
        body.message ?? "요청을 처리하지 못했어요",
        res.status >= 500 || res.status === 408,
      );
    }
    // 204 만 막으면 부족하다. 본문 없이 200 을 주는 서버도 있고 그때 json() 이 터진다.
    const 본문 = await res.text();
    // 204 는 본문이 없는 게 정상이다. 그 외에 비어 있으면 서버가 뭔가 잘못한 것이고,
    // undefined 를 넘기면 호출부가 한참 뒤에서 터진다. 여기서 말한다.
    if (!본문) {
      if (res.status === 204) return undefined as T;
      throw new KioBridgeError("EMPTY_RESPONSE", "서버가 빈 답을 보냈어요", true);
    }
    try {
      return JSON.parse(본문) as T;
    } catch {
      // 파싱 실패가 그대로 올라가면 화면이 SyntaxError 를 사용자에게 보여 준다.
      throw new KioBridgeError("BAD_RESPONSE", "서버 응답을 읽지 못했어요", true);
    }
  };
  const 보내기 = <T>(path: string, body: unknown) =>
    부르기<T>(path, { method: "POST", body: JSON.stringify(body) });

  return {
    createSession: (i) => 보내기("/api/v1/sessions", i),
    filterCandidates: (i) => 보내기("/api/v1/candidate-filters", i),
    recommend: (i) => 보내기("/api/v1/recommendations", i),
    submit: (id, s) => 보내기(`/api/v1/sessions/${encodeURIComponent(id)}/submission`, s),
    validate: (id) => 보내기(`/api/v1/sessions/${encodeURIComponent(id)}/validate`, {}),
    execute: (id) => 보내기(`/api/v1/sessions/${encodeURIComponent(id)}/execute`, {}),
    getEvidence: (id) => 부르기(`/internal/simulation/evidence/${encodeURIComponent(id)}`),
  };
}
