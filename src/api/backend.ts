import type {
  ApproveInput, CartResult, MappedOption, RejectInput, MappingResponse, PairingResult, PlanCreated, PlanStatus, OrderSheet, StepStatus,
} from "@/domain/types";
import {
  toChickenStoreContext, toContextNormalizationInput, toProfileNormalizationInput,
  type CanonicalProfile, type ChickenStoreSessionContext,
} from "@/api/canonical";
import { KioBridgeError, clearSheets, type KioBridgeApi } from "@/api/client";
import { STEPS } from "@/domain/catalog";
import { 연동기록, 팀백엔드모드 } from "@/api/devlog";
import { 접근성설정 } from "@/api/a11y";

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
    /**
     * 이 세션이 실제로 붙은 키오스크. 카탈로그를 정하는 값이다.
     * 서버가 알려 주면 이후 단계에서 그 값을 쓴다 — 화면이 보낸 값을 다시 믿지 않는다.
     */
    environmentId?: string;
  }>;

  /**
   * POST /api/v1/candidate-filters — severity=BLOCK 위반 후보를 제외하고 생존 후보 반환
   *
   * profile 은 선택 항목이다. 서버가 주문표를 id 로 찾아 줄 수 있으면 필요 없지만,
   * 팀 백엔드는 주문표 저장소가 없어서 내용을 그대로 받아야 한다.
   */
  filterCandidates(input: { environmentId: string; profileId: string; profile?: OrderSheet }): Promise<{
    survivingCandidateIds: string[];
    excluded: { candidateId: string; reasonCode: string; explanation: string }[];
    /** 후보 표시 정보. 서버가 이름·가격을 함께 주면 여기 실린다. */
    display?: Record<string, { displayName: string; priceText: string; imageUrl?: string }>;
  }>;

  /** POST /api/v1/recommendations — 1순위 추천·이유·대안·제외 사유·확신도 */
  recommend(input: {
    environmentId: string;
    /** 백엔드가 이 값을 profileId 라 부른다. 앱 쪽 이름(sheetId)은 경계에서 여기로 맞춘다. */
    profileId: string;
    survivingCandidateIds: string[];
    profile?: OrderSheet;
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
   * 사용자가 승인하지 않겠다고 한 것을 서버에 남긴다.
   *
   * 킷 계약의 UserDecision.decision 이 APPROVE·REJECT·MODIFY 셋이다.
   * 거절은 빈 실행계획으로 제출된다 — 검증까지만 가고 실행은 건너뛴다.
   * 구현하지 않으면 화면은 그냥 되돌아간다. 사람을 붙잡지는 않는다.
   */
  reject?(sessionId: string, payload: unknown): Promise<void>;

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
  /**
   * 서버가 증거를 읽어 만든 한 문장. 결과 화면에서 "왜 이걸 담았는지" 로 쓴다.
   * 없으면 화면이 그 줄을 아예 그리지 않는다 — 지어내지 않는다.
   */
  note?: string;
  /**
   * 서버가 매긴 상태 문장(#48 의 summary.status). 그대로 인용해서 보여 준다.
   *
   * 앱 문구로 옮기지 않는다. 이 줄의 쓸모가 "이 값이 서버에서 왔다" 를 보이는
   * 것이라, 우리 말로 바꾸는 순간 서버가 준 것인지 앱이 지어낸 것인지 다시
   * 구분할 수 없어진다. 문체가 다른 것은 인용이라고 밝혀서 푼다.
   */
  serverStatus?: string;
}

// ─── 확신도 경계 ─────────────────────────────────────────────────────────────
// 심사 필수 기준: "신뢰도 낮을 때 사용자 재확인 수행".
// 서버가 requiresReconfirmation 을 켜 주면 그걸 따르고, 안 켜 줘도
// 확신도가 이 값 아래면 화면이 스스로 재확인을 요구한다. 낮은 확신을
// 조용히 통과시키는 것보다 한 번 더 묻는 쪽이 안전하다.
export const LOW_CONFIDENCE = 0.7;

// ─── 조립 — 화면이 쓰는 네 동작을 위 호출들로 만든다 ──────────────────────────

/**
 * 화면이 쓰는 API 를 백엔드 위에 조립한다.
 *
 * getSheet 은 주문표 id 로 실제 내용을 찾아 주는 함수다. 팀 백엔드는 주문표
 * 저장소가 없어서 매번 내용을 함께 보내야 하고, 그 내용은 화면이 들고 있다.
 * 서버가 id 로 찾아 줄 수 있게 되면 이 인자는 빼면 된다.
 */
export function createApi(
  backend: Backend,
  environmentId = "chicken-store",
  getSheet?: (sheetId: string) => OrderSheet | undefined,
): KioBridgeApi {
  // 세션 하나에 대해 서버가 뭐라고 답했는지. 승인 검사와 실행 조회의 기준이 된다.
  // 페어링 만료 시각. 승인 때 끝난 연결인지 다시 보려면 필요하다.
  const 만료 = new Map<string, number>();
  // 세션이 실제로 붙은 키오스크. 서버가 알려 주면 environmentId 인자 대신 이걸 쓴다.
  const 환경 = new Map<string, string>();
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
    sheetId: string;
    expiresAt: number;
    executed?: boolean;
    /*
     * 거절한 세션. 지우지 않고 표시만 남긴다.
     *
     * 예전에는 reject 가 세션을 지웠다. 그러면 forgetAll 이 세션 목록으로
     * 지울 대상을 찾을 때 이 페어링이 이미 없어서, 거절까지 갔던 사람의
     * 정규화된 주문표(고른 알레르기·맵기 전부)가 메모리에 그대로 남았다.
     * '이 기기에서 정보 지우기' 가 약속한 일이 실제로 안 일어난 것이다.
     */
    rejected?: boolean;
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
      // 카탈로그는 QR 로 연결한 키오스크가 정한다. 서버가 알려 주면 그걸 쓴다.
      // 예전에는 "chicken-store" 로 고정이라 병원에 붙어도 닭강정을 봤다.
      환경.set(s.sessionId, s.environmentId ?? environmentId);
      const out: PairingResult = { pairingId: s.sessionId, kioskName: s.kioskName, expiresAt: s.expiresAt };
      return out;
    },

    async requestMapping(pairingId, sheetId) {
      // 서버에 주문표 저장소가 없으면 내용을 함께 보내야 한다. 있으면 id 만으로 충분하다.
      const profile = getSheet?.(sheetId);
      const env = 환경.get(pairingId) ?? environmentId;
      const filtered = await backend.filterCandidates({ environmentId: env, profileId: sheetId, ...(profile ? { profile } : {}) });
      const rec = await backend.recommend({
        environmentId: env, profileId: sheetId, survivingCandidateIds: filtered.survivingCandidateIds,
        ...(profile ? { profile } : {}),
      });
      // 이름·가격을 추천이 안 주면 후보 필터가 준 것으로 채운다.
      // 둘 다 없으면 화면에 보여 줄 게 없어서 그 후보는 빠진다.
      if (filtered.display) {
        rec.display = { ...filtered.display, ...rec.display };
      }
      const result = 판정(rec);
      세션.set(pairingId, {
        rec, result, sheetId,
        // 페어링을 안 거치고 바로 매핑을 부르는 경우는 없어야 하지만,
        // 없으면 만료를 알 수 없으므로 0 으로 두어 승인에서 막힌다.
        expiresAt: 만료.get(pairingId) ?? 0,
      });

      // 무엇을 왜 뺐는지는 후보 필터와 추천 양쪽에서 온다. 둘 다 사용자에게 보여 준다.
      //
      // 같은 후보를 양쪽이 다 빼면 같은 문장이 두 번 나온다. 실제로 그랬다 —
      // "[PEANUT] 알레르기와 겹쳐서 제외됐어요." 가 나란히 두 줄로 보였다.
      // 사용자에게 같은 말을 두 번 하지 않는다.
      const 본후보 = new Set<string>();
      const 제외: typeof rec.excludedCandidates = [];
      for (const e of [...filtered.excluded, ...rec.excludedCandidates]) {
        if (본후보.has(e.candidateId)) continue;
        본후보.add(e.candidateId);
        제외.push(e);
      }
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
          sheetOptions: rec.matchedOptions,
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
      // 아니라고 한 것을 뒤에서 되살리지 않는다. 담으려면 메뉴를 처음부터 다시 찾는다.
      if (s.rejected) throw new KioBridgeError("MAPPING_REQUIRED", "메뉴를 먼저 찾아야 해요", false);
      // client.ts 와 같은 검사를 여기서도 한다. 한쪽만 막으면 구현을 바꿀 때 샌다.
      if (s.sheetId !== input.sheetId) {
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
        // 주문표 내용을 함께 넘긴다. 팀 백엔드는 주문표 저장소가 없어서
        // 승인 때도 내용을 다시 받아야 제출물을 조립할 수 있다.
        const profile = getSheet?.(input.sheetId);
        await backend.submit(input.pairingId, { ...input, candidateId, ...(profile ? { profile } : {}) });
        const v = await backend.validate(input.pairingId);
        if (!v.valid) {
          // 이유를 여러 줄 준 경우 전부 넘긴다. 하나만 보여 주면 그것을
          // 고쳐도 또 막히고, 사용자는 왜 막히는지 끝까지 모른다.
          throw new KioBridgeError(
            "VALIDATION_FAILED",
            v.errors?.[0] ?? "계획을 검증하지 못했어요",
            false,
            v.errors,
          );
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

    /**
     * 승인하지 않겠다는 결정을 서버에 남긴다.
     *
     * 실패해도 던지지 않는다. 사용자는 이미 "그만두겠다" 고 했고, 그 뒤에
     * 오류 화면을 띄우면 나가려는 사람을 붙잡는 셈이다. 기록은 서버 사정이지
     * 사용자가 감당할 일이 아니다.
     */
    async reject(input) {
      const s = 세션.get(input.pairingId);
      // 매핑도 안 한 상태면 거절할 대상이 없다. 조용히 끝낸다.
      if (!s || s.sheetId !== input.sheetId) return;
      // 지우지 않고 표시만 한다. 지우면 forgetAll 이 이 페어링을 못 찾아서,
      // 거절까지 갔던 사람의 정규화된 주문표가 '정보 지우기' 뒤에도 남는다.
      s.rejected = true;
      if (!backend.reject) return;
      try {
        const profile = getSheet?.(input.sheetId);
        await backend.reject(input.pairingId, { ...input, ...(profile ? { profile } : {}) });
      } catch {
        // 기록에 실패해도 화면은 되돌아간다.
      }
    },

    /**
     * '이 기기에서 정보 지우기'.
     *
     * 이 계층이 들고 있는 것을 전부 비운다. 서버에 지우기 경로가 생기면 여기서
     * 함께 부른다 — 지금은 백엔드에 그 경로가 없어서, 이미 올라간 주문표와
     * 승인·거절 기록은 남는다. 그 사실은 개인정보 안내 화면이 그대로 말한다.
     * 지운 척하지 않는 것이 여기서 할 수 있는 전부다.
     *
     * 붙인 구현이 들고 있는 것도 함께 비운다. 세션이 하나도 없을 때도 부른다 —
     * 예전에는 세션 목록으로만 돌아서, 거절해서 세션이 비었거나 매핑 전에
     * 지운 경우에 정규화된 주문표가 그대로 남았다.
     */
    async forgetAll() {
      const ids = [...세션.keys()];
      세션.clear();
      만료.clear();
      환경.clear();
      // 화면이 주문에 쓰라고 등록해 둔 주문표 사본. 여기 남으면 '모두 지워요' 가
      // 사실이 아니다. 목(mockApi)은 이미 지우고 있었고 이 경로만 빠져 있었다.
      clearSheets();
      // 오간 기록에는 요청.응답 본문이 통째로 들어 있다 — 고른 조건도 거기 있다.
      // 화면에서 지웠다고 말해 놓고 구석 패널에 그대로 남으면 그 말이 거짓이 된다.
      연동기록.비우기();
      if (backend.forgetSession) {
        await Promise.all((ids.length > 0 ? ids : [""]).map((id) => backend.forgetSession!(id)));
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
          // 중단됐을 때야말로 "이게 키오스크가 한 말이다" 를 보여 줄 자리다.
          // 잘 된 경우에만 싣고 여기서 빠뜨리면, 정작 확인이 필요한 쪽이 비어 있다.
          ...(e.serverStatus ? { serverStatus: e.serverStatus } : {}),
        };
      }
      if (e.state === "cart_ready") {
        return {
          state: "cart_ready", steps, cart: e.cart,
          ...(e.note ? { note: e.note } : {}),
          ...(e.serverStatus ? { serverStatus: e.serverStatus } : {}),
        };
      }
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

/**
 * POST /internal/orchestrator/approve 응답 (#48 이후).
 *
 * 예전에는 ExecuteResult 가 그대로 왔고, 지금은 한 겹 감싸여 온다.
 *   기존: { valid, run, evidence, validation }
 *   이후: { valid, summary, raw }   ← raw 안에 위의 것이 그대로 있다
 *
 * 둘 다 받는다. #48 이 머지되기 전에도 뒤에도 같은 코드로 돈다.
 */
interface ApprovalResult {
  valid: boolean;
  /** 서버가 증거를 읽어 만든 한 줄 요약. 화면은 recommendation 만 쓴다. */
  summary?: { status?: string; recommendation?: string; stopReason?: string };
  /**
   * 검증에 걸린 이유를 사람이 읽는 문장으로 옮긴 것 (#66).
   *
   * 서버가 킷 오류 코드(REQUIRED_FIELD_MISSING 등)를 표에서 찾아 바꿔 준다.
   * 성공하면 빈 배열로 온다 — 있고 없고로 실패를 판단하면 안 된다. valid 를 본다.
   *
   * 선택 필드로 둔다. #66 이전 백엔드에는 이 필드가 아예 없고, 그때는
   * 예전처럼 raw.validation.errors 의 message 를 쓴다.
   */
  validationMessages?: string[];
  raw?: ExecuteResult;
}

/** 킷 fixture 의 후보. candidate-filters 가 이 모양으로 돌려준다. */
interface KitCandidate {
  candidateId: string;
  name?: string;
  price?: number;
  available?: boolean;
  /** 후보가 실제로 갖고 있는 값. 사용자가 고른 값과 같은 어휘라 그대로 비교할 수 있다. */
  attributes?: { spicyLevel?: string; boneType?: string; allergenIds?: string[] };
  /** 이 후보가 받아 주는 선택지. 이용 방식·컵은 여기에 있다. */
  supportedOptions?: Record<string, string[]>;
}

/**
 * 제외 사유.
 *
 * explanation 은 규칙 추적용 문자열이다("ruleId=..., sourceValue=[PEANUT]").
 * 사람이 읽는 문장은 reasonText 에 따로 온다. 화면에는 reasonText 를 쓴다.
 */
interface KitExcluded {
  candidateId: string;
  reasonCode?: string;
  reasonText?: string;
  explanation?: string;
}

/** POST /api/v1/candidate-filters 응답 (CandidateFilterResult). */
interface CandidateFilterResponse {
  eligibleCandidates?: KitCandidate[];
  excludedCandidates?: KitExcluded[];
}

/** 사람이 읽을 문장만 고른다. 없으면 비운다 — 규칙 추적 문자열을 보여 주지 않는다. */
const 사유문장 = (e: KitExcluded): string => e.reasonText ?? "";

/** POST /api/v1/recommendations 응답 (Recommendation). */
interface RecommendationResponse {
  recommendedCandidateId: string | null;
  alternativeCandidateIds?: string[];
  excludedCandidates?: { candidateId: string; reasonCode?: string; explanation?: string }[];
  recommendationReasons?: string[];
  unmetConditions?: string[];
  confidence?: number;
  requiresReconfirmation?: boolean;
}

/**
 * 후보가 들고 있는 값과 사용자가 고른 값을 축별로 맞춰 본다.
 *
 * 이름 문자열로 짐작하지 않는다 — 예전에 그렇게 했다가 온도가 ICE 인
 * '아이스 아메리카노' 를 고른 분께 "달라요" 라고 말한 적이 있다.
 * 여기서 보는 건 서버가 준 attributes·supportedOptions 로, 사용자가 고른 값과
 * 같은 어휘다. 같은 말끼리 비교하는 것이라 짐작이 아니다.
 *
 * 서버가 값을 안 주는 축은 넣지 않는다. 모르는 것을 '맞았다' 고 하지 않는다.
 */
function 확인표(c: KitCandidate | undefined, p: OrderSheet): MappedOption[] {
  if (!c) return [];
  const ctx = toChickenStoreContext(p);
  const 축: { label: string; 고른: string | number | null; 후보: string | undefined; 어긋날때: string }[] = [
    { label: "이용 방식", 고른: ctx.preferences.serviceType, 후보: c.supportedOptions?.SERVICE_TYPE?.join(","), 어긋날때: "오늘은 이 방식이 안 돼요" },
    { label: "맵기", 고른: ctx.preferences.spicyLevel, 후보: c.attributes?.spicyLevel, 어긋날때: "오늘은 이 조합이 없어요" },
    { label: "형태", 고른: ctx.preferences.boneType, 후보: c.attributes?.boneType, 어긋날때: "오늘은 이 조합이 없어요" },
    { label: "컵", 고른: ctx.preferences.cupOption, 후보: c.supportedOptions?.CUP?.join(","), 어긋날때: "오늘은 이 컵이 없어요" },
  ];
  const 행: MappedOption[] = [];
  for (const a of 축) {
    // 판단하지 않고 넘기는 세 경우.
    //   NO_PREFERENCE  사용자가 안 골랐다
    //   UNKNOWN        골랐는데 우리가 enum 으로 못 옮겼다
    //   후보값 없음     서버가 그 축을 안 줬다
    // UNKNOWN 을 그냥 두면 "오늘은 이 조합이 없어요" 가 나가는데, 사실은
    // 앱이 그 선택지를 못 읽은 것이다. 모르는 것을 안 맞았다고 말하지 않는다.
    if (a.고른 === "NO_PREFERENCE" || a.고른 === "UNKNOWN" || a.고른 == null || a.후보 === undefined) continue;
    // supportedOptions 는 여러 값이라 포함 여부로, attributes 는 한 값이라 같은지로 본다.
    const matched = a.후보.includes(",") ? a.후보.split(",").includes(String(a.고른)) : a.후보 === a.고른;
    // 화면에는 사용자가 고른 그 한글 값을 보여 준다. enum 을 그대로 보여 주지 않는다.
    const 보일값 = p.selections?.[a.label]?.[0];
    if (!보일값) continue;
    행.push({ label: a.label, value: 보일값, matched, ...(matched ? {} : { note: a.어긋날때 }) });
  }
  const 수량 = p.selections?.["수량"]?.[0];
  // 수량은 후보가 아니라 주문이 정하는 값이라 어긋날 수가 없다.
  if (수량) 행.push({ label: "수량", value: 수량, matched: true });
  return 행;
}

const 원 = (n: number | undefined) => (typeof n === "number" ? `${n.toLocaleString("ko-KR")}원` : "");

/**
 * 받침이 있으면 '은', 없으면 '는'.
 *
 * 어르신이 읽는 문장이라 조사가 틀리면 기계가 찍어 낸 티가 난다.
 * 한글이 아닌 이름은 판별할 방법이 없어 받침 없는 쪽으로 둔다.
 */
/** 사용자가 고른 후보를 1순위로 올린다. 대안 목록도 함께 맞춘다. */
/*
 * 서버가 준 summary.status(#48)를 이 앱의 말투로 옮긴다.
 *
 * 서버 문장은 이미 한국어지만 '~되었습니다' 체다. 이 앱은 처음부터 끝까지
 * '~해요' 로 말하는데, 마지막 화면에서만 문체가 바뀌면 거기부터는 앱이
 * 사용자에게 하는 말이 아니라 기계가 뱉은 말로 읽힌다.
 *
 * stopType 만 보면 서버가 '실행할 수 없습니다' 로 판단한 경우를 구분하지 못한다.
 * 그래서 중단 화면 제목은 이 표를 먼저 본다.
 *
 * 지금은 코드가 없고 문장만 온다(EvidenceSummary.status). 서버가 문구를 바꾸면
 * 여기가 안 맞으므로 모르는 값이면 우리 문구로 물러난다 — 서버 문장을 그대로
 * 올리지는 않는다. 문장 대신 코드로 달라고 docs 에 적어 두었다.
 */
const 앱말투: Record<string, string> = {
  "정상적으로 장바구니에 추가되었습니다.": "장바구니에 담았어요",
  "실행할 수 없습니다.": "담을 수 없어요",
  "안전하게 중단되었습니다.": "안전을 위해 멈췄어요",
  "처리 중 문제가 발생했습니다.": "끝까지 담지 못했어요",
};

/*
 * 서버가 준 오류 문장을 화면에 올려도 되는지 본다.
 *
 * 결제 표현은 화면에 있기만 해도 실격이다. 성공 문구(status)는 아는 넷만
 * 인용하는 흰 목록으로 막아 뒀는데, 오류 문장에는 같은 방법을 못 쓴다 —
 * 서버 표(ValidationErrorMessageService)에 코드가 늘 때마다 흰 목록에서
 * 빠져 사용자가 이유를 못 보게 된다. 막을 것만 막는다.
 *
 * 지금 서버 표 열여섯 문장에는 하나도 걸리지 않는다. 나중에 누가 표에
 * 한 줄을 더할 때를 위한 것이다.
 */
const 금지표현 = /결제|결재|주문\s*완료/;
const 보여도되나 = (문장: string) => 문장.length > 0 && !금지표현.test(문장);

function 고른것반영(rec: RecommendationResponse, 고른: string | undefined): RecommendationResponse {
  if (!고른 || 고른 === rec.recommendedCandidateId) return rec;
  const 대안 = (rec.alternativeCandidateIds ?? []).filter((id) => id !== 고른);
  // 원래 1순위는 사라지지 않는다. 대안으로 내려간다.
  if (rec.recommendedCandidateId && rec.recommendedCandidateId !== 고른) 대안.unshift(rec.recommendedCandidateId);
  return { ...rec, recommendedCandidateId: 고른, alternativeCandidateIds: 대안 };
}

const 은는 = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "는";
  return (c - 0xac00) % 28 === 0 ? "는" : "은";
};

export function createTeamBackend(baseUrl = "/api/bff"): Backend {
  const 보내기 = async <T>(path: string, body?: unknown): Promise<T> => {
    const 방법 = body === undefined ? "GET" : "POST";
    // 개발 중에 어디로 무엇이 나갔는지 눈으로 보기 위해서만 잰다.
    const 시작 = 팀백엔드모드 ? performance.now() : 0;
    /*
     * 본문까지 남긴다.
     *
     * 경로와 상태만 남기면 "요청이 나갔다" 는 알 수 있어도 "화면의 이 문장이
     * 서버에서 온 것이다" 는 알 수 없다. ?log=1 화면이 그걸 보여 주려면 응답
     * 본문이 있어야 한다. 여기 경로에는 비밀이 실리지 않는다 — 계정 계열은
     * account.ts 가 따로 부르고 거기서는 본문을 안 남긴다(devlog 의 본문을남길까).
     */
    const 적기 = (상태: number | "실패", 응답본문?: string) => {
      if (!팀백엔드모드) return;
      연동기록.남기기({
        방법, 경로: path, 상태,
        걸린시간: Math.round(performance.now() - 시작), 시각: Date.now(),
        ...(body === undefined ? {} : { 요청: JSON.stringify(body) }),
        ...(응답본문 === undefined ? {} : { 응답: 응답본문 }),
      });
    };

    let res: Response;
    try {
      res = await fetch(baseUrl + path, {
        // body 가 없으면 조회다. 명세의 evidence 는 GET 이라 POST 로 부르면 405 가 난다.
        method: 방법,
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (e) {
      적기("실패");
      throw e;
    }

    /*
     * 본문은 한 번만 읽을 수 있다. 먼저 문자열로 받아 두고 성공.실패 양쪽에서 쓴다.
     * 예전에는 실패 쪽에서 res.json() 을 따로 불러서, 기록에 남길 본문이 없었다.
     *
     * 읽는 것 자체도 실패할 수 있다(스트림이 중간에 끊기는 경우). 막아 두지 않으면
     * !res.ok 분기에 닿기도 전에 TypeError 가 올라가서, 호출자는 HTTP 상태가 담긴
     * KioBridgeError 대신 개발자 문장을 받는다. account.ts 는 이미 막아 두었는데
     * 이쪽만 빠져 있었다.
     */
    const t = await res.text().catch(() => null);
    적기(res.status, t ?? undefined);

    if (!res.ok) {
      // 본문을 못 읽었어도 상태 코드는 안다. 그것만으로도 할 말이 있다.
      const b = (() => { try { return JSON.parse(t ?? "") as { code?: string; message?: string }; } catch { return {}; } })();
      throw new KioBridgeError(b.code ?? `HTTP_${res.status}`, b.message ?? "요청을 처리하지 못했어요", res.status >= 500);
    }
    if (t === null) throw new KioBridgeError("BAD_RESPONSE", "서버 응답을 읽지 못했어요", true);
    if (!t) return undefined as T;
    try {
      return JSON.parse(t) as T;
    } catch {
      // 200 인데 JSON 이 아닌 것(프록시가 끼워 넣은 HTML 같은 것)이 올 수 있다.
      // 막아 두지 않으면 SyntaxError 가 그대로 올라가 "Unexpected token '<'" 가
      // 어르신 화면에 뜬다. account.ts 는 이미 막아 두었고 여기만 빠져 있었다.
      throw new KioBridgeError("BAD_RESPONSE", "서버 응답을 읽지 못했어요", true);
    }
  };

  // 승인이 조립·제출·검증·실행을 한 번에 하므로 3단계로 나눌 수 없다. 응답을
  // 통째로 담아 두고 validate·execute·getEvidence 가 나눠 읽는다.
  const 실행결과 = new Map<string, ExecuteResult>();
  // 서버가 준 추천을 그대로 승인 요청에 되돌려 줘야 한다. 화면은 이 값을 보지 않는다.
  const 추천 = new Map<string, RecommendationResponse>();
  // 승인 응답에 실려 온 서버 요약(#48). 결과 화면의 한 줄로 쓴다.
  const 서버요약 = new Map<string, { status?: string; recommendation?: string; stopReason?: string }>();
  // 승인 응답에 실려 온 검증 실패 문장(#66). 확인 화면이 그대로 보여 준다.
  // 실행결과(raw)에는 없는 값이라 따로 들고 있어야 한다.
  const 검증문장 = new Map<string, string[]>();
  // 후보 필터가 준 후보들. 이름·가격과 축별 값이 여기 있다.
  const 후보 = new Map<string, Map<string, KitCandidate>>();
  // 정규화를 거친 주문표·세션 맥락. 매핑과 승인이 같은 값을 쓴다.
  // 키는 환경 + 정규화에 넣은 입력 전체다. 주문표 id 만 쓰면 주문표를 고치거나
  // 다른 키오스크에 붙었을 때 낡은 값을 그대로 쓰게 된다.
  const 정규화됨 = new Map<string, { profile: CanonicalProfile; sessionContext: ChickenStoreSessionContext }>();
  // 승인은 매핑 때 쓴 그 키를 찾아야 한다. 주문표별로 마지막 키를 기억해 둔다.
  const 마지막키 = new Map<string, string>();

  /*
   * 위 네 Map(추천·후보·마지막키와 그 짝)은 주문표 id 를 키로 쓴다.
   *
   * 이건 "이 앱은 한 번에 연결 하나만 든다" 를 전제로 한다. App.tsx 가 pairingId 를
   * 하나만 들고, QR 을 새로 찍으면 앞 연결을 대체하면서 확인 화면도 닫는다.
   * 그래서 같은 주문표로 두 연결이 겹칠 일이 없다.
   *
   * 여러 연결을 동시에 다루게 되면 이 전제가 깨진다. 뒤 요청이 앞 요청의 추천과
   * 정규화 결과를 덮어써서, 앞 세션의 승인이 사용자가 확인한 것과 다른 내용을
   * 제출할 수 있다. 그때는 키를 pairingId(또는 서버 sessionId)로 옮겨야 한다.
   */

  const 캐시키 = (environmentId: string, p: OrderSheet) => {
    // collectedAt 은 부를 때마다 달라진다(현재 시각). 키에 넣으면 캐시가 한 번도
    // 안 맞는다. 결과를 바꾸는 건 고른 조건과 접근성 설정이라 그것만 넣는다.
    // 접근성 설정이 바뀌면 표준형도 달라진다. 키에 그대로 들어가므로 캐시가 자동으로 갈린다.
    const { collectedAt: _버림, ...주문표 } = toProfileNormalizationInput(p, { 접근성: 접근성설정.읽기() });
    const 키 = `${environmentId}|${JSON.stringify(주문표)}|${JSON.stringify(toContextNormalizationInput(p).contextInput)}`;
    마지막키.set(p.id, 키);
    return 키;
  };

  /**
   * 서버의 정규화 경로를 거친다.
   *
   * 우리가 CanonicalProfile 을 직접 만들어 보내면 두 가지가 어긋난다.
   *   - providerId 를 짐작해야 한다. 그건 서버 설정(kiobridge.team-id)에 있다.
   *   - 킷 스키마에 맞는지 아무도 확인하지 않는다. 승인 때 가서야 터진다.
   *
   * 정규화 경로는 원자료를 받아 표준형을 만들어 주고 킷으로 검증까지 해 준다.
   * 그걸 그대로 후보 필터·추천·승인에 쓴다. 결과는 주문표당 한 번만 받아 둔다.
   */
  const 정규화 = async (environmentId: string, p: OrderSheet) => {
    // 같은 주문표라도 붙은 키오스크가 다르면 표준형이 달라질 수 있다.
    // 주문표 내용을 고쳤을 때도 낡은 값을 쓰면 안 된다. 둘 다 키에 넣는다.
    const 키 = 캐시키(environmentId, p);
    const 있음 = 정규화됨.get(키);
    if (있음) return 있음;

    const pr = await 보내기<{
      status: string; profile: CanonicalProfile;
      contractValidation?: { valid: boolean; errors?: { message?: string }[] };
    }>("/api/v1/profile-normalizations", {
      environmentId,
      // 큰 글씨를 켜 놓고 주문해도 서버가 몰랐다 — opts 를 안 넘겨서 일곱이 전부
      // false 로 나가고 있었다. 화면이 묻는 값을 그대로 보낸다.
      profileInput: toProfileNormalizationInput(p, { 접근성: 접근성설정.읽기() }),
    });

    const sr = await 보내기<{
      status: string; sessionContext: ChickenStoreSessionContext;
      reconfirmationFields?: { path?: string; message?: string }[];
      contractValidation?: { valid: boolean; errors?: { message?: string }[] };
    }>("/api/v1/session-context-normalizations", { environmentId, ...toContextNormalizationInput(p) });

    // 서버가 못 쓰겠다고 하면 거기서 멈춘다. 조용히 넘기면 승인 직전에 터진다.
    for (const r of [pr, sr]) {
      if (r.status === "INVALID" || r.contractValidation?.valid === false) {
        const 첫줄 = r.contractValidation?.errors?.[0]?.message;
        throw new KioBridgeError("PROFILE_INVALID", 첫줄 ?? "저장하신 조건을 서버가 읽지 못했어요", false);
      }
    }
    // 재확인이 필요하다는 건 우리가 확신도를 낮게 적었을 때만 나온다.
    // 이 앱은 사용자가 직접 눌러 고르므로 여기 걸리면 보내는 쪽이 잘못된 것이다.
    if (sr.status === "RECONFIRMATION_REQUIRED") {
      const 첫줄 = sr.reconfirmationFields?.[0]?.message;
      throw new KioBridgeError("RECONFIRM_REQUIRED", 첫줄 ?? "저장하신 조건을 다시 확인해 주세요", true);
    }

    // 마지막 관문. 주문표와 세션 맥락을 합쳐 놓고 다시 본다.
    //
    // 개별 정규화는 각자 반쪽만 검사한다. 합쳐야 보이는 게 있다 —
    // 특히 알레르기가 UNKNOWN 이면 여기서만 걸린다.
    //
    //   HARD_CONSTRAINT_UNKNOWN
    //   "allergenIds 가 UNKNOWN 입니다. 임의로 추론하지 말고 재확인하거나
    //    안전한 대체경로를 사용하세요."
    //
    // 이 문을 건너뛰면, 앱이 모르는 알레르기를 가진 분에게 그대로 음식을
    // 추천하게 된다. 그건 이 앱이 절대 하면 안 되는 일이다.
    const vr = await 보내기<{
      status: string;
      recommendationReady: boolean;
      contractValidation?: { valid: boolean; errors?: { code?: string; message?: string }[] };
    }>("/api/v1/canonical-inputs/validate", {
      environmentId, profile: pr.profile, sessionContext: sr.sessionContext,
    });

    if (!vr.recommendationReady) {
      const 오류 = vr.contractValidation?.errors ?? [];
      const 알레르기모름 = 오류.some((e) => e.code === "HARD_CONSTRAINT_UNKNOWN");
      // 서버 문구는 개발자용이다. 사용자에게는 무엇을 하면 되는지로 바꿔 말한다.
      throw new KioBridgeError(
        오류[0]?.code ?? "NOT_RECOMMENDATION_READY",
        알레르기모름
          ? "저장하신 알레르기 중에 저희가 확인하지 못한 것이 있어요. 주문표에서 다시 골라 주시거나 직원에게 도움을 청해 주세요."
          : "저장하신 조건을 다시 확인해 주세요.",
        true,
      );
    }

    const out = { profile: pr.profile, sessionContext: sr.sessionContext };
    정규화됨.set(키, out);
    return out;
  };

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
    /**
     * 이 계층이 들고 있는 것을 비운다.
     *
     * 화면의 '이 기기에서 정보 지우기' 가 여기까지 닿아야 한다. 안 그러면
     * 정규화된 주문표와 세션 맥락(고른 알레르기·맵기 전부)이 메모리에 그대로
     * 남는다. 화면이 약속한 일이 실제로 일어나지 않는 것이다.
     *
     * 세션 하나만 지우라고 불려도 주문표 단위 캐시까지 비운다. 이 계층은
     * 한 번에 한 사람을 도우므로, 남겨 둘 이유가 없다.
     */
    async forgetSession(sessionId) {
      실행결과.delete(sessionId);
      서버요약.delete(sessionId);
      검증문장.delete(sessionId);
      추천.clear();
      후보.clear();
      정규화됨.clear();
      마지막키.clear();
    },

    async createSession({ environmentId, claimCode }) {
      // claimCode 를 버리면 QR 로 읽은 그 키오스크와 무관하게 세션이 열린다.
      // 다른 기계 앞에 서 있어도 같은 세션을 받는다는 뜻이다.
      // 백엔드가 아직 이 값을 받지 않지만, 여기서 빼 두면 받게 되는 날에도
      // 아무도 눈치채지 못한다. 보내고, 서버가 무시하면 서버 사정이다.
      const r = await 보내기<{ sessionId: string; environmentId?: string; initialState: string; submissionEndpoint: string }>(
        "/internal/simulation/session", { environmentId, claimCode },
      );
      return {
        sessionId: r.sessionId,
        // 서버가 세션 생성 시점의 값을 그대로 돌려준다. 조립 계층이 이후 단계에서
        // 이 값을 쓴다 — 화면이 보낸 값을 다시 믿지 않는다.
        ...(r.environmentId ? { environmentId: r.environmentId } : {}),
        // 백엔드가 키오스크 이름과 만료를 아직 안 준다. 받게 되면 여기서 쓴다.
        // 만료를 클라이언트 시계로 가정하고 있어서, 서버가 먼저 끝내면 앱은 모른다.
        // docs/BACKEND_INTEGRATION.md 질문 ① 이 이것이다.
        kioskName: "키오스크",
        expiresAt: Date.now() + 5 * 60 * 1000,
      };
    },

    /**
     * POST /api/v1/candidate-filters
     *
     * 알레르기·품절 같은 절대 조건으로 후보를 거른다. 점수를 깎는 게 아니라 뺀다.
     * 응답의 eligibleCandidates 에 이름·가격이 함께 오므로 화면 표시값도 여기서 만든다.
     * 추천 응답에는 그 값이 없어서, 이게 없으면 화면에 상품 ID 밖에 보여 줄 게 없다.
     */
    async filterCandidates({ environmentId, profile }) {
      if (!profile) throw new KioBridgeError("PROFILE_REQUIRED", "주문표를 찾을 수 없어요", false);
      const { sessionContext } = await 정규화(environmentId, profile);
      const r = await 보내기<CandidateFilterResponse>("/api/v1/candidate-filters", { environmentId, sessionContext });

      // 지금 팔지 않는 것은 후보가 아니다. 심사 필수 기준이 '선택 불가능 후보
      // 추천 0건' 이고, 서버가 available:false 를 남겨 보내는 걸 확인했다.
      // 서버가 나중에 걸러 주더라도 여기 검사는 남긴다 — 한쪽만 막으면 언젠가 샌다.
      const 담을수있는 = (r.eligibleCandidates ?? []).filter((c) => c?.candidateId && c.available !== false);

      const display: Record<string, { displayName: string; priceText: string }> = {};
      for (const c of 담을수있는) {
        if (c.name) display[c.candidateId] = { displayName: c.name, priceText: 원(c.price) };
      }
      후보.set(profile.id, new Map(담을수있는.map((c) => [c.candidateId, c])));

      const 뺀것 = (r.excludedCandidates ?? []).map((e) => ({
        candidateId: e.candidateId,
        reasonCode: e.reasonCode ?? "EXCLUDED",
        explanation: 사유문장(e),
      })).filter((e) => e.explanation);
      // 품절이라 뺀 것도 사용자에게 말해 준다. 조용히 사라지면 "왜 없지?" 가 된다.
      for (const c of (r.eligibleCandidates ?? [])) {
        if (c?.available === false && c.name) {
          뺀것.push({ candidateId: c.candidateId, reasonCode: "UNAVAILABLE", explanation: `${c.name}${은는(c.name)} 지금 팔지 않아서 뺐어요` });
        }
      }

      return { survivingCandidateIds: 담을수있는.map((c) => c.candidateId), excluded: 뺀것, display };
    },

    /**
     * POST /api/v1/recommendations
     *
     * 서버는 survivingCandidateIds 를 받지 않는다. 클라이언트가 보낸 필터 결과를
     * 믿으면 알레르기 필터를 우회할 수 있어서, 서버가 직접 다시 계산한다.
     * 그 판단이 옳아서 여기서도 따로 보내지 않는다.
     */
    async recommend({ environmentId, profile }) {
      if (!profile) throw new KioBridgeError("PROFILE_REQUIRED", "주문표를 찾을 수 없어요", false);
      const 정 = await 정규화(environmentId, profile);
      const r = await 보내기<RecommendationResponse>("/api/v1/recommendations", {
        environmentId, profile: 정.profile, sessionContext: 정.sessionContext,
      });
      추천.set(profile.id, r);
      const 알려진후보 = 후보.get(profile.id);
      // 서버가 담을 수 없는 후보를 추천에 실어 보내면 여기서 뺀다.
      // 실제로 품절(available:false)이 대안에 올라오는 걸 확인했다.
      const 담을수있나 = (id: string) => !알려진후보 || 알려진후보.has(id);
      const 고름 = r.recommendedCandidateId && 담을수있나(r.recommendedCandidateId)
        ? r.recommendedCandidateId : null;

      return {
        recommendedCandidateId: 고름,
        alternativeCandidateIds: (r.alternativeCandidateIds ?? []).filter(담을수있나),
        excludedCandidates: (r.excludedCandidates ?? []).map((e) => ({
          candidateId: e.candidateId,
          reasonCode: e.reasonCode ?? "EXCLUDED",
          explanation: 사유문장(e),
        })).filter((e) => e.explanation),
        recommendationReasons: r.recommendationReasons ?? [],
        confidence: r.confidence ?? 0,
        requiresReconfirmation: r.requiresReconfirmation ?? false,
        // 이름·가격은 candidate-filters 에서 온다. 추천 응답에는 없다.
        display: {},
        // 후보가 들고 있는 값과 사용자가 고른 값을 축별로 맞춰 본다.
        // 서버가 matchedOptions 를 주면 그때는 이걸 걷어내고 그대로 쓴다.
        matchedOptions: 고름 ? 확인표(알려진후보?.get(고름), profile) : [],
        // 후보를 고르는 화면에서도 어느 축이 어긋나는지 보여 준다.
        unmatchedLabelsByCandidate: Object.fromEntries(
          [고름, ...(r.alternativeCandidateIds ?? [])]
            .filter((id): id is string => id !== null && 담을수있나(id))
            .map((id) => [id, 확인표(알려진후보?.get(id), profile).filter((o) => !o.matched).map((o) => o.label)]),
        ),
      };
    },

    /**
     * POST /internal/orchestrator/approve
     *
     * 제출물 조립(실행계획 생성 포함)부터 제출·검증·실행까지 한 번에 한다.
     * submit-and-run 은 완성된 제출물을 요구하는데, 그 안의 executionPlan 은
     * 서버만 만들 수 있어서 프론트가 채울 방법이 없었다.
     *
     * P0-4 는 그대로다 — 이 호출은 승인 버튼 핸들러 안에서만 일어난다.
     */
    async submit(sessionId, submission) {
      const input = submission as ApproveInput & { candidateId?: string; profile?: OrderSheet };
      const profile = input.profile;
      if (!profile) throw new KioBridgeError("PROFILE_REQUIRED", "주문표를 찾을 수 없어요", false);
      const rec = 추천.get(profile.id);
      if (!rec) throw new KioBridgeError("MAPPING_REQUIRED", "메뉴를 먼저 찾아야 해요", false);

      // 매핑 때 받아 둔 정규화 결과를 그대로 쓴다. 여기서 다시 만들면
      // 확인 화면이 본 조건과 실제로 제출되는 조건이 갈라질 수 있다.
      const 키 = 마지막키.get(profile.id);
      const 정 = 키 ? 정규화됨.get(키) : undefined;
      if (!정) throw new KioBridgeError("MAPPING_REQUIRED", "메뉴를 먼저 찾아야 해요", false);
      const r = await 보내기<ApprovalResult>("/internal/orchestrator/approve", {
        sessionId,
        profile: 정.profile,
        sessionContext: 정.sessionContext,
        // 사용자가 다른 후보를 골랐으면 그것이 1순위다. 서버가 조립할 때 그 값을 쓴다.
        //
        // 1순위만 덮으면 그 후보가 대안에도 남아 두 필드가 겹친다.
        // 백엔드 RecommendationValidator 가 ALTERNATIVE_DUPLICATES_RECOMMENDED 로 막는다.
        // 고른 것을 대안에서 빼고, 원래 1순위를 대안으로 옮긴다.
        recommendation: 고른것반영(rec, input.candidateId),
        // note 는 선택 필드다. null 을 보내면 킷 스키마가 'must be string' 으로 막는다.
        userDecision: { approved: true, decision: "APPROVE", confirmedAt: new Date().toISOString() },
      });
      // #48 이후에는 { valid, summary, raw } 로 감싸여 온다. 둘 다 받는다.
      실행결과.set(sessionId, r.raw ?? (r as unknown as ExecuteResult));
      if (r.summary) 서버요약.set(sessionId, r.summary);
      /*
       * 빈 배열도 그대로 담는다. 담지 않고 넘기면 앞 응답의 문장이 남는다.
       *
       * 검증에 막히면 approve() 가 s.executed 를 되돌려서 같은 세션으로 다시
       * 승인할 수 있다. 그때 두 번째 응답이 빈 배열이면, 사용자는 이번에 막힌
       * 이유가 아니라 **아까 막혔던 이유**를 읽는다.
       *
       * 필드가 아예 없으면(#66 이전 백엔드) 지운다 - 그래야 아래에서 있고 없고로
       * 예전 경로를 쓸지 정할 수 있다. 길이로 정하면 빈 배열과 구분이 안 된다.
       */
      if (Array.isArray(r.validationMessages)) {
        검증문장.set(sessionId, r.validationMessages);
      } else {
        검증문장.delete(sessionId);
      }
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
      /*
       * 서버가 준 문장을 그대로 올린다. 없으면 화면이 기본 문구를 쓴다.
       *
       * #66 부터는 서버가 오류 코드를 사람 문장으로 옮겨 validationMessages 로
       * 준다. 그게 있으면 그것만 쓴다 — 예전 경로(validation.errors[].message)는
       * 킷이 개발자에게 하는 말이라("$.executionPlan[0].actionType must be ...")
       * 사용자 화면에 올릴 문장이 아니었다. 둘을 합치면 옮긴 문장 옆에
       * 원문이 그대로 붙어 버린다.
       *
       * #66 이전 백엔드에는 필드가 없으므로 그때는 예전 경로로 물러난다.
       *
       * 물러날지는 **길이가 아니라 있고 없고**로 정한다. 길이로 정하면 서버가
       * 준 빈 배열("이번엔 옮길 문장이 없다")과 필드 자체가 없는 것("이 서버는
       * 옮겨 주지 않는다")이 같아진다. 앞의 경우까지 개발자용 원문으로 물러난다.
       */
      const 원문 = (r.validation?.errors ?? []).map((e) => e.message);
      const errors = (검증문장.has(sessionId) ? 검증문장.get(sessionId)! : 원문).filter(보여도되나);
      return { valid: false, ...(errors.length > 0 ? { errors } : {}) };
    },

    async execute(sessionId) {
      const r = 실행결과.get(sessionId);
      if (!r) throw new KioBridgeError("PLAN_NOT_FOUND", "실행 정보를 찾을 수 없어요", false);
      // runId 는 이 실행 하나를 가리키는 값이다. 없으면 세션으로 대신한다.
      return { planId: r.evidence?.runId ?? sessionId };
    },

    /**
     * POST /internal/orchestrator/approve — approved: false 로 보낸다.
     *
     * 같은 경로다. 백엔드가 userDecision.approved 를 보고 빈 실행계획을 만들어
     * 제출·검증까지만 가고 실행은 건너뛴다(ExecutionPlanService).
     * 키오스크는 건드려지지 않는다.
     */
    async reject(sessionId, payload) {
      const input = payload as RejectInput & { profile?: OrderSheet };
      const profile = input.profile;
      if (!profile) return;
      const 키 = 마지막키.get(profile.id);
      const 정 = 키 ? 정규화됨.get(키) : undefined;
      const rec = 추천.get(profile.id);
      // 매핑을 안 거쳤으면 서버에 보낼 재료가 없다. 기록을 포기하고 넘어간다.
      if (!정 || !rec) return;
      await 보내기("/internal/orchestrator/approve", {
        sessionId,
        profile: 정.profile,
        sessionContext: 정.sessionContext,
        recommendation: rec,
        userDecision: {
          approved: false,
          decision: "REJECT",
          confirmedAt: new Date().toISOString(),
          ...(input.note ? { note: input.note } : {}),
        },
      });
    },

    // 증거는 submit-and-run 응답에 이미 실려 왔다. 따로 조회하지 않는다.
    // 예전에는 명세에만 있는 GET 경로를 불렀는데 백엔드에 그 경로가 없다.
    async getEvidence(sessionId) {
      const r = 실행결과.get(sessionId);
      const e = r?.evidence;
      if (!e) return { state: "running", reachedStep: 0 };

      // 킷의 stopType 은 NORMAL_BOUNDARY_STOP · SAFETY_STOP · NONE 이고
      // result 는 PASS · FAIL 이다.
      //
      // 안전 중단과 그냥 실패는 사용자에게 할 말이 다르다. 다만 실패를 계속
      // '진행 중' 으로 두면 화면이 90초를 기다리다 일반 오류로 끝난다.
      // 끝난 일은 끝났다고 말한다. 문구만 다르게 쓴다.
      const 안전중단 = e.stopType === "SAFETY_STOP";
      const state: EvidenceSummary["state"] =
        e.result === "PASS" ? "cart_ready" : e.result === "FAIL" ? "aborted" : "running";

      const 요약 = 서버요약.get(sessionId);
      return {
        state,
        // 몇 번째 화면까지 갔는지. 실행한 동작 수가 그대로 진행도다.
        reachedStep: e.executedActions?.length ?? 0,
        // 담긴 화면의 제목은 우리 문구다("장바구니에 담았어요"). status 를 여기에
        // 또 쓰면 같은 말이 두 번 나온다. 그래서 성공했을 때는 왜 이 메뉴였는지를
        // 말해 주는 recommendation 만 한 줄로 올린다.
        ...(state === "cart_ready" && 요약?.recommendation ? { note: 요약.recommendation } : {}),
        /*
         * 서버 문장을 그대로 싣되, 아는 문장만 싣는다.
         *
         * 화면은 이 값을 따옴표로 감싸 그대로 보여 준다. 서버가 언젠가 결제 완료
         * 같은 문장을 담아 보내면 그게 곧바로 화면에 뜬다 — 결제 표현은 있기만 해도
         * 실격이라, 서버를 믿고 통과시킬 수 있는 값이 아니다.
         *
         * 앱말투 표에 있는 넷만 인용한다. 모르는 문장은 아예 안 보여 준다 —
         * 그 경우 화면은 원래 우리 문구로 말한다. 서버가 문구를 바꾸면 이 줄이
         * 조용히 사라지는데, 잘못된 말을 띄우는 것보다 안 띄우는 편이 낫다.
         */
        ...(요약?.status && 앱말투[요약.status] ? { serverStatus: 요약.status } : {}),
        ...(state === "cart_ready" ? { cart: 장바구니(e.reviewSnapshot) } : {}),
        ...(state === "aborted"
          ? {
              abort: {
                code: e.stopType ?? "UNKNOWN",
                // 서버가 분류한 결과를 제목으로 쓴다. stopType 만 보면 서버가
                // '실행할 수 없습니다' 로 판단한 경우를 구분하지 못한다.
                title: 앱말투[요약?.status ?? ""]
                  ?? (안전중단 ? "안전을 위해 멈췄어요" : "끝까지 담지 못했어요"),
                // 서버가 이유를 주면 그대로 쓴다. 지어내지 않는다.
                message: e.stopReason ?? 서버요약.get(sessionId)?.stopReason ?? (안전중단
                  ? "예상하지 못한 화면이 감지되어 작동을 멈췄어요."
                  : "키오스크가 예상과 다르게 움직여서 멈췄어요."),
                // 안전 중단은 기계가 중간 상태일 수 있어 직원 초기화가 필요하다.
                // 그냥 실패는 화면을 확인하는 것부터 하면 된다.
                userAction: 안전중단 ? "직원 초기화를 기다려 주세요" : "키오스크 화면을 확인하고, 어려우면 직원에게 도움을 청해 주세요",
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
