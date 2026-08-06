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
  /** 사용자가 고른 조건이 반영됐는지 항목별로. */
  matchedOptions: { label: string; value: string; matched: boolean; note?: string }[];
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
  const 세션 = new Map<string, { rec: RecommendationResult; result: MappingResponse["result"] }>();

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
      const out: PairingResult = { pairingId: s.sessionId, kioskName: s.kioskName, expiresAt: s.expiresAt };
      return out;
    },

    async requestMapping(pairingId, profileId) {
      const filtered = await backend.filterCandidates({ environmentId, profileId });
      const rec = await backend.recommend({
        environmentId, profileId, survivingCandidateIds: filtered.survivingCandidateIds,
      });
      const result = 판정(rec);
      세션.set(pairingId, { rec, result });

      // 무엇을 왜 뺐는지는 후보 필터와 추천 양쪽에서 온다. 둘 다 사용자에게 보여 준다.
      const 제외 = [...filtered.excluded, ...rec.excludedCandidates];
      const reasons: MappingResponse["reasons"] = [
        ...rec.recommendationReasons.map((text) => ({ kind: "used" as const, text })),
        ...제외.map((e) => ({ kind: "excluded" as const, text: e.explanation })),
      ];

      const 보이기 = (id: string) => rec.display[id];
      const 고름 = rec.recommendedCandidateId ? 보이기(rec.recommendedCandidateId) : undefined;

      if (result === "not_found") {
        return { result, reasons, message: "담을 수 있는 메뉴가 없어요" };
      }
      if (result === "clarification") {
        return {
          result, reasons,
          reason: "비슷한 메뉴가 여러 개예요",
          // 목에만 넣고 여기를 빼면, 실서버로 바꾸는 순간 조건표가 다시 통째로
          // 사라진다. 사용자는 포장인지 종이컵인지 못 보고 승인하게 된다.
          // '맞았는지' 는 판단하지 않는다 — 어느 후보를 고르느냐에 따라 달라진다.
          profileOptions: rec.matchedOptions.map((o) => ({ ...o, matched: true, note: undefined })),
          // 상품 ID 를 화면으로 내보내지 않는다. 이번 응답 안에서만 쓰는 표식으로 바꾼다.
          candidates: [rec.recommendedCandidateId!, ...rec.alternativeCandidateIds]
            .map((id, i) => ({ candidateId: `c${i + 1}`, ...보이기(id) })),
        };
      }
      return {
        result, reasons,
        ...(result === "changed" ? { diffNote: "저장하신 주문과 달라진 점이 있어요. 이대로 진행할까요?" } : {}),
        item: 고름 && { ...고름, options: rec.matchedOptions },
      };
    },

    // P0-4: 실행 계획은 이 안에서만 만들어진다.
    async approve(input: ApproveInput): Promise<PlanCreated> {
      const s = 세션.get(input.pairingId);
      if (!s) throw new KioBridgeError("MAPPING_REQUIRED", "메뉴를 먼저 찾아야 해요", false);

      // 승인 조건은 서버가 답한 내용을 기준으로 본다. 클라이언트가 보낸 값을 믿지 않는다.
      if (s.result === "not_found") throw new KioBridgeError("MENU_NOT_FOUND", "담을 수 있는 메뉴가 없어요", false);
      if (s.result === "clarification" && !input.candidateId)
        throw new KioBridgeError("CANDIDATE_REQUIRED", "메뉴를 선택해 주세요", true);
      if (s.result === "changed" && !input.acknowledgedDiff)
        throw new KioBridgeError("DIFF_NOT_ACKNOWLEDGED", "달라진 내용을 확인해 주세요", true);
      if (s.result === "low_confidence" && !input.confirmedLowConfidence)
        throw new KioBridgeError("CONFIRMATION_REQUIRED", "이 메뉴가 맞는지 확인해 주세요", true);

      // 사용자가 고른 표식(c1·c2·c3)을 서버가 아는 실제 후보로 되돌린다.
      // 우리가 준 표식인지 반드시 확인한다. 예전에는 숫자로 바꾸기만 해서
      // c99 는 undefined 를 제출했고, cabc·c0 는 조용히 1순위로 되돌아갔다.
      // 사용자가 고르지 않은 메뉴가 담긴다는 뜻이다.
      const 후보목록 = [s.rec.recommendedCandidateId!, ...s.rec.alternativeCandidateIds];
      let candidateId = s.rec.recommendedCandidateId;
      if (input.candidateId) {
        const m = /^c(\d+)$/.exec(input.candidateId);
        const 순번 = m ? Number(m[1]) - 1 : -1;
        if (순번 < 0 || 순번 >= 후보목록.length) {
          throw new KioBridgeError("CANDIDATE_UNKNOWN", "선택한 메뉴를 찾을 수 없어요", true);
        }
        candidateId = 후보목록[순번];
      }

      // 제출 → 검증 → 실행. 어느 단계에서 멈췄는지 구분해서 알린다.
      await backend.submit(input.pairingId, { ...input, candidateId });
      const v = await backend.validate(input.pairingId);
      if (!v.valid) {
        throw new KioBridgeError("VALIDATION_FAILED", v.errors?.[0] ?? "계획을 검증하지 못했어요", false);
      }
      const { planId } = await backend.execute(input.pairingId);
      // 실행 조회는 sessionId 기준이므로 화면이 들고 다닐 값에 함께 실어 둔다.
      return { planId: `${input.pairingId}::${planId}` };
    },

    // 서버에 지우기 경로가 생기면 여기서 함께 부른다. 지금은 이 계층이 들고 있는
    // 것만 지운다. 세션 Map 은 비우는 경로가 없으면 무한히 자라기도 한다.
    async forgetAll() {
      // 서버에 지우기 경로가 있으면 함께 부른다. 없으면 이 계층 것만 지운다.
      const ids = [...세션.keys()];
      세션.clear();
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
    return (본문 ? JSON.parse(본문) : undefined) as T;
  };
  const 보내기 = <T>(path: string, body: unknown) =>
    부르기<T>(path, { method: "POST", body: JSON.stringify(body) });

  return {
    createSession: (i) => 보내기("/api/v1/sessions", i),
    filterCandidates: (i) => 보내기("/api/v1/candidate-filters", i),
    recommend: (i) => 보내기("/api/v1/recommendations", i),
    submit: (id, s) => 보내기(`/api/v1/sessions/${id}/submission`, s),
    validate: (id) => 보내기(`/api/v1/sessions/${id}/validate`, {}),
    execute: (id) => 보내기(`/api/v1/sessions/${id}/execute`, {}),
    getEvidence: (id) => 부르기(`/internal/simulation/evidence/${id}`),
  };
}
