import type {
  ApproveInput, CartResult, MappingResponse, MappingState, PairingResult, PlanCreated, PlanStatus, ProfileData, StepStatus,
} from "@/domain/types";
import { buildCart, buildMapping } from "@/api/mock";
import { STEPS } from "@/domain/catalog";

export class KioBridgeError extends Error {
  constructor(readonly code: string, message: string, readonly recoverable: boolean) {
    super(message);
    this.name = "KioBridgeError";
  }
}

/**
 * 앱이 백엔드에 기대하는 것. 화면은 이 네 개만 알고 있으면 된다.
 *
 * 주의 — 팀 API 명세서와 이름·모양이 다르다.
 * 이 인터페이스는 백엔드 합의 전에 화면을 먼저 만들려고 정한 것이고,
 * 실제 경로는 아래와 같다. 연동할 때는 이 네 개를 그대로 두고
 * 구현체 안에서 아래 호출들을 조립하면 화면 코드는 건드리지 않아도 된다.
 *
 *   claimPairing    → POST /api/v1/sessions
 *   requestMapping  → POST /api/v1/candidate-filters      (알레르기 등 BLOCK 후보 제거)
 *                   → POST /api/v1/recommendations        (순위·이유·대안·확신도)
 *   approve         → POST /api/v1/sessions/:id/submission  (저장만, 검증 X)
 *                   → POST /api/v1/sessions/:id/validate
 *                   → POST /api/v1/sessions/:id/execute      (검증 통과분만 실행)
 *   getPlanStatus   → GET  /internal/simulation/evidence/{sessionId}
 *
 * 특히 approve 가 실제로는 제출·검증·실행 3단계다. 중간에서 실패할 수 있으므로
 * 구현할 때 어느 단계에서 멈췄는지 사용자에게 구분해 알려야 한다.
 *
 * 장소별 질문 목록(domain/catalog.tsx)도 지금은 하드코딩이지만
 * GET /api/v1/environments/{environmentId}/input-options 가 담당한다.
 * 값은 시뮬레이션 킷 fixture 축에 맞춰 두었으므로 교체 시 모양은 같다.
 */
export interface KioBridgeApi {
  claimPairing(claimCode: string): Promise<PairingResult>;
  requestMapping(pairingId: string, profileId: string): Promise<MappingResponse>;
  /**
   * P0-4: 실행 계획은 오직 이 메서드에서만 만들어진다.
   * 사용자가 승인 버튼을 누르기 전에 이 함수를 호출하는 코드 경로가 있으면 요건 위반이다.
   */
  approve(input: ApproveInput): Promise<PlanCreated>;
  getPlanStatus(planId: string): Promise<PlanStatus>;
  /**
   * '이 기기에서 정보 지우기'. 서버에 남은 것까지 함께 지운다.
   *
   * 화면이 목 전용 함수(clearProfiles)를 직접 부르면, 실제 client 로 바꾸는 순간
   * 그 호출은 목의 Map 만 비우고 실서버 데이터는 그대로 남는다. 사용자에게는
   * "모두 지워요" 라고 말해 놓고 조용히 아무 일도 안 하게 된다.
   * 그래서 삭제도 계약에 넣는다.
   */
  forgetAll(): Promise<void>;
}

// ─── 데모 시나리오 ─────────────────────────────────────────────────────────────
// 백엔드가 붙기 전까지 심사·시연에서 예외 상태를 재현하기 위한 스위치.
// 실제 client 로 교체할 때 이 블록과 mock.ts 만 지우면 된다.

export interface Scenario {
  pairing: "connected" | "failed" | "expired";
  mapping: MappingState;
  execution: "cart_ready" | "aborted";
}

let scenario: Scenario = { pairing: "connected", mapping: "exact", execution: "cart_ready" };

export const getScenario = (): Scenario => scenario;
export const setScenario = (patch: Partial<Scenario>): void => {
  scenario = { ...scenario, ...patch };
};

// 실제 백엔드는 profileId 를 받아 자기 저장소에서 프로필을 찾는다.
// 목 구현에는 그 저장소가 없어서, 앱이 주문에 쓸 프로필을 여기에 등록해 둔다.
// 등록하지 않으면 requestMapping 이 사용자가 고른 적 없는 조건을 답으로 돌려주게 된다.
// 실제 client 로 교체할 때 이 맵과 registerProfile 은 함께 사라진다.
// 지우는 경로를 같이 둔다. 화면의 '이 기기에서 정보 지우기'는 "모두 지워요"라고
// 약속하는데, 여기 사본이 남으면 그 문장이 사실이 아니게 된다.
const profiles = new Map<string, ProfileData>();
export const registerProfile = (profile: ProfileData): void => {
  profiles.set(profile.id, profile);
};
/**
 * 등록해 둔 프로필을 id 로 찾는다.
 *
 * 팀 백엔드에는 프로필 저장소가 없어서, 후보 필터·추천·승인 때마다 내용을 함께
 * 보내야 한다. 그 내용을 들고 있는 곳이 여기다. createApi 의 세 번째 인자로 넘긴다.
 * 서버가 profileId 로 찾아 줄 수 있게 되면 이 함수도 registerProfile 과 함께 사라진다.
 */
export const getProfile = (id: string): ProfileData | undefined => profiles.get(id);
export const unregisterProfile = (id: string): void => {
  profiles.delete(id);
};
export const clearProfiles = (): void => {
  profiles.clear();
  // 진행 중이던 매핑 세션도 같이 지운다. 프로필은 지웠는데 그 프로필로 만든
  // 답이 서버에 남아 있으면 "모두 지워요" 가 여전히 사실이 아니다.
  sessions.clear();
  pairings.clear();
  // 실행 계획도 지운다. 여기에는 무엇을 몇 개 담았고 얼마인지가 들어 있다.
  // 세션만 지우고 이건 남겨 두면 같은 약속을 반쯤만 지키는 셈이다.
  plans.clear();
};

// 목이 흉내 내는 응답 지연. 시연에서는 실제로 기다리는 편이 자연스럽지만
// (연결 중·찾는 중 화면이 한순간에 지나가면 무슨 일이 일어났는지 안 보인다),
// 테스트에서는 순수한 대기라 0 으로 낮춘다. setScenario 와 같은 시연용 손잡이다.
// step 은 실행 화면의 단계 하나가 넘어가는 데 걸리는 시간이다.
// 5단계 × 1.4초라 실제로는 7초쯤 걸린다. 시연에서는 진행되는 게 보여야 하지만
// 테스트에서는 그냥 기다리는 시간이다.
let delays = { pairing: 1800, mapping: 1300, approve: 600, step: 1400 };
export const setMockDelays = (patch: Partial<typeof delays>): void => {
  delays = { ...delays, ...patch };
};

// ─── Mock 구현 ────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const ABORT_STEP = 2;

function buildSteps(activeIndex: number): StepStatus[] {
  return STEPS.map((_, i) => (i < activeIndex ? "done" : i === activeIndex ? "active" : "waiting"));
}

function buildAbortedSteps(): StepStatus[] {
  return STEPS.map((_, i) => (i < ABORT_STEP ? "done" : i === ABORT_STEP ? "failed" : "waiting"));
}

// 발급한 페어링과 그 만료 시각. 매핑·승인에서 이 세션이 진짜인지 본다.
const pairings = new Map<string, number>();

// 서버가 이 페어링에 뭐라고 답했는지. 승인 검사의 기준이 된다.
const sessions = new Map<string, {
  profileId: string;
  expiresAt: number;
  approved: boolean;
  result: MappingState;
  candidateIds: string[];
  item?: { displayName: string; priceText: string };
  byId: Record<string, { displayName: string; priceText: string }>;
  수량?: string;
}>();

const plans = new Map<string, { startedAt: number; outcome: Scenario["execution"]; cart: CartResult }>();
let 플랜일련번호 = 0;

export const mockApi: KioBridgeApi = {
  async claimPairing(claimCode) {
    await delay(delays.pairing);
    if (scenario.pairing === "failed") {
      throw new KioBridgeError("CLAIM_INVALID", "유효하지 않은 QR입니다", false);
    }
    if (scenario.pairing === "expired") {
      throw new KioBridgeError("CLAIM_EXPIRED", "연결 시간이 지났어요", true);
    }
    const pairingId = `pr_${claimCode}_${Date.now()}`;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    pairings.set(pairingId, expiresAt);
    return { pairingId, kioskName: "OO분식 1번 키오스크", expiresAt };
  },

  async requestMapping(pairingId, profileId) {
    await delay(delays.mapping);
    // 페어링을 거치지 않은 pairingId 로는 매핑하지 않는다. 실제 서버는
    // 세션을 모르면 거절한다. 목이 아무 값이나 받아 주면 화면이 그 경로를
    // 안 막아도 여기서 통과해 버린다.
    if (!pairings.has(pairingId)) {
      throw new KioBridgeError("PAIRING_NOT_FOUND", "키오스크와 다시 연결해 주세요", true);
    }
    // 등록되지 않은 프로필로는 답을 만들지 않는다. undefined 를 그대로 넘기면
    // 사용자가 고른 적 없는 임의 메뉴가 승인 화면까지 올라간다.
    // 지운 프로필로 조회하는 경우도 여기서 걸린다.
    const profile = profiles.get(profileId);
    if (!profile) {
      throw new KioBridgeError("PROFILE_NOT_FOUND", "프로필을 찾을 수 없어요", false);
    }
    // 응답 내용은 전부 이 프로필에서 나온다. 시나리오 스위치는 결과의 '종류'만 고른다.
    const res = buildMapping(scenario.mapping, profile);
    // 서버가 자기가 뭐라고 답했는지 기억해 둔다. 이게 없으면 승인 검사에서
    // 클라이언트가 보낸 mappingResult 를 믿어야 하고, candidateId 가 실제로
    // 우리가 준 후보인지도 확인할 수 없다.
    sessions.set(pairingId, {
      profileId,
      expiresAt: pairings.get(pairingId)!,
      approved: false,
      result: res.result,
      candidateIds: (res.candidates ?? []).map((c) => c.candidateId),
      // 승인 결과로 장바구니를 만들려면 무엇을 담기로 했는지도 알아야 한다.
      // 화면이 보여 준 값과 결과 화면의 값이 어긋나면 안 되기 때문이다.
      item: res.item && { displayName: res.item.displayName, priceText: res.item.priceText },
      byId: Object.fromEntries((res.candidates ?? []).map((c) => [c.candidateId, { displayName: c.displayName, priceText: c.priceText }])),
      // 수량은 응답이 아니라 프로필에서 읽는다.
      // 응답의 item 에서 꺼내면 clarification 처럼 item 이 없는 상태에서 undefined 가 되고,
      // buildCart 가 조용히 1개로 떨어뜨린다. 3개를 저장해 둔 사람이 1개를 받는다.
      // 수량은 사용자가 고른 값이지 서버가 정하는 값이 아니다.
      수량: profile.selections?.["수량"]?.[0],
    });
    return res;
  },

  async approve(input) {
    // 서버도 승인 조건을 다시 검증한다. 프론트 가드만 믿지 않는다.
    // 기준은 클라이언트가 보낸 값이 아니라 우리가 방금 답한 내용이다.
    const session = sessions.get(input.pairingId);
    if (!session) {
      throw new KioBridgeError("MAPPING_REQUIRED", "메뉴를 먼저 찾아야 해요", false);
    }
    // 매핑을 요청한 프로필과 승인하는 프로필이 같아야 한다.
    // 다르면 A 로 찾아 놓고 B 를 담는 게 된다.
    if (session.profileId !== input.profileId) {
      throw new KioBridgeError("PROFILE_MISMATCH", "메뉴를 다시 찾아 주세요", true);
    }
    // 끝난 연결로는 승인할 수 없다. 화면이 막고 있지만 서버도 다시 본다.
    if (session.expiresAt <= Date.now()) {
      throw new KioBridgeError("CLAIM_EXPIRED", "연결 시간이 지났어요", true);
    }
    // 같은 매핑으로 두 번 담지 않는다. 연타나 재전송으로 두 개가 담기면
    // 사용자는 한 번 승인하고 두 개를 받는다.
    if (session.approved) {
      throw new KioBridgeError("ALREADY_APPROVED", "이미 담았어요", false);
    }
    const result = session.result;
    if (result === "not_found") {
      throw new KioBridgeError("MENU_NOT_FOUND", "담을 수 있는 메뉴가 없어요", false);
    }
    if (result === "clarification") {
      if (!input.candidateId) {
        throw new KioBridgeError("CANDIDATE_REQUIRED", "메뉴를 선택해 주세요", true);
      }
      // 우리가 주지 않은 후보를 담아 달라고 하면 거절한다.
      if (!session.candidateIds.includes(input.candidateId)) {
        throw new KioBridgeError("CANDIDATE_UNKNOWN", "선택한 메뉴를 찾을 수 없어요", true);
      }
    }
    if (result === "changed" && !input.acknowledgedDiff) {
      throw new KioBridgeError("DIFF_NOT_ACKNOWLEDGED", "달라진 내용을 확인해 주세요", true);
    }
    // 확신이 낮을수록 사용자가 직접 짚었다는 사실이 더 중요하다. changed 와 같은 무게로 본다.
    if (result === "low_confidence" && !input.confirmedLowConfidence) {
      throw new KioBridgeError("CONFIRMATION_REQUIRED", "이 메뉴가 맞는지 확인해 주세요", true);
    }
    // 후보를 고르는 화면이 아닌데 candidateId 가 오면 무언가 어긋난 것이다.
    // 조용히 1순위로 되돌리면 사용자가 고른 것과 다른 게 담길 수 있다.
    if (input.candidateId && result !== "clarification") {
      throw new KioBridgeError("CANDIDATE_UNEXPECTED", "메뉴를 다시 찾아 주세요", true);
    }
    // 사용자가 고른 후보가 있으면 그것이 담기는 것이다.
    const 담을것 = (input.candidateId && session.byId[input.candidateId]) || session.item;
    if (!담을것) {
      throw new KioBridgeError("MENU_NOT_FOUND", "담을 수 있는 메뉴가 없어요", false);
    }
    // 첫 await 전에 표시한다. 212번 줄의 검사와 여기 사이에 await 가 있으면
    // 동시에 들어온 승인 두 건이 모두 그 검사를 통과하고 둘 다 담긴다.
    // 실패하면 되돌린다. backend.ts 도 같은 방식이다.
    session.approved = true;
    try {
      await delay(delays.approve);
    } catch (e) {
      session.approved = false;
      throw e;
    }
    // 밀리초만 쓰면 지연을 0 으로 낮춘 테스트에서 두 승인이 같은 값을 만든다.
    // 그러면 앞의 계획이 덮여 다른 세션의 장바구니를 보게 된다. 일련번호를 붙인다.
    const planId = `pln_${Date.now()}_${++플랜일련번호}`;
    plans.set(planId, {
      startedAt: Date.now(),
      outcome: scenario.execution,
      // 담을 것이 없으면 승인 자체가 성립하지 않는다. 고정값(MOCK_CART)으로
      // 때우면 확인 화면에서 본 값과 결과가 어긋난 채로 통과해 버린다.
      cart: buildCart({ ...담을것, 수량: session.수량 }),
    });
    return { planId };
  },

  async forgetAll() {
    // clearProfiles 가 profiles·sessions·plans 를 모두 비운다.
    clearProfiles();
  },

  async getPlanStatus(planId) {
    const plan = plans.get(planId);
    if (!plan) {
      throw new KioBridgeError("PLAN_NOT_FOUND", "실행 정보를 찾을 수 없어요", false);
    }
    const reached = Math.floor((Date.now() - plan.startedAt) / Math.max(1, delays.step));

    if (plan.outcome === "aborted" && reached >= ABORT_STEP) {
      return {
        state: "aborted",
        steps: buildAbortedSteps(),
        abort: {
          code: "UNKNOWN_SCREEN",
          title: "안전을 위해 중단되었습니다",
          message: "예상하지 못한 화면이 감지되어 작동을 멈췄어요. 키오스크는 건드리지 않아도 돼요.",
          userAction: "직원 초기화를 기다려 주세요",
          recoverable: false,
        },
      };
    }
    if (reached >= STEPS.length) {
      return { state: "cart_ready", steps: STEPS.map(() => "done"), cart: plan.cart };
    }
    return { state: "running", steps: buildSteps(reached) };
  },
};

/**
 * 화면이 쓰는 API.
 *
 * 팀 백엔드로 바꾸려면 아래 한 줄을 이렇게 바꾼다.
 *
 *   import { createApi, createTeamBackend } from "@/api/backend";
 *   export const api = createApi(createTeamBackend(), "chicken-store", getProfile);
 *
 * 아직 바꾸지 않는 이유는 두 가지다.
 *   1. 추천 응답에 조건별 일치 여부(matchedOptions)가 없어서, 확인 카드가
 *      "무엇을 왜 골랐는지" 를 항목별로 보여 주지 못한다.
 *   2. 백엔드 운영 배포(main)에 아직 컨트롤러가 올라가지 않았다.
 *
 * 연동 계층과 변환기는 이미 실제 계약에 맞춰 두었고 테스트로 잠가 두었다.
 * 위 둘이 풀리면 이 줄만 바꾸면 된다. docs/BACKEND_INTEGRATION.md 참고.
 */
export const api: KioBridgeApi = mockApi;
export const POLL_MS = 600;
