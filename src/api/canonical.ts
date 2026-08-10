import type { OrderSheet } from "@/domain/types";

/**
 * 화면이 쓰는 주문표를 백엔드가 받는 표준 모양으로 옮긴다.
 *
 * 화면은 사용자가 읽는 한글 선택지를 그대로 들고 있고("매운맛"),
 * 백엔드 계약은 enum 이다(SpicyLevel.HOT). 둘을 잇는 곳이 여기 하나다.
 *
 * 값은 팀 백엔드의 enum 파일에서 그대로 옮겼다.
 *   contracts/input/context/{ServiceType,SpicyLevel,BoneType,CupOption,AllergenId}.java
 *   contracts/input/profile/{CanonicalProfile,...}.java
 *
 * 모르는 값을 지어내지 않는다. 사용자가 고르지 않은 축은 NO_PREFERENCE 로 보낸다 —
 * "아무거나 괜찮다" 와 "안 골랐다" 를 서버가 구분할 수 있어야 알레르기 같은
 * 절대 조건을 잘못 완화하지 않는다.
 */

export type ServiceType = "DINE_IN" | "TAKE_OUT" | "NO_PREFERENCE" | "UNKNOWN";
export type SpicyLevel = "MILD" | "MEDIUM" | "HOT" | "NO_PREFERENCE" | "UNKNOWN";
export type BoneType = "BONE" | "BONELESS" | "NO_PREFERENCE" | "UNKNOWN";
export type CupOption = "PAPER" | "REGULAR" | "NONE" | "NO_PREFERENCE" | "UNKNOWN";
export type AllergenId = "PEANUT" | "SOY" | "MILK" | "EGG" | "WHEAT" | "SHRIMP" | "UNKNOWN";

export interface CanonicalProfile {
  profileId: string;
  dataClassification: "SYNTHETIC_PROFILE";
  source: { collectionChannel: "WEB_FORM"; providerId: string; collectedAt: string };
  accessibility: {
    largeText: boolean; simpleSteps: boolean; visualGuidance: boolean;
    hearingSupport: boolean; mobilitySupport: boolean; highContrast: boolean;
    staffAssistancePreferred: boolean;
  };
  interaction: { preferredInput: "TOUCH"; language: "ko-KR"; confirmationRequired: boolean };
  consent: { personalization: boolean; retentionPolicy: "SESSION_ONLY" };
}

export interface ChickenStoreSessionContext {
  intent: { task: "ORDER_FOOD" };
  facts: Record<string, never>;
  preferences: {
    serviceType: ServiceType; spicyLevel: SpicyLevel; boneType: BoneType;
    cupOption: CupOption; quantity: number | null;
  };
  hardConstraints: { allergenIds: AllergenId[]; maxPriceKrw: number | null };
  capabilities: Record<string, never>;
  fieldMetadata: Record<string, never>;
}

const 이용방식: Record<string, ServiceType> = { "먹고 가기": "DINE_IN", "포장하기": "TAKE_OUT" };
const 맵기: Record<string, SpicyLevel> = { "순한맛": "MILD", "보통맛": "MEDIUM", "매운맛": "HOT" };
const 형태: Record<string, BoneType> = { "뼈": "BONE", "순살": "BONELESS" };
const 컵: Record<string, CupOption> = { "종이컵": "PAPER", "일반컵": "REGULAR" };
const 알레르기: Record<string, AllergenId> = {
  "땅콩": "PEANUT", "대두": "SOY", "우유": "MILK", "계란": "EGG", "밀": "WHEAT", "새우": "SHRIMP",
};

const 고른값 = (p: OrderSheet, 축: string) => p.selections?.[축]?.[0];
const 고른값들 = (p: OrderSheet, 축: string) => p.selections?.[축] ?? [];

/**
 * 고른 값을 enum 으로 바꾼다.
 *
 * 안 골랐으면 NO_PREFERENCE, 골랐는데 표에 없으면 UNKNOWN 이다. 이 둘을 뭉뚱그리면
 * 화면에 새 선택지가 생겼을 때 서버가 "아무거나 괜찮대요" 로 읽는다.
 */
const 옮기기 = <T extends string>(값: string | undefined, 표: Record<string, T>, 없음: T, 모름: T): T =>
  값 === undefined ? 없음 : (표[값] ?? 모름);

export const 수량숫자 = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = /(\d+)/.exec(v);
  return m ? Number(m[1]) : null;
};

/**
 * 백엔드가 받는 주문표.
 *
 * 이름·전화번호 같은 실제 개인정보는 담지 않는다. displayName 은 선택 필드라
 * 아예 보내지 않는다 — 화면이 수집하지 않는 값을 계약에 채워 넣을 이유가 없다.
 * dataClassification 은 SYNTHETIC_PROFILE 고정이다(심사 요건).
 */
export function toCanonicalProfile(
  p: OrderSheet,
  opts: { providerId?: string; collectedAt?: string; largeText?: boolean; personalization?: boolean } = {},
): CanonicalProfile {
  return {
    profileId: p.id,
    dataClassification: "SYNTHETIC_PROFILE",
    source: {
      collectionChannel: "WEB_FORM",
      providerId: opts.providerId ?? "WHATTHEBUG",
      // 호출자가 시각을 주면 그걸 쓴다. 테스트가 시계에 의존하지 않게 한다.
      collectedAt: opts.collectedAt ?? new Date().toISOString(),
    },
    accessibility: {
      largeText: opts.largeText ?? false,
      // 화면이 아직 묻지 않는 항목들이다. 묻지 않은 것을 true 로 보내지 않는다.
      simpleSteps: false, visualGuidance: false, hearingSupport: false,
      mobilitySupport: false, highContrast: false, staffAssistancePreferred: false,
    },
    // 이 앱은 터치로 조작하고 화면 글은 한국어다. 승인은 사람이 반드시 누른다.
    interaction: { preferredInput: "TOUCH", language: "ko-KR", confirmationRequired: true },
    consent: {
      /*
       * 화면에 '개인화에 동의하십니까' 라는 항목은 없다. 대신 사용자가 조건을
       * 저장하고 '이 주문표로 주문하기' 를 눌러 그 조건으로 골라 달라고 한다.
       * 그 행동 자체가 이 주문에 한한 동의라고 보고 true 로 둔다.
       *
       * 동의 항목을 따로 묻게 되면 그 값을 여기로 넘긴다. 기본값을 false 로
       * 두지 않는 이유는, 앱이 실제로 개인화하고 있는데 안 한다고 적는 것도
       * 사실과 다르기 때문이다.
       */
      personalization: opts.personalization ?? true,
      // 주문표는 메모리에만 두고 새로고침하면 사라진다. SESSION_ONLY 가 사실이다.
      retentionPolicy: "SESSION_ONLY",
    },
  };
}

/** 닭강정집 세션 맥락. 다른 장소는 백엔드에 대응 타입이 아직 없다. */
export function toChickenStoreContext(p: OrderSheet): ChickenStoreSessionContext {
  return {
    intent: { task: "ORDER_FOOD" },
    facts: {},
    preferences: {
      serviceType: 옮기기(고른값(p, "이용 방식"), 이용방식, "NO_PREFERENCE", "UNKNOWN"),
      spicyLevel: 옮기기(고른값(p, "맵기"), 맵기, "NO_PREFERENCE", "UNKNOWN"),
      boneType: 옮기기(고른값(p, "형태"), 형태, "NO_PREFERENCE", "UNKNOWN"),
      cupOption: 옮기기(고른값(p, "컵"), 컵, "NO_PREFERENCE", "UNKNOWN"),
      quantity: 수량숫자(고른값(p, "수량")),
    },
    hardConstraints: {
      // 알레르기는 절대 조건이다. 모르는 값을 조용히 버리면 그 사람의 알레르기가
      // 서버에 전달되지 않는다. UNKNOWN 으로라도 보내서 서버가 알게 한다.
      allergenIds: 고른값들(p, "알레르기 (꼭 빼주세요)").map((v) => 알레르기[v] ?? "UNKNOWN"),
      maxPriceKrw: null,
    },
    capabilities: {},
    fieldMetadata: {},
  };
}

/** 백엔드가 이 주문표를 다룰 수 있는가. 지금 대응 타입이 있는 건 닭강정집뿐이다. */
export const 백엔드가아는장소 = (p: OrderSheet): boolean => p.place === "음식점";


// ─── 정규화 경로에 넣을 원자료 ────────────────────────────────────────────────
//
// 백엔드에 정규화 경로가 따로 있다(profile-normalizations · session-context-normalizations).
// 거기에 넣으면 서버가 CanonicalProfile 을 만들어 주고, 킷 스키마로 검증까지 해 준다.
// providerId 같은 값도 서버 설정(kiobridge.team-id)에서 채워 주므로 우리가 짐작하지 않는다.
//
// 위의 toCanonicalProfile·toChickenStoreContext 는 그 경로를 못 쓸 때를 위한 대비책이다.

export interface ProfileNormalizationInput {
  profileId: string;
  collectionChannel: "WEB_FORM";
  collectedAt: string;
  accessibility: CanonicalProfile["accessibility"];
  interaction: CanonicalProfile["interaction"];
  consent: CanonicalProfile["consent"];
}

export interface ContextNormalizationInput {
  contextInput: {
    serviceType: ServiceType;
    spicyLevel: SpicyLevel;
    boneType: BoneType;
    cupOption: CupOption;
    quantity?: number;
    allergenIds: AllergenId[];
  };
  /**
   * 이 값들을 어떻게 얻었는지.
   *
   * 이 앱에서는 사용자가 화면에서 직접 눌러 고른다. 추론한 게 아니라
   * 확신도 1.0 · 사용자 확인 완료가 사실이다. 낮춰 적으면 서버가
   * 재확인을 요구하는데, 이미 사용자가 고른 것을 또 묻게 된다.
   */
  collectionMetadata: { source: "WEB_FORM"; confidence: number; confirmedByUser: boolean; capturedAt?: string };
}

export function toProfileNormalizationInput(
  p: OrderSheet,
  opts: { collectedAt?: string; largeText?: boolean } = {},
): ProfileNormalizationInput {
  const c = toCanonicalProfile(p, opts);
  // providerId 와 dataClassification 은 서버가 채운다. 보내지 않는다.
  return {
    profileId: c.profileId,
    collectionChannel: c.source.collectionChannel,
    collectedAt: c.source.collectedAt,
    accessibility: c.accessibility,
    interaction: c.interaction,
    consent: c.consent,
  };
}

export function toContextNormalizationInput(
  p: OrderSheet,
  opts: { capturedAt?: string } = {},
): ContextNormalizationInput {
  const ctx = toChickenStoreContext(p);
  const { quantity, ...나머지 } = ctx.preferences;
  return {
    contextInput: {
      ...나머지,
      // 수량은 @Min(1) 이라 null 을 보내면 거절당한다. 안 고르면 아예 뺀다.
      ...(quantity == null ? {} : { quantity }),
      allergenIds: ctx.hardConstraints.allergenIds,
    },
    collectionMetadata: {
      source: "WEB_FORM",
      confidence: 1,
      confirmedByUser: true,
      ...(opts.capturedAt ? { capturedAt: opts.capturedAt } : {}),
    },
  };
}
