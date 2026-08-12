import type {
  ApproveInput, CartResult, MappedOption, RejectInput, MappingResponse, PairingResult, PlanCreated, PlanStatus, OrderSheet, StepStatus,
} from "@/domain/types";
import {
  toChickenStoreContext, toContextNormalizationInput, toProfileNormalizationInput, 우리말들,
  type ContextNormalizationInput, type ProfileNormalizationInput,
  type CanonicalProfile, type ChickenStoreSessionContext,
} from "@/api/canonical";
import { KioBridgeError, clearSheets, type KioBridgeApi } from "@/api/client";
import { STEPS } from "@/domain/catalog";
import { 연동기록, 팀백엔드모드 } from "@/api/devlog";
import { 접근성설정 } from "@/api/a11y";
import { 돈 } from "@/i18n/apply";
import { 가격한도 } from "@/api/budget";
import { 개인정보동의 } from "@/api/consent";
import { 알레르기설정 } from "@/api/allergy";

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
  /**
   * 서버가 맞추지 못한 조건.
   *
   * 제외 사유(excludedCandidates)와 다르다. 저건 "이 메뉴를 뺐다" 이고 이건
   * "당신이 고른 조건 중 이건 못 맞췄다" 다. 담기는 담는데 한 축이 어긋난
   * 경우가 여기 온다 - "선호하신 뼈/순살과 다릅니다".
   */
  unmetConditions: string[];
  confidence: number;
  requiresReconfirmation: boolean;
  /** 후보 표시 정보. 상품 ID 가 아니라 사람이 읽는 값이어야 한다. */
  display: Record<string, { displayName: string; priceText: string; imageUrl?: string }>;
  /** 사용자가 고른 조건이 반영됐는지 항목별로. 1순위 추천 기준이다. */
  matchedOptions: { label: string; value: string; matched: boolean; note?: string }[];
  /**
   * 후보별로 어긋나는 축의 이름. 예: { "candidate-beta": ["형태"] }
   *
   * matchedOptions 는 1순위 하나에 대한 답이라, 대안 후보를 고른 사용자에게는
   * 쓸 수 없다. 그걸 그대로 쓰면 '매운 뼈' 를 고른 사람에게
   * "형태: 순살, 그대로예요" 라고 말하게 된다.
   *
   * 없으면 화면이 후보별 불일치를 표시하지 않는다. 짐작하지 않는다.
   */
  unmatchedLabelsByCandidate?: Record<string, string[]>;
  /**
   * 서버가 점수를 매길 때 이 후보를 **밀어 준** 축들. 숫자는 안 싣는다.
   *
   * scoreBreakdown 을 그대로 띄우지 않고 양수인 칸의 이름만 남긴 것이다.
   * 이유 문장(recommendationReasons)이 빠뜨리는 것이 여기 남는다 — 가격 한도를
   * 정해도 서버의 이유 문장에는 가격 얘기가 한 줄도 안 나온다(실측).
   */
  scoredAxes: string[];
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
  /**
   * 키오스크가 실제로 한 일을 순서대로 (#71 의 runSteps).
   *
   * 위의 reachedStep 은 '몇 번째까지 갔나' 뿐이라 무엇을 했는지는 모른다.
   * 서버가 안 주면 없다 — 화면이 지어내지 않는다.
   */
  한일?: { text: string; ok: boolean }[];
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
      /*
       * 세 종류를 한 목록에 담는다. 화면이 제목을 붙여 나눠 보여 준다.
       *
       *   used      이 조건을 써서 골랐다
       *   unmet     이 조건은 못 맞췄다        <- 담기는 담는데 한 축이 어긋남
       *   excluded  이 조건 때문에 메뉴를 뺐다
       *
       * unmet 을 버리고 있었다. 서버가 "선호하신 뼈/순살과 다릅니다" 라고 알려
       * 주는데 타입에 선언만 해 두고 화면까지 오지 않았다. 못 맞춘 것을 감추면
       * 사용자는 자기가 고른 조건이 다 반영된 줄 알고 승인한다.
       */
      /*
       * 세 종류를 한 목록에 담는다. 화면이 제목을 붙여 나눠 보여 준다.
       *
       *   used      이 조건을 써서 골랐다
       *   unmet     이 조건은 못 맞췄다        <- 담기는 담는데 한 축이 어긋남
       *   excluded  이 조건 때문에 메뉴를 뺐다
       *
       * unmet 을 버리고 있었다. 서버가 "선호하신 뼈/순살과 다릅니다" 라고 알려
       * 주는데 타입에 선언만 해 두고 화면까지 오지 않았다. 못 맞춘 것을 감추면
       * 사용자는 자기가 고른 조건이 다 반영된 줄 알고 승인한다.
       *
       * 셋 다 서버가 준 문장이라 결제 표현 거르기를 여기서 한 번에 건다.
       * 실서버 경로에만 걸면 목에서는 안 걸리는데, 화면으로 나가는 길은 여기
       * 하나다. 막는 자리는 나가는 자리여야 한다.
       */
      /*
       * 서버 문장에 **무엇에 대한 얘기인지**를 붙인다.
       *
       * 서버는 "지금은 품절이라 제외됐어요" 라고만 한다. 어느 메뉴가 품절인지는
       * 말해 주지 않는다. 후보가 여럿일 때 사용자는 무엇이 빠졌는지 알 수 없고,
       * 화면은 이유를 보여 주면서 정작 대상을 감추는 셈이 된다.
       *
       * 추천 쪽도 같다. "선호하신 맵기와 맞는 메뉴라" 는 어느 맵기를 말하는지
       * 안 밝힌다. 자기가 고른 값이 무엇이었는지는 사용자가 기억해야 했다.
       *
       * **서버 문장은 그대로 둔다.** 앞뒤에 우리가 아는 사실만 덧댄다 — 문장을
       * 고쳐 쓰면 그건 인용이 아니라 우리가 지어낸 말이 된다.
       */
      const 이름붙이기 = (id: string, 글: string): string => {
        const 이름 = rec.display[id]?.displayName;
        return 이름 ? `${이름} — ${글}` : 글;
      };
      /*
       * 서버가 축을 부르는 말 → 우리 주문표의 축.
       *
       * 대부분 같은 말인데 형태만 다르다. 서버는 "뼈/순살" 이라 부르고 우리
       * 주문표의 축 이름은 "형태" 다.
       */
      const 서버가부르는축: [string, string][] = [
        ["이용 방식", "이용 방식"], ["맵기", "맵기"], ["뼈/순살", "형태"], ["컵", "컵"], ["수량", "수량"],
      ];
      const 고른값붙이기 = (글: string): string => {
        for (const [서버말, 축] of 서버가부르는축) {
          if (!글.includes(서버말)) continue;
          const 값 = profile?.selections?.[축]?.[0];
          if (값) return `${글} (고르신 값: ${값})`;
        }
        return 글;
      };
      const reasons: MappingResponse["reasons"] = [
        ...rec.recommendationReasons.map((text) => ({
          kind: "used" as const,
          text: 고른값붙이기(rec.recommendedCandidateId ? 이름붙이기(rec.recommendedCandidateId, text) : text),
        })),
        ...rec.unmetConditions.map((text) => ({ kind: "unmet" as const, text: 고른값붙이기(text) })),
        ...제외.map((e) => ({ kind: "excluded" as const, text: 이름붙이기(e.candidateId, e.explanation) })),
      ].filter((r) => 보여도되나(r.text));
      /*
       * 서버가 점수를 매길 때 본 축들. 담을 것이 정해진 뒤에만 뜻이 있어서
       * not_found 에는 싣지 않는다 — 고른 메뉴가 없는데 "이걸 보고 골랐어요" 는
       * 말이 안 된다.
       */
      const 점수본것 = rec.scoredAxes.length > 0 ? { scoredAxes: rec.scoredAxes } : {};

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
          result, reasons, ...점수본것,
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
        result, reasons, ...점수본것,
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
      /*
       * reachedStep 은 '실행한 동작 수' 이고 STEPS 는 다섯 칸이다. 단위가 다르다.
       *
       * 백엔드가 만드는 동작은 9~10개다(select_service · select_menu ·
       * select_option x4 · confirm_option x2 · open_cart_review · verify_cart).
       * 그래서 중단됐을 때 reachedStep 이 거의 항상 5 이상이 되고, 다섯 칸이
       * 전부 i < reachedStep 에 걸려 **모두 '완료'** 로 칠해졌다.
       *
       * 화면 위쪽은 "안전을 위해 멈췄어요" 인데 아래 단계는 다 끝난 것처럼
       * 보인다. 같은 화면이 정반대 말을 한다.
       *
       * 마지막 칸을 넘지 않게 자른다. 실패 칸이 적어도 제자리 근처에는 찍힌다.
       * 정확한 자리는 서버가 준 실행 내역(한일)이 아래에서 그대로 보여 준다 -
       * 개수가 맞는 것은 그쪽이라 그 자리에 맡긴다.
       */
      const 멈춘칸 = Math.min(e.reachedStep, STEPS.length - 1);
      const steps: StepStatus[] =
        e.state === "aborted"
          ? STEPS.map((_, i) => (i < 멈춘칸 ? "done" : i === 멈춘칸 ? "failed" : "waiting"))
          : e.state === "cart_ready"
            ? STEPS.map(() => "done")
            : STEPS.map((_, i) => (i < e.reachedStep ? "done" : i === e.reachedStep ? "active" : "waiting"));

      // 어디서 멈췄든 무엇까지 했는지는 알려 준다. 중단됐을 때가 오히려
      // 더 알고 싶은 자리다 — 어디까지 갔는지 눈으로 봐야 다음을 정한다.
      const 한일 = e.한일 ? { done: e.한일 } : {};

      if (e.state === "aborted") {
        return {
          state: "aborted", steps, ...한일,
          abort: { ...(e.abort ?? { code: "UNKNOWN", title: "안전을 위해 중단되었습니다", message: "예상하지 못한 화면이 감지되어 작동을 멈췄어요.", userAction: "직원 초기화를 기다려 주세요" }), recoverable: false },
          // 중단됐을 때야말로 "이게 키오스크가 한 말이다" 를 보여 줄 자리다.
          // 잘 된 경우에만 싣고 여기서 빠뜨리면, 정작 확인이 필요한 쪽이 비어 있다.
          ...(e.serverStatus ? { serverStatus: e.serverStatus } : {}),
        };
      }
      if (e.state === "cart_ready") {
        return {
          state: "cart_ready", steps, cart: e.cart, ...한일,
          ...(e.note ? { note: e.note } : {}),
          ...(e.serverStatus ? { serverStatus: e.serverStatus } : {}),
        };
      }
      return { state: "running", steps, ...한일 };
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
  /**
   * 키오스크에서 실제로 한 동작을 순서대로 (#71).
   *
   * 지금까지 화면은 우리가 정해 둔 다섯 단계를 '실행한 동작 수' 로 채웠다.
   * 개수만 보고 그린 것이라 몇 번째까지 갔는지만 맞고 무엇을 했는지는 몰랐다.
   * 이건 서버가 실제로 한 일이다.
   */
  runSteps?: RunStep[];
  raw?: ExecuteResult;
}

/** ApprovalResult.runSteps 의 한 칸. 킷의 ExecutedAction 을 추린 것이다. */
interface RunStep {
  actionIndex: number;
  /** select_option, confirm_option, open_cart_review ... */
  action: string;
  /**
   * 킷의 resolvedLabel. 고른 값이면 사람 말이고("종이컵"),
   * 화면 이동이면 코드다("CART_REVIEW"). 아래 한일한줄 참고.
   */
  label: string;
  success: boolean;
}

/*
 * 한 동작을 사람이 읽는 한 줄로 옮긴다.
 *
 * label 을 그대로 쓸 수 없다. 규칙이 이렇게 갈린다.
 *
 *   select_service   포장하기            <- 고른 값이라 사람 말
 *   select_menu      매운 뼈 닭강정
 *   select_option    매운맛 · 뼈 · 종이컵 · 1개
 *   confirm_option   OPTION_CONFIRM      <- 화면 이름이라 코드
 *   open_cart_review CART_REVIEW
 *   verify_cart      CART_REVIEW
 *
 * 그래서 문장은 action 에서 만들고, label 은 사람 말일 때만 끼워 넣는다.
 * 모르는 action 에 코드 label 만 있으면 무슨 일이 있었는지 지어내지 않는다.
 */
/*
 * 고른 값을 담아 오는 동작들.
 *
 * 이 셋에서는 label 이 사용자가 실제로 고른 값이다. 대문자든 한글이든 그대로
 * 보여 준다 - 모양으로 코드인지 아닌지 가리면 안 된다.
 *
 * 처음에는 모든 동작에 /^[A-Z][A-Z0-9_]*$/ 를 걸어 대문자면 코드로 봤다.
 * 그러면 `ICE`·`HOT`·`Q1` 같은 **진짜 고른 값**이 코드로 몰려 "하나 골랐어요"
 * 로 뭉개진다. 카페 주문표에는 이미 ICE 가 들어 있다.
 *
 * 사용자가 고른 것을 화면에서 지우는 셈이라, 대신 눌러 주는 앱에서 가장 하면
 * 안 되는 쪽이다. 판별은 아래 아는화면 처럼 **자리를 아는 곳에서만** 한다.
 */
const 고른값을담는동작 = new Set(["select_service", "select_menu", "select_option"]);

/*
 * 서버가 준 label 을 화면에 올려도 되는지.
 *
 * label 은 검증되지 않은 서버 입력이다. 여기를 그대로 통과시키면 서버가 무엇을
 * 담아 보내든 결과 화면에 뜬다 - 상품 ID(candidate-alpha) · 화면 좌표 · 결제 문구
 * 전부. 우리 실격 요건 둘을 정면으로 건드린다.
 *
 * 그런데 우리는 **사용자가 무엇을 골랐는지 이미 안다.** 주문표의 선택값과
 * 화면에 띄우고 있는 후보 이름이 그것이다. 그 목록에 있는 값만 통과시킨다.
 *
 * 흰 목록이라 새는 길이 없다. 모르는 값이면 값을 지우고 동작만 말한다 -
 * 무엇을 골랐는지 한 줄 잃지만, 지어낸 값이나 새면 안 되는 값을 띄우는 것보다 낫다.
 *
 * 앞서 ICE 를 살리려고 모양 검사를 없앴는데, 그때 '고른 값 자리는 안전하다' 고
 * 전제했다. 그 전제에 근거가 없었다. 모양이 아니라 **아는 값인지**로 가른다.
 */
const 아는값인가 = (label: string, 아는값: Set<string>): boolean =>
  아는값.has(label) && 보여도되나(label);

/*
 * 주문표에 고른 값과 **이번에 담기로 한 메뉴 하나**의 이름.
 *
 * 후보 전체를 넣으면 안 된다. 대안 후보 이름까지 흰 목록에 들어가서, 서버가
 * 사용자가 고르지 않은 후보 이름을 보내도 "OO 골랐어요" 로 뜬다. 고른 적 없는
 * 메뉴를 골랐다고 말하는 셈이라, 대신 눌러 주는 앱에서 가장 나쁜 거짓말이다.
 *
 * 찾지 못하면 이름을 아예 넣지 않는다. 그때는 "하나 골랐어요" 로 물러난다.
 */
const 아는값모으기 = (
  profile: OrderSheet | undefined,
  고른후보: KitCandidate | undefined,
): Set<string> => {
  const s = new Set<string>();
  for (const 값들 of Object.values(profile?.selections ?? {})) {
    for (const v of 값들) if (v) s.add(v);
  }
  if (고른후보?.name) s.add(고른후보.name);
  return s;
};

/*
 * 아는 화면 코드만 갈라 준다.
 *
 * confirm_option 이 두 번 온다 — 옵션을 확정할 때와 메뉴를 장바구니로 넘길 때다.
 * action 만 보면 같은 문장이 두 줄 나란히 서서 앱이 헛돈 것처럼 읽힌다.
 * 킷은 label 로 둘을 구분하고 있으니 그것만 받아 쓴다.
 *
 * 모르는 코드는 여기 없다. 그때는 아래 action 문장으로 물러난다 — 코드 이름을
 * 보고 무슨 화면인지 짐작해서 지어내지 않는다.
 */
const 아는화면: Record<string, string> = {
  OPTION_CONFIRM: "옵션을 확정했어요",
  MENU_SELECTION_WITH_CART: "메뉴를 장바구니로 넘겼어요",
};
const 동작말 = (action: string, label: string, 아는값: Set<string>): string => {
  // 고른 값 자리라도 우리가 아는 값일 때만 그대로 쓴다. ICE 는 주문표에 있으니
  // "ICE 골랐어요" 가 되고, candidate-alpha 은 없으니 "하나 골랐어요" 가 된다.
  if (고른값을담는동작.has(action)) {
    return 아는값인가(label, 아는값) ? `${label} 골랐어요` : "하나 골랐어요";
  }
  if (아는화면[label]) return 아는화면[label];
  switch (action) {
    case "confirm_option":
      return "고른 것을 확정했어요";
    case "open_cart_review":
      return "장바구니를 열었어요";
    case "verify_cart":
      return "장바구니를 확인했어요";
    default:
      // 모르는 동작이다. 아는 값이 아니면 무슨 일이 있었는지 지어내지 않는다.
      return 아는값인가(label, 아는값) ? label : "한 단계 진행했어요";
  }
};
const 한일만들기 = (
  단계: RunStep[] | undefined,
  아는값: Set<string>,
): { text: string; ok: boolean }[] | undefined => {
  if (!단계 || 단계.length === 0) return undefined;
  return [...단계]
    .sort((a, b) => a.actionIndex - b.actionIndex)
    .map((s) => ({ text: 동작말(s.action, (s.label ?? "").trim(), 아는값), ok: s.success }));
};

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
/** 규칙 하나에 대한 서버 판정. 후보별로 묶여서 온다. */
interface 규칙판정 {
  ruleId?: string;
  result?: "PASS" | "FAIL" | "RECONFIRM" | "SKIPPED";
  /**
   * BLOCK · WARN. 서버가 이 규칙을 얼마나 세게 보는지.
   *
   * warningsByCandidateId 에는 WARN 만 담기게 돼 있다(CandidateFilterResult 문서).
   * 그래도 읽는다 — 여기에 BLOCK 이 섞여 오면 서버가 '담으면 안 된다' 고 한 후보를
   * 우리가 "조금 다른 메뉴" 로 내미는 것이 된다. 그럴 땐 후보에서 뺀다.
   */
  severity?: string;
  errorCode?: string;
  /** 서버가 비교에 쓴 우리 쪽 값. enum 이다("MILD"). */
  sourceValue?: unknown;
  /** 후보 쪽 값. 여럿일 수 있어 배열로 온다(["HOT"] · ["DINE_IN","TAKE_OUT"]). */
  candidateValue?: unknown;
}

interface CandidateFilterResponse {
  eligibleCandidates?: KitCandidate[];
  excludedCandidates?: KitExcluded[];
  /*
   * 후보별 규칙 판정. 서버가 이미 계산해서 보내 준다.
   *
   * 예전에는 이 셋을 버리고 확인표() 에서 attributes.supportedOptions 로 같은
   * 판단을 다시 했다. 같은 판단을 두 곳에서 하면 언젠가 갈라진다.
   *
   * 그리고 다시 하는 쪽이 알 수 없는 것이 있다 - **WARN 이 없다는 사실만으로는
   * "일치한다" 를 뜻하지 않는다.** 값이 없거나, NO_PREFERENCE 같은 중립값이거나,
   * unknownPolicy 가 IGNORE 거나, 후보가 그 항목을 아예 선언 안 했으면 SKIPPED 라
   * 경고에 아무것도 안 남지만 실제로는 "비교한 적이 없다" 일 뿐이다.
   * passes 를 함께 봐야 '맞음' 과 '비교 안 함' 이 갈린다.
   */
  warningsByCandidateId?: Record<string, 규칙판정[]>;
  /*
   * 재확인이 필요한 판정. **이 흐름에서는 여기까지 오지 않는다.**
   *
   * 서버에 직접 쏴 보면 이건 allergenIds 에 UNKNOWN 이 섞였을 때만 채워진다
   * (CHICKEN_ALLERGEN_HARD_CONSTRAINT). 그런데 그 경우는 그보다 앞인 정규화에서
   * 이미 막힌다 — session-context-normalizations 가 status: RECONFIRMATION_REQUIRED
   * 를 돌려주고, 정규화() 가 거기서 RECONFIRM_REQUIRED 를 던진다. filterCandidates
   * 는 정규화() 를 먼저 부르므로 후보 필터까지 도달하지 못한다.
   *
   * 그래도 서버판정있음 검사에는 넣는다. 안 넣으면 이것만 실려 오는 응답에서
   * 우리가 다시 맞춰 보는 쪽으로 물러나고, 서버가 "비교하지 못했다" 고 한 축을
   * 맞다고 말하게 된다.
   *
   * 안 읽는 이유를 적어 두는 까닭 — 선언만 보고 "안 쓰네" 하면 닿지도 않는 길을
   * 화면에 이으려다 아무도 지나가지 않는 코드를 만들게 된다. (팀 #94 리뷰)
   */
  reconfirmationsByCandidateId?: Record<string, 규칙판정[]>;
  passesByCandidateId?: Record<string, 규칙판정[]>;
}

/*
 * 규칙 이름을 화면의 축 이름으로 옮긴다.
 *
 * errorCode 로 잇는다 - ruleId 는 환경마다 접두어가 붙지만(CHICKEN_...) errorCode 는
 * 무엇이 어긋났는지를 가리키는 이름이라 더 안정적이다. 모르는 코드는 넘긴다.
 */
/**
 * 점수 칸 이름을 화면의 축 이름으로. 모르는 칸은 넘긴다.
 *
 * 서버가 칸을 늘리면 여기 없는 이름이 들어오는데, 그때 원문("boneTypeMatch")을
 * 띄우느니 조용히 빠지는 편이 낫다.
 */
const 점수축: Record<string, string> = {
  serviceTypeMatch: "이용 방식",
  spicyLevelMatch: "맵기",
  priceScore: "가격",
};

/**
 * 표에서 축 이름을 찾는다. 우리가 적어 둔 칸일 때만 돌려준다.
 *
 * 객체 리터럴은 Object.prototype 을 물려받아서, 키가 "constructor" 면 생성자
 * 함수가 나오고 그게 truthy 라 아래 Boolean 검사를 그냥 통과한다. 그러면
 * label 자리에 함수가 들어간다. 키는 서버 응답에서 오므로 우리가 정하는 값이
 * 아니다 — session.ts 의 대신갈곳 과 같은 이유로 막는다.
 */
const 축찾기 = (표: Record<string, string>, 키: string | undefined): string | undefined =>
  키 !== undefined && Object.hasOwn(표, 키) ? 표[키] : undefined;

/** 이 후보를 밀어 준 축들. 양수인 칸만 고른다 — 깎인 축은 다른 자리가 말한다. */
const 도움된축 = (점수: Record<string, number> | undefined): string[] =>
  Object.entries(점수 ?? {})
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([k]) => 축찾기(점수축, k))
    .filter((x): x is string => Boolean(x));

const 규칙축: Record<string, string> = {
  SERVICE_TYPE_MISMATCH: "이용 방식",
  SPICY_LEVEL_MISMATCH: "맵기",
  BONE_TYPE_MISMATCH: "형태",
  CUP_OPTION_MISMATCH: "컵",
};

/** 사람이 읽을 문장만 고른다. 없으면 비운다 — 규칙 추적 문자열을 보여 주지 않는다. */
const 사유문장 = (e: KitExcluded): string => e.reasonText ?? "";

/** POST /api/v1/recommendations 응답 (Recommendation). */
interface RecommendationResponse {
  recommendedCandidateId: string | null;
  alternativeCandidateIds?: string[];
  /*
   * candidate-filters 와 같은 모양이다. 예전에는 여기만 reasonText 없이 적어 두었는데,
   * 사유문장() 은 reasonText 를 읽는다 — 구조적 타이핑 덕에 우연히 통하고 있었다.
   * 서버는 여기서도 reasonText 를 보낸다(실측).
   */
  excludedCandidates?: KitExcluded[];
  recommendationReasons?: string[];
  unmetConditions?: string[];
  /**
   * 축별 점수. 서버가 무엇을 보고 이 후보를 1순위로 골랐는지 남긴 것이다.
   *
   * 칸은 셋뿐이고(RecommendationEngineService.buildScoreBreakdown) **음수가 나올 수 있다.**
   *
   *   serviceTypeMatch  일치 보너스 · 불일치 벌점
   *   spicyLevelMatch   위와 같음. 한 칸 차이면 벌점이 작다
   *   priceScore        가격 한도 대비 남는 비율. 한도를 안 정하면 늘 0
   *
   * 숫자는 화면에 안 띄운다. 이 앱을 쓰는 분들에게 0.0259 는 읽을 수 없는 값이
   * 하나 더 느는 것이다. 대신 **양수인 축의 이름만** 뽑아서 "이걸 보고 골랐어요"
   * 로 옮긴다(아래 점수축). 깎인 축은 여기서 말하지 않는다 — 그건 이미
   * unmetConditions 와 어긋난 줄이 자기 말로 하고 있다.
   */
  scoreBreakdown?: Record<string, number>;
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

/*
 * 값 표기. 우리가 만드는 글자라 화면 언어를 따라간다("6,000원" vs "KRW 6,000").
 *
 * 통화는 원 그대로다 — 이 앱은 한국 키오스크 앞에서 쓰는 것이고, 환산해서 적으면
 * 화면의 값과 키오스크 화면의 값이 달라진다.
 */
const 원 = (n: number | undefined) =>
  typeof n === "number" ? 돈(n, 접근성설정.읽기().language === "en-US") : "";

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
  // OrchestratorController 가 증거를 못 읽었을 때 내는 문장. 표에 없으면
  // 조용히 안 보여 주게 되는데, 그 경우야말로 서버 말을 인용할 자리다.
  "결과를 처리하는 중 문제가 발생했습니다.": "끝까지 담지 못했어요",
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
  /*
   * 승인 응답에 실려 온 실행 단계(#71).
   *
   * **원문을 담지 않는다.** 화면에 올릴 문장으로 바꾼 뒤에 담는다. 원문에는
   * 서버가 무엇을 넣었을지 모르는 label 이 들어 있고, 그걸 메모리에 두면
   * 화면에 안 띄워도 '앱이 상품 ID 를 들고 있는' 상태가 된다.
   */
  const 실행단계 = new Map<string, { text: string; ok: boolean }[]>();
  // 후보 필터가 준 후보들. 이름·가격과 축별 값이 여기 있다.
  const 후보 = new Map<string, Map<string, KitCandidate>>();
  /*
   * candidate-filters 가 준 후보별 규칙 판정. 주문표 id 로 묶어 둔다.
   *
   * 여기 있으면 확인표() 대신 이것을 쓴다. 서버가 이미 내린 판단이라
   * 우리가 다시 계산할 이유가 없고, 다시 하면 언젠가 갈라진다.
   */
  const 규칙판정들 = new Map<string, {
    /*
     * 응답에 판정 필드가 **있었는가**. 후보별 배열이 있었는가와 다르다.
     *
     * 이 둘을 구분하지 않으면, 서버가 판정을 보냈는데 그 후보에 대한 항목만
     * 없는 경우(전부 SKIPPED)에 우리가 다시 계산하는 쪽으로 물러난다. 그러면
     * 서버가 '비교한 적 없다' 고 한 축을 우리가 맞다.틀리다로 말하게 된다 -
     * 이 변경이 없애려던 바로 그 문제다.
     *
     * 필드 자체가 없을 때(옛 백엔드)만 물러난다.
     */
    서버판정있음: boolean;
    warn: Record<string, 규칙판정[]>;
    pass: Record<string, 규칙판정[]>;
  }>();

  /*
   * 축별 일치 여부를 만든다.
   *
   * 서버가 후보별 규칙 판정을 줬으면 그것을 쓴다. FAIL 이면 어긋난 것,
   * PASS 면 맞은 것이다. 둘 중 어느 쪽에도 없으면 **아무 말도 하지 않는다** -
   * SKIPPED 라는 뜻이고, 그건 '맞았다' 가 아니라 '비교한 적이 없다' 이다.
   *
   * 판정이 아예 안 오면(옛 백엔드) 예전처럼 우리가 맞춰 본다.
   */
  const 축맞춤 = (profileId: string, candidateId: string, c: KitCandidate | undefined, p: OrderSheet): MappedOption[] => {
    const 판정 = 규칙판정들.get(profileId);
    // 필드 자체가 없을 때만 우리가 맞춰 본다. 후보별 항목이 없는 것은
    // '이 후보는 비교한 축이 하나도 없다' 는 뜻이라 빈 것이 맞는 답이다.
    if (!판정?.서버판정있음) return 확인표(c, p);
    const warn = 판정.warn[candidateId];
    const pass = 판정.pass[candidateId];

    const 고른값 = p.selections ?? {};
    /**
     * @param 이메뉴는 후보가 가진 값을 우리말로 옮긴 것. 없으면 빈 문자열이다.
     *
     * 어긋난 줄에 무엇이 어긋났는지를 적는다. 예전에는 어느 축이든
     * "오늘은 이 조합이 없어요" 한 문장이었다 — 무엇으로 바뀌는지는 말해 주지 않아서,
     * 사용자가 이걸 담아도 되는지 판단할 근거가 없었다. 서버가 비교한 값을
     * 실어 보내 주고 있었는데(candidateValue) 우리가 안 읽고 있었다.
     */
    const 한줄 = (축: string, matched: boolean, 이메뉴는 = ""): MappedOption | null => {
      const 값 = 고른값[축]?.[0];
      if (!값) return null;   // 사용자가 안 고른 축은 보여 줄 것이 없다
      if (matched) return { label: 축, value: 값, matched: true };
      return {
        label: 축, value: 값, matched: false,
        // 옮기지 못한 값(모르는 enum)이면 예전 문장으로 돌아간다. 원문을 띄우지 않는다.
        note: 이메뉴는 ? `이 메뉴는 ${이메뉴는}이에요` : "오늘은 이 조합이 없어요",
      };
    };

    const 행: MappedOption[] = [];
    const 본축 = new Set<string>();
    for (const r of warn ?? []) {
      const 축 = 축찾기(규칙축, r.errorCode);
      if (!축 || 본축.has(축)) continue;
      본축.add(축);
      const x = 한줄(축, false, 우리말들(r.candidateValue));
      if (x) 행.push(x);
    }
    for (const r of pass ?? []) {
      const 축 = 축찾기(규칙축, r.errorCode)
        ?? 축찾기(규칙축, (r.ruleId ?? "").replace(/^CHICKEN_/, "").replace(/_PREFERENCE$/, "_MISMATCH"));
      if (!축 || 본축.has(축)) continue;
      본축.add(축);
      const x = 한줄(축, true);
      if (x) 행.push(x);
    }
    return 행;
  };

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

  /**
   * @param contextInput 이미 만들어 둔 것을 받는다. **여기서 다시 만들지 않는다.**
   *
   * 예전에는 이 안에서 한 번, 요청을 보낼 때 또 한 번 만들었다. 그 사이에
   * `await` 이 하나 있어서, 그동안 사용자가 알레르기나 가격 한도를 바꾸면
   * **키와 실제 보낸 값이 서로 다른 조건을 가리켰다.**
   *
   * 알레르기가 빠진 맥락이 '알레르기가 있는' 키에 저장되고, 다음에 같은 키로
   * 찾으면 그 맥락이 그대로 쓰인다 — 걸러졌어야 할 후보가 안 걸러진다.
   * 알레르기는 빠뜨려도 되는 값이 아니다.
   */
  const 캐시키 = (
    environmentId: string,
    p: OrderSheet,
    profileInput: ProfileNormalizationInput,
    contextInput: ContextNormalizationInput["contextInput"],
  ) => {
    // collectedAt 은 부를 때마다 달라진다(현재 시각). 키에 넣으면 캐시가 한 번도
    // 안 맞는다. 결과를 바꾸는 건 고른 조건과 접근성 설정이라 그것만 넣는다.
    // 접근성 설정이 바뀌면 표준형도 달라진다. 키에 그대로 들어가므로 캐시가 자동으로 갈린다.
    const { collectedAt: _버림, ...주문표 } = profileInput;
    // 가격 한도.알레르기가 바뀌면 후보 자체가 달라진다. 키에 들어가므로 고치면
    // 캐시가 자동으로 갈라진다 — 접근성 설정과 같은 방식이다.
    const 키 = `${environmentId}|${JSON.stringify(주문표)}|${JSON.stringify(contextInput)}`;
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
    /*
     * 정규화에 넣을 값을 여기서 **한 번만** 만든다. 아래 요청과 위 캐시키가 같은
     * 객체를 봐야 한다 — 두 번 만들면 그 사이의 설정 변경이 둘을 갈라놓는다.
     *
     * 프로필 쪽도 같은 규칙이다. 지금은 두 자리 사이에 await 이 없어서 갈라질
     * 일이 없지만, 나중에 하나라도 끼면 캐시키와 보내는 값이 어긋난다(#96 리뷰).
     */
    const 프로필입력 = toProfileNormalizationInput(p, {
      접근성: 접근성설정.읽기(),
      personalization: 개인정보동의.읽기(),
    });
    const 정규화입력 = toContextNormalizationInput(p, {
      예산: 가격한도.읽기(),
      알레르기: 알레르기설정.읽기(),
    });
    const 키 = 캐시키(environmentId, p, 프로필입력, 정규화입력.contextInput);
    const 있음 = 정규화됨.get(키);
    if (있음) return 있음;

    const pr = await 보내기<{
      status: string; profile: CanonicalProfile;
      contractValidation?: { valid: boolean; errors?: { message?: string }[] };
    }>("/api/v1/profile-normalizations", {
      environmentId,
      // 큰 글씨를 켜 놓고 주문해도 서버가 몰랐다 — opts 를 안 넘겨서 일곱이 전부
      // false 로 나가고 있었다. 화면이 묻는 값을 그대로 보낸다.
      profileInput: 프로필입력,
    });

    const sr = await 보내기<{
      status: string; sessionContext: ChickenStoreSessionContext;
      /*
       * 재확인이 필요한 칸들. 실측한 모양:
       *   { path: "/sessionContext/hardConstraints/allergenIds",
       *     reasonCode: "HARD_CONSTRAINT_UNKNOWN",
       *     message: "allergenIds 가 UNKNOWN 입니다. ..." }
       *
       * 화면은 message 만 쓴다. path 와 reasonCode 는 어느 칸인지를 가리키는데,
       * 지금 이 분기에 닿는 상황이 알레르기 하나뿐이라 둘로 갈라 말할 것이 없다.
       * 칸이 늘면 그때 path 로 짚는다 — 그러려면 선언이 먼저 있어야 한다.
       */
      reconfirmationFields?: { path?: string; reasonCode?: string; message?: string }[];
      contractValidation?: { valid: boolean; errors?: { message?: string }[] };
    }>("/api/v1/session-context-normalizations", { environmentId, ...정규화입력 });

    /*
     * 재확인을 먼저 가른다. 순서가 뒤집혀 있어서 이 분기가 죽어 있었다.
     *
     * 백엔드는 reconfirmationFields 가 비지 않을 때만 RECONFIRMATION_REQUIRED 를
     * 낸다. 그 필드는 contractValidation.errors 에서 HARD_CONSTRAINT_UNKNOWN 등을
     * 골라 만든 것이고, 킷은 그것을 **warning 이 아니라 error** 로 넣는다.
     *
     * 그래서 RECONFIRMATION_REQUIRED 이면 contractValidation.valid 는 반드시
     * false 다. 아래 INVALID 검사가 위에 있으면 항상 그쪽이 먼저 던진다.
     *
     * 무엇을 잃었나 - 알레르기가 UNKNOWN 인 분에게 recoverable: true 로
     * 돌아갈 길을 주려던 것이 recoverable: false 가 됐고, 문구도 킷 원문이
     * 그대로 나갔다("allergenIds 가 UNKNOWN 입니다. 임의로 추론하지 말고...").
     * 앱이 모르는 알레르기를 가진 분을 위해 만든 문인데 정작 그 상황에서
     * 한 줄도 닿지 않았다.
     */
    if (sr.status === "RECONFIRMATION_REQUIRED") {
      const 첫줄 = sr.reconfirmationFields?.[0]?.message;
      throw new KioBridgeError("RECONFIRM_REQUIRED", 첫줄 ?? "저장하신 조건을 다시 확인해 주세요", true);
    }
    // 서버가 못 쓰겠다고 하면 거기서 멈춘다. 조용히 넘기면 승인 직전에 터진다.
    for (const r of [pr, sr]) {
      if (r.status === "INVALID" || r.contractValidation?.valid === false) {
        const 첫줄 = r.contractValidation?.errors?.[0]?.message;
        throw new KioBridgeError("PROFILE_INVALID", 첫줄 ?? "저장하신 조건을 서버가 읽지 못했어요", false);
      }
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
    /*
     * 값 표기만 언어를 따라간다. 나머지 세 문장은 우리말 그대로 두고 화면 쪽에서
     * 옮긴다(i18n/en.ts) — 여기서 옮기면 같은 문장을 두 곳에서 관리하게 된다.
     */
    const 영어 = 접근성설정.읽기().language === "en-US";
    /*
     * 개수도 여기서 만든다. "1개" 를 표에 넣으면 수량 칩의 "1개" 까지 같이 바뀐다 —
     * 같은 우리말이 자리마다 다른 영어가 되는 곳은 표로 풀 수 없다.
     */
    return {
      itemCountText: 영어 ? `${개수} item${개수 === 1 ? "" : "s"}` : `${개수}개`,
      totalText: 돈(합계, 영어),
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
      실행단계.delete(sessionId);
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
      /*
       * initialState 는 읽지 않는다. 실측 응답에 늘 실려 오지만("SERVICE_TYPE")
       * 이건 **키오스크가 지금 어느 화면인지가 아니라 환경 설정값**이다 —
       * environments/chicken-store/manifest.json 의 initialState 를 그대로 돌려주는
       * 것이고, 같은 가게면 언제 불러도 같은 값이다(다른 환경은 "WELCOME").
       *
       * 그래서 '앞사람이 쓰던 화면이 남아 있나' 같은 걸 여기서 알 수는 없다.
       * 쓸 자리가 있다면 우리가 박아 둔 STEPS 의 첫 단계와 맞는지 보는 것인데,
       * 지금 붙는 환경이 닭강정집 하나뿐이라(백엔드가아는장소) 그 검사는 늘 통과한다.
       * 환경이 늘면 그때 여기서 짚는다.
       */
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

      /*
       * 서버가 '담으면 안 된다' 고 한 후보인가.
       *
       * warningsByCandidateId 에는 WARN 만 담기게 돼 있다(CandidateFilterResult 문서).
       * 그래서 여기 BLOCK 이 있으면 그건 서버 쪽이 어긋난 것인데, 어긋난 쪽으로
       * 기울 방향이 정해져 있다 — BLOCK 은 알레르기·품절 같은 절대 조건에 붙는
       * severity 다. 그런 후보를 "조금 다른 메뉴" 로 내밀면 안 된다.
       *
       * 지금은 한 번도 안 걸린다(실측: severity 가 전부 "WARN" 또는 null).
       * available 검사와 같은 이유로 남긴다 — 한쪽만 막으면 언젠가 샌다.
       */
      const 막힌후보 = (id: string): boolean =>
        (r.warningsByCandidateId?.[id] ?? []).some((x) => x.severity === "BLOCK" && x.result === "FAIL");

      // 지금 팔지 않는 것은 후보가 아니다. 심사 필수 기준이 '선택 불가능 후보
      // 추천 0건' 이고, 서버가 available:false 를 남겨 보내는 걸 확인했다.
      // 서버가 나중에 걸러 주더라도 여기 검사는 남긴다 — 한쪽만 막으면 언젠가 샌다.
      const 담을수있는 = (r.eligibleCandidates ?? [])
        .filter((c) => c?.candidateId && c.available !== false && !막힌후보(c.candidateId));

      const display: Record<string, { displayName: string; priceText: string }> = {};
      for (const c of 담을수있는) {
        if (c.name) display[c.candidateId] = { displayName: c.name, priceText: 원(c.price) };
      }
      후보.set(profile.id, new Map(담을수있는.map((c) => [c.candidateId, c])));
      규칙판정들.set(profile.id, {
        // 셋 중 하나라도 오면 '서버가 판정했다' 로 본다. 예전에는 앞의 둘만 봐서,
        // 재확인 판정만 온 응답에서 우리가 다시 맞춰 보는 쪽으로 물러났다.
        // 서버가 '비교하지 못했다' 고 한 축을 우리가 맞다고 말하게 되는 자리다.
        서버판정있음: Boolean(
          r.warningsByCandidateId || r.passesByCandidateId || r.reconfirmationsByCandidateId,
        ),
        warn: r.warningsByCandidateId ?? {},
        pass: r.passesByCandidateId ?? {},
      });

      const 뺀것 = (r.excludedCandidates ?? []).map((e) => ({
        candidateId: e.candidateId,
        reasonCode: e.reasonCode ?? "EXCLUDED",
        explanation: 사유문장(e),
      })).filter((e) => e.explanation);
      // 품절이라 뺀 것도 사용자에게 말해 준다. 조용히 사라지면 "왜 없지?" 가 된다.
      for (const c of (r.eligibleCandidates ?? [])) {
        if (c?.available === false && c.name) {
          뺀것.push({ candidateId: c.candidateId, reasonCode: "UNAVAILABLE", explanation: `${c.name}${은는(c.name)} 지금 팔지 않아서 뺐어요` });
        } else if (c?.candidateId && 막힌후보(c.candidateId) && c.name) {
          // 우리가 뺐으면 뺐다고 말한다. 어느 축 때문인지는 서버가 준 errorCode 로 짚는다.
          const 축 = (r.warningsByCandidateId?.[c.candidateId] ?? [])
            .filter((x) => x.severity === "BLOCK").map((x) => 축찾기(규칙축, x.errorCode)).find(Boolean);
          뺀것.push({
            candidateId: c.candidateId, reasonCode: "BLOCKED",
            explanation: 축
              ? `${c.name}${은는(c.name)} ${축}이(가) 맞지 않아서 뺐어요`
              : `${c.name}${은는(c.name)} 조건에 맞지 않아서 뺐어요`,
          });
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
        unmetConditions: r.unmetConditions ?? [],
        confidence: r.confidence ?? 0,
        requiresReconfirmation: r.requiresReconfirmation ?? false,
        scoredAxes: 도움된축(r.scoreBreakdown),
        // 이름·가격은 candidate-filters 에서 온다. 추천 응답에는 없다.
        display: {},
        // 축별 일치 여부. 서버 판정이 있으면 그것을 쓰고, 없으면 우리가 맞춰 본다.
        matchedOptions: 고름 ? 축맞춤(profile.id, 고름, 알려진후보?.get(고름), profile) : [],
        // 후보를 고르는 화면에서도 어느 축이 어긋나는지 보여 준다.
        unmatchedLabelsByCandidate: Object.fromEntries(
          [고름, ...(r.alternativeCandidateIds ?? [])]
            .filter((id): id is string => id !== null && 담을수있나(id))
            .map((id) => [
              id,
              축맞춤(profile.id, id, 알려진후보?.get(id), profile).filter((o) => !o.matched).map((o) => o.label),
            ]),
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
        // 1순위와 대안에 같은 후보가 겹치면 서버가 무엇을 담을지 알 수 없다.
        // (백엔드 RecommendationValidator 에 그 규칙이 있지만 그건
        //  /api/v1/recommendation-output-validations 에서만 돌고 승인 경로에는
        //  안 걸린다. 그러니 여기서 겹치지 않게 보내는 것이 유일한 방어다.)
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
      /*
       * 같은 이유로 여기도 덮거나 지운다 — 앞 승인의 단계가 남으면 안 된다.
       *
       * 담기 전에 문장으로 바꾼다. 아는 값(주문표에 고른 값 · 이번에 담기로 한
       * 메뉴 이름)만 통과하므로, 서버가 무엇을 보냈든 여기 남는 것은 우리가 이미
       * 알고 있던 값뿐이다.
       */
      // 사용자가 다른 후보를 골랐으면 그것, 아니면 서버 1순위. 그 하나만 아는 값이다.
      const 담을후보 = input.candidateId ?? rec.recommendedCandidateId ?? undefined;
      const 한일 = Array.isArray(r.runSteps)
        ? 한일만들기(r.runSteps, 아는값모으기(profile, 담을후보 ? 후보.get(profile.id)?.get(담을후보) : undefined))
        : undefined;
      if (한일) {
        실행단계.set(sessionId, 한일);
      } else {
        실행단계.delete(sessionId);
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
      // 이미 문장으로 바꿔 담아 뒀다. 여기서는 꺼내 쓰기만 한다.
      const 한일 = 실행단계.get(sessionId);
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
        // 서버가 안 주면 이 줄 자체가 없다. 화면이 그때는 그리지 않는다.
        ...(한일 ? { 한일 } : {}),
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
