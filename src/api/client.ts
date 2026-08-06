import type {
  ApproveInput, MappingResponse, MappingState, PairingResult, PlanCreated, PlanStatus, ProfileData, StepStatus,
} from "@/domain/types";
import { MOCK_CART, buildMapping } from "@/api/mock";
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
const profiles = new Map<string, ProfileData>();
export const registerProfile = (profile: ProfileData): void => {
  profiles.set(profile.id, profile);
};

// ─── Mock 구현 ────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const STEP_MS = 1400;
const ABORT_STEP = 2;

function buildSteps(activeIndex: number): StepStatus[] {
  return STEPS.map((_, i) => (i < activeIndex ? "done" : i === activeIndex ? "active" : "waiting"));
}

function buildAbortedSteps(): StepStatus[] {
  return STEPS.map((_, i) => (i < ABORT_STEP ? "done" : i === ABORT_STEP ? "failed" : "waiting"));
}

const plans = new Map<string, { startedAt: number; outcome: Scenario["execution"] }>();

export const mockApi: KioBridgeApi = {
  async claimPairing(claimCode) {
    await delay(1800);
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
    await delay(1300);
    // 응답 내용은 전부 이 프로필에서 나온다. 시나리오 스위치는 결과의 '종류'만 고른다.
    return buildMapping(scenario.mapping, profiles.get(profileId));
  },

  async approve(input) {
    // 서버도 승인 조건을 다시 검증한다. 프론트 가드만 믿지 않는다.
    if (input.mappingResult === "not_found") {
      throw new KioBridgeError("MENU_NOT_FOUND", "담을 수 있는 메뉴가 없어요", false);
    }
    if (input.mappingResult === "clarification" && !input.candidateId) {
      throw new KioBridgeError("CANDIDATE_REQUIRED", "메뉴를 선택해 주세요", true);
    }
    if (input.mappingResult === "changed" && !input.acknowledgedDiff) {
      throw new KioBridgeError("DIFF_NOT_ACKNOWLEDGED", "달라진 내용을 확인해 주세요", true);
    }
    // 확신이 낮을수록 사용자가 직접 짚었다는 사실이 더 중요하다. changed 와 같은 무게로 본다.
    if (input.mappingResult === "low_confidence" && !input.confirmedLowConfidence) {
      throw new KioBridgeError("CONFIRMATION_REQUIRED", "이 메뉴가 맞는지 확인해 주세요", true);
    }
    await delay(600);
    const planId = `pln_${Date.now()}`;
    plans.set(planId, { startedAt: Date.now(), outcome: scenario.execution });
    return { planId };
  },

  async getPlanStatus(planId) {
    const plan = plans.get(planId);
    if (!plan) {
      throw new KioBridgeError("PLAN_NOT_FOUND", "실행 정보를 찾을 수 없어요", false);
    }
    const reached = Math.floor((Date.now() - plan.startedAt) / STEP_MS);

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
      return { state: "cart_ready", steps: STEPS.map(() => "done"), cart: MOCK_CART };
    }
    return { state: "running", steps: buildSteps(reached) };
  },
};

export const api: KioBridgeApi = mockApi;
export const POLL_MS = 600;
