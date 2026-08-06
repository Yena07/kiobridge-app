import type {
  ApproveInput, CartResult, MappingResponse, MappingState, PairingResult, PlanCreated, PlanStatus, ProfileData, StepStatus,
} from "@/domain/types";
import { MOCK_CART, buildCart, buildMapping } from "@/api/mock";
import { STEPS } from "@/domain/catalog";

export class KioBridgeError extends Error {
  constructor(readonly code: string, message: string, readonly recoverable: boolean) {
    super(message);
    this.name = "KioBridgeError";
  }
}

export interface KioBridgeApi {
  claimPairing(claimCode: string): Promise<PairingResult>;
  requestMapping(pairingId: string, profileId: string): Promise<MappingResponse>;
  /**
   * P0-4: 실행 계획은 오직 이 메서드에서만 만들어진다.
   * 사용자가 승인 버튼을 누르기 전에 이 함수를 호출하는 코드 경로가 있으면 요건 위반이다.
   */
  approve(input: ApproveInput): Promise<PlanCreated>;
  getPlanStatus(planId: string): Promise<PlanStatus>;
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
export const unregisterProfile = (id: string): void => {
  profiles.delete(id);
};
export const clearProfiles = (): void => {
  profiles.clear();
  // 진행 중이던 매핑 세션도 같이 지운다. 프로필은 지웠는데 그 프로필로 만든
  // 답이 서버에 남아 있으면 "모두 지워요" 가 여전히 사실이 아니다.
  sessions.clear();
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

// 서버가 이 페어링에 뭐라고 답했는지. 승인 검사의 기준이 된다.
const sessions = new Map<string, {
  result: MappingState;
  candidateIds: string[];
  item?: { displayName: string; priceText: string };
  byId: Record<string, { displayName: string; priceText: string }>;
  수량?: string;
}>();

const plans = new Map<string, { startedAt: number; outcome: Scenario["execution"]; cart: CartResult }>();

export const mockApi: KioBridgeApi = {
  async claimPairing(claimCode) {
    await delay(delays.pairing);
    if (scenario.pairing === "failed") {
      throw new KioBridgeError("CLAIM_INVALID", "유효하지 않은 QR입니다", false);
    }
    if (scenario.pairing === "expired") {
      throw new KioBridgeError("CLAIM_EXPIRED", "연결 시간이 지났어요", true);
    }
    return {
      pairingId: `pr_${claimCode}_${Date.now()}`,
      kioskName: "OO분식 1번 키오스크",
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
  },

  async requestMapping(_pairingId, profileId) {
    await delay(delays.mapping);
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
    sessions.set(_pairingId, {
      result: res.result,
      candidateIds: (res.candidates ?? []).map((c) => c.candidateId),
      // 승인 결과로 장바구니를 만들려면 무엇을 담기로 했는지도 알아야 한다.
      // 화면이 보여 준 값과 결과 화면의 값이 어긋나면 안 되기 때문이다.
      item: res.item && { displayName: res.item.displayName, priceText: res.item.priceText },
      byId: Object.fromEntries((res.candidates ?? []).map((c) => [c.candidateId, { displayName: c.displayName, priceText: c.priceText }])),
      수량: res.item?.options.find((o) => o.label === "수량")?.value,
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
    await delay(delays.approve);
    // 사용자가 고른 후보가 있으면 그것이 담기는 것이다.
    const 담을것 = (input.candidateId && session.byId[input.candidateId]) || session.item;
    const planId = `pln_${Date.now()}`;
    plans.set(planId, {
      startedAt: Date.now(),
      outcome: scenario.execution,
      cart: 담을것 ? buildCart({ ...담을것, 수량: session.수량 }) : MOCK_CART,
    });
    return { planId };
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

export const api: KioBridgeApi = mockApi;
export const POLL_MS = 600;
