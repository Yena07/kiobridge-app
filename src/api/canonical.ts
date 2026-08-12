import { 기본접근성, type 접근성, type 도움설정 } from "@/api/a11y";
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
  interaction: { preferredInput: "TOUCH" | "VOICE"; language: string; confirmationRequired: boolean };
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

/**
 * 킷이 아는 일곱 칸만 남긴다. 모르는 칸은 버린다.
 *
 * 화면 쪽 설정에 칸이 늘어도 계약으로는 안 나간다. 여기가 그 문을 지키는 곳이다.
 */
const 일곱칸만 = (v: 접근성 & Record<string, unknown>): CanonicalProfile["accessibility"] => ({
  largeText: v.largeText,
  simpleSteps: v.simpleSteps,
  visualGuidance: v.visualGuidance,
  hearingSupport: v.hearingSupport,
  mobilitySupport: v.mobilitySupport,
  highContrast: v.highContrast,
  staffAssistancePreferred: v.staffAssistancePreferred,
});

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
  opts: { providerId?: string; collectedAt?: string; 접근성?: Partial<도움설정>; personalization?: boolean } = {},
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
    /*
     * 접근성 설정 화면에서 켠 것을 그대로 보낸다.
     *
     * 예전에는 largeText 하나만 받도록 열어 두고 나머지 여섯을 false 로 박아
     * 두었다 — "화면이 아직 묻지 않는 항목" 이라서였다. 이제 화면이 일곱 다 묻는다.
     * 안 켠 것은 여전히 false 다. 묻지 않은 것도, 안 켠 것도 true 로 보내지 않는다.
     */
    /*
     * 킷이 아는 일곱 칸만 골라 담는다. 화면 쪽 설정(도움설정)에는 소리 안내가
     * 하나 더 있는데, 그걸 여기로 흘리면 제출이 막힌다 — accessibility 는
     * additionalProperties: false 라 여덟 번째 칸을 안 받는다.
     *
     * `{ ...기본접근성, ...opts.접근성 }` 로 펼치던 것을 칸 이름을 적어 고르는
     * 방식으로 바꾼 이유가 이것이다. 펼치기는 무엇이 딸려 들어오는지 여기서
     * 읽히지 않아서, 화면 쪽에 칸이 하나 늘면 조용히 같이 나간다.
     */
    accessibility: 일곱칸만({ ...기본접근성, ...opts.접근성 }),
    /*
     * 화면 글은 한국어고 승인은 사람이 반드시 누른다.
     *
     * preferredInput 은 여태 "TOUCH" 로 박혀 있었다. 소리로 듣기를 바라는 분이
     * 접근성 화면에서 켜면 "VOICE" 로 나간다 — 킷 enum 에 원래 있던 값이고,
     * 로컬 백엔드로 확인했다(status VALID · contractValidation.valid true).
     */
    interaction: {
      preferredInput: opts.접근성?.voiceGuide ? "VOICE" : "TOUCH",
      /*
       * 안내받고 싶은 언어. 여태 "ko-KR" 로 박혀 있었다.
       *
       * 계약은 BCP 47 꼴이면 무엇이든 받는다. 로컬 백엔드로 en-US · zh-CN · vi-VN
       * 까지 확인했다(전부 status VALID). 화면이 안 물어서 늘 한국어로 나가고 있었다.
       */
      language: opts.접근성?.language ?? "ko-KR",
      confirmationRequired: true,
    },
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
      /*
       * 주문표는 이 탭이 살아 있는 동안만 남는다. 창을 닫으면 사라진다
       * (api/session.ts 의 sessionStorage). SESSION_ONLY 가 사실이다.
       *
       * 새로고침을 넘겨 이어 쓰게 됐어도 이 값은 그대로다 — 새로고침은 세션이
       * 끝나는 것이 아니다. 여기를 바꿔야 하는 때는 창을 닫아도 남게 만들 때다.
       */
      retentionPolicy: "SESSION_ONLY",
    },
  };
}

/** 닭강정집 세션 맥락. 다른 장소는 백엔드에 대응 타입이 아직 없다. */
export function toChickenStoreContext(
  p: OrderSheet,
  opts: { 예산?: number | null; 알레르기?: AllergenId[] } = {},
): ChickenStoreSessionContext {
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
      /*
       * 주문표에 고른 것과, 이 사람이 늘 피하는 것(api/allergy.ts)을 **합친다.**
       *
       * 덮지 않고 합치는 이유 — 합치면 걸러지는 후보가 늘어날 뿐 줄지 않는다.
       * 어느 쪽을 빠뜨려도 안전한 방향으로만 틀린다. 덮어쓰면 한쪽이 사라져서
       * 정작 걸러야 할 것이 안 걸러진다.
       */
      allergenIds: [...new Set([
        ...고른값들(p, "알레르기 (꼭 빼주세요)").map((v) => 알레르기[v] ?? "UNKNOWN"),
        ...(opts.알레르기 ?? []),
      ])],
      /*
       * 이번 이용의 가격 한도(api/budget.ts). 안 정했으면 null 이다.
       *
       * 스키마는 이 칸을 `{"type":"number","minimum":0}` 으로만 두고 required 에서
       * 뺐다 — 즉 **없는 것은 되고 null 은 안 된다.** 지금 null 이 통과하는 건
       * 백엔드의 @JsonInclude(NON_NULL) 이 킷으로 나가기 전에 지워 주기 때문이다.
       * 그쪽 애노테이션 하나에 기대고 있는 셈이라, 우리 쪽에서도 값이 있을 때만
       * 싣는다(toContextNormalizationInput).
       */
      maxPriceKrw: opts.예산 ?? null,
    },
    capabilities: {},
    fieldMetadata: {},
  };
}

/** 백엔드가 이 주문표를 다룰 수 있는가. 지금 대응 타입이 있는 건 닭강정집뿐이다. */
export const 백엔드가아는장소 = (p: OrderSheet): boolean => p.place === "음식점";

/**
 * enum 을 사람이 읽는 말로 되돌린다. 위의 표들을 뒤집어 만든다.
 *
 * 서버가 규칙 판정에 실제로 비교한 값을 실어 보낸다.
 *
 *   { errorCode: "SPICY_LEVEL_MISMATCH", sourceValue: "MILD", candidateValue: ["HOT"] }
 *
 * 그 값이 enum 이라 그대로 쓰면 화면에 "HOT" 이 뜬다. 어르신께 보여 드릴 말이 아니다.
 * 표를 손으로 한 벌 더 적지 않고 뒤집어 쓴다 — 두 벌이면 한쪽만 고치는 날이 온다.
 *
 * 모르는 값은 **비운다.** 지어내지 않는다 — 서버에 새 enum 이 생겼을 때
 * 원문을 그대로 띄우느니 그 줄을 안 그리는 편이 낫다.
 */
const 뒤집기 = <T extends string>(표: Record<string, T>): Record<string, string> =>
  Object.fromEntries(Object.entries(표).map(([말, e]) => [e, 말]));

const 되돌리기표: Record<string, string> = {
  ...뒤집기(이용방식), ...뒤집기(맵기), ...뒤집기(형태), ...뒤집기(컵),
};

/** enum 하나를 우리말로. 모르면 빈 문자열이다. */
export const 우리말 = (v: unknown): string =>
  typeof v === "string" ? (되돌리기표[v] ?? "") : "";

/**
 * 후보가 가진 값들을 우리말로 이어 붙인다.
 *
 * candidateValue 는 배열로 온다 — 후보가 받아 주는 값이 여럿일 수 있어서다
 * (`["DINE_IN","TAKE_OUT"]`). 하나라도 못 옮기면 그것만 빼고, 전부 못 옮기면 빈 문자열이다.
 */
export const 우리말들 = (v: unknown): string => {
  const 값들 = Array.isArray(v) ? v : [v];
  return 값들.map(우리말).filter(Boolean).join(" · ");
};


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
    /**
     * 가격 한도. 안 정했으면 아예 안 싣는다.
     *
     * 백엔드가 @PositiveOrZero BigDecimal 로 받고
     * (SessionContextNormalizationRequest.ContextInput), hardConstraints 로 옮긴 뒤
     * `/hardConstraints/maxPriceKrw` 의 fieldMetadata 까지 만들어 준다. 다 준비돼
     * 있었는데 화면이 안 보내서 서버의 가격 점수가 늘 0 이었다.
     */
    maxPriceKrw?: number;
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
  opts: { collectedAt?: string; 접근성?: Partial<도움설정> } = {},
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
  opts: { capturedAt?: string; 예산?: number | null; 알레르기?: AllergenId[] } = {},
): ContextNormalizationInput {
  const ctx = toChickenStoreContext(p, opts);
  const { quantity, ...나머지 } = ctx.preferences;
  const 한도 = ctx.hardConstraints.maxPriceKrw;
  return {
    contextInput: {
      ...나머지,
      // 수량은 @Min(1) 이라 null 을 보내면 거절당한다. 안 고르면 아예 뺀다.
      ...(quantity == null ? {} : { quantity }),
      allergenIds: ctx.hardConstraints.allergenIds,
      // 가격 한도도 같다. 안 정했으면 칸 자체를 안 만든다 — 스키마가 number 만
      // 받고 null 은 안 받는다. 값이 없으면 서버가 fieldMetadata 도 안 만든다.
      ...(한도 == null ? {} : { maxPriceKrw: 한도 }),
    },
    collectionMetadata: {
      source: "WEB_FORM",
      confidence: 1,
      confirmedByUser: true,
      ...(opts.capturedAt ? { capturedAt: opts.capturedAt } : {}),
    },
  };
}
