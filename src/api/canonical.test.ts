import { describe, expect, it } from "vitest";
import type { OrderSheet } from "@/domain/types";
import { toCanonicalProfile, toChickenStoreContext, toContextNormalizationInput, 백엔드가아는장소, 수량숫자 } from "./canonical";

// 이 파일이 지키는 것: 화면의 한글 선택지가 백엔드 enum 으로 정확히 옮겨진다.
// 여기가 어긋나면 사용자가 '매운맛'을 골랐는데 서버는 '순한맛'으로 읽는다.
// 값은 팀 백엔드의 enum 파일에서 그대로 옮긴 것이다.

const 주문표 = (selections: Record<string, string[]>): OrderSheet => ({
  id: "p1", menuName: "닭강정", place: "음식점", selections, memo: "",
});

describe("선택지를 enum 으로 옮긴다", () => {
  it("닭강정집 다섯 축이 모두 맞는다", () => {
    const c = toChickenStoreContext(주문표({
      "이용 방식": ["먹고 가기"], "맵기": ["매운맛"], "형태": ["순살"],
      "컵": ["종이컵"], "수량": ["2개"],
    }));
    expect(c.preferences).toEqual({
      serviceType: "DINE_IN", spicyLevel: "HOT", boneType: "BONELESS",
      cupOption: "PAPER", quantity: 2,
    });
    expect(c.intent).toEqual({ task: "ORDER_FOOD" });
  });

  it("나머지 선택지도 짝이 맞는다", () => {
    const c = toChickenStoreContext(주문표({
      "이용 방식": ["포장하기"], "맵기": ["순한맛"], "형태": ["뼈"], "컵": ["일반컵"], "수량": ["3개"],
    }));
    expect(c.preferences).toEqual({
      serviceType: "TAKE_OUT", spicyLevel: "MILD", boneType: "BONE",
      cupOption: "REGULAR", quantity: 3,
    });
    expect(toChickenStoreContext(주문표({ "맵기": ["보통맛"] })).preferences.spicyLevel).toBe("MEDIUM");
  });

  it("안 고른 축은 NO_PREFERENCE 다 — UNKNOWN 과 구분한다", () => {
    // 안 골랐다(NO_PREFERENCE)와 모르는 값이다(UNKNOWN)를 뭉뚱그리면,
    // 화면에 새 선택지가 생겼을 때 서버가 '아무거나 괜찮대요' 로 읽는다.
    const 빈 = toChickenStoreContext(주문표({}));
    expect(빈.preferences).toEqual({
      serviceType: "NO_PREFERENCE", spicyLevel: "NO_PREFERENCE", boneType: "NO_PREFERENCE",
      cupOption: "NO_PREFERENCE", quantity: null,
    });
    const 모름 = toChickenStoreContext(주문표({ "맵기": ["아주매운맛"] }));
    expect(모름.preferences.spicyLevel).toBe("UNKNOWN");
  });

  it("알레르기 여섯 개가 모두 옮겨진다", () => {
    const c = toChickenStoreContext(주문표({
      "알레르기 (꼭 빼주세요)": ["땅콩", "대두", "우유", "계란", "밀", "새우"],
    }));
    expect(c.hardConstraints.allergenIds).toEqual(["PEANUT", "SOY", "MILK", "EGG", "WHEAT", "SHRIMP"]);
  });

  it("모르는 알레르기도 버리지 않고 UNKNOWN 으로 보낸다", () => {
    // 조용히 버리면 그 사람의 알레르기가 서버에 전달되지 않는다.
    // 절대 조건이라 '모른다' 는 사실이라도 서버가 알아야 한다.
    const c = toChickenStoreContext(주문표({ "알레르기 (꼭 빼주세요)": ["땅콩", "메밀"] }));
    expect(c.hardConstraints.allergenIds).toEqual(["PEANUT", "UNKNOWN"]);
  });

  it("수량은 숫자로 바뀐다", () => {
    expect(수량숫자("1개")).toBe(1);
    expect(수량숫자("10개")).toBe(10);
    expect(수량숫자(undefined)).toBeNull();
    expect(수량숫자("")).toBeNull();
  });
});

describe("주문표에 실제 개인정보를 담지 않는다", () => {
  it("dataClassification 은 SYNTHETIC_PROFILE 이다", () => {
    // 심사 요건이다. 다른 값이면 실격 대상이 된다.
    expect(toCanonicalProfile(주문표({})).dataClassification).toBe("SYNTHETIC_PROFILE");
  });

  it("이름·전화번호가 들어갈 자리를 만들지 않는다", () => {
    const c = toCanonicalProfile({ ...주문표({}), memo: "김할머니 010-1234-5678" });
    const s = JSON.stringify(c);
    expect(s).not.toContain("displayName");
    expect(s).not.toContain("김할머니");
    // 메모는 사용자가 자유롭게 적는 칸이라 그대로 보내지 않는다.
    expect(s).not.toContain("010-");
  });

  it("동의를 받은 것만 personalization: true 로 나간다", () => {
    /*
     * 예전에는 여기가 true 로 박혀 있었다. 화면이 안 묻는데 서버에는 "동의받았다" 고
     * 보내고 있었던 셈이다. 이제 화면이 묻고(api/consent.ts) 그 값이 여기로 온다.
     *
     * 기본값도 false 다. 안 넘기면 못 받은 것이므로, 못 받은 동의를 받은 것처럼
     * 보내지 않는다.
     */
    expect(toCanonicalProfile(주문표({}), { personalization: true }).consent.personalization).toBe(true);
    expect(toCanonicalProfile(주문표({}), { personalization: false }).consent.personalization).toBe(false);
    expect(toCanonicalProfile(주문표({})).consent.personalization).toBe(false);
  });

  it("보관 정책이 화면의 실제 동작과 같다", () => {
    // 주문표는 이 탭이 살아 있는 동안만 남고 창을 닫으면 사라진다. SESSION_ONLY 가 사실이다.
    // 새로고침을 넘겨 이어 쓰는 것은 세션이 끝나는 것이 아니라 이 값과 어긋나지 않는다.
    expect(toCanonicalProfile(주문표({})).consent.retentionPolicy).toBe("SESSION_ONLY");
  });

  it("안 켠 접근성 항목을 true 로 보내지 않는다", () => {
    const a = toCanonicalProfile(주문표({})).accessibility;
    expect(Object.values(a).every((v) => v === false)).toBe(true);
  });

  it("설정 화면에서 켠 것을 그대로 보낸다", () => {
    /*
     * 예전에는 largeText 하나만 받도록 열어 두고 나머지 여섯을 false 로 박아
     * 두었다. 백엔드는 일곱을 다 받을 준비가 돼 있었는데 화면이 안 물어서
     * 늘 "아무 도움도 필요 없음" 으로 나갔다.
     */
    const a = toCanonicalProfile(주문표({}), {
      접근성: { largeText: true, highContrast: true, hearingSupport: true },
    }).accessibility;
    expect(a.largeText).toBe(true);
    expect(a.highContrast).toBe(true);
    expect(a.hearingSupport).toBe(true);
    // 안 켠 것은 그대로 false 다.
    expect(a.simpleSteps).toBe(false);
    expect(a.staffAssistancePreferred).toBe(false);
  });

  it("일곱 가지를 다 실어 보낸다 — 킷 계약 그대로", () => {
    const a = toCanonicalProfile(주문표({})).accessibility;
    expect(Object.keys(a).sort()).toEqual([
      "hearingSupport", "highContrast", "largeText", "mobilitySupport",
      "simpleSteps", "staffAssistancePreferred", "visualGuidance",
    ]);
  });

  it("소리 안내는 accessibility 에 섞이지 않는다", () => {
    /*
     * 킷 스키마의 accessibility 는 additionalProperties: false 이고 일곱이 전부
     * required 다. 여덟 번째 칸이 끼면 제출이 막힌다.
     *
     * 화면 쪽 설정(도움설정)에는 소리 안내가 있어서, 예전처럼 통째로 펼쳐
     * 넘기면 그대로 딸려 나간다. 칸 이름을 적어 고르는 것이 그걸 막는다.
     */
    const c = toCanonicalProfile(주문표({}), { 접근성: { largeText: true, voiceGuide: true } });
    expect(Object.keys(c.accessibility).sort()).toEqual([
      "hearingSupport", "highContrast", "largeText", "mobilitySupport",
      "simpleSteps", "staffAssistancePreferred", "visualGuidance",
    ]);
    expect(c.accessibility).not.toHaveProperty("voiceGuide");
    expect(JSON.stringify(c.accessibility)).not.toContain("voiceGuide");
  });

  it("소리 안내를 켜면 preferredInput 이 VOICE 로 나간다", () => {
    /*
     * 킷 enum 에 원래 있던 값이다(TOUCH · VOICE · KEYBOARD · SWITCH · ASSISTED ·
     * MULTIMODAL). 여태 "TOUCH" 로 박아 보내고 있었다. 로컬 백엔드로 확인했다 -
     * status VALID, contractValidation.valid true.
     */
    expect(toCanonicalProfile(주문표({}), { 접근성: { voiceGuide: true } }).interaction.preferredInput).toBe("VOICE");
  });

  it("안 켜면 그대로 TOUCH 다", () => {
    expect(toCanonicalProfile(주문표({})).interaction.preferredInput).toBe("TOUCH");
    expect(toCanonicalProfile(주문표({}), { 접근성: { largeText: true } }).interaction.preferredInput).toBe("TOUCH");
  });

  it("고른 언어가 interaction.language 로 나간다", () => {
    /*
     * 계약은 BCP 47 꼴이면 무엇이든 받는다. 로컬 백엔드로 넷 다 확인했다 —
     * ko-KR · en-US · zh-CN · vi-VN 전부 status VALID.
     * 화면이 안 물어서 여태 "ko-KR" 로만 나가고 있었다.
     */
    for (const code of ["ko-KR", "en-US", "zh-CN", "vi-VN"] as const) {
      expect(toCanonicalProfile(주문표({}), { 접근성: { language: code } }).interaction.language).toBe(code);
    }
  });

  it("안 고르면 한국어다", () => {
    expect(toCanonicalProfile(주문표({})).interaction.language).toBe("ko-KR");
  });

  it("언어도 accessibility 에 섞이지 않는다", () => {
    // voiceGuide 와 같은 이유다. 일곱 칸은 additionalProperties: false 다.
    const c = toCanonicalProfile(주문표({}), { 접근성: { language: "zh-CN", voiceGuide: true } });
    expect(Object.keys(c.accessibility).sort()).toEqual([
      "hearingSupport", "highContrast", "largeText", "mobilitySupport",
      "simpleSteps", "staffAssistancePreferred", "visualGuidance",
    ]);
    expect(JSON.stringify(c.accessibility)).not.toContain("language");
  });

  it("수집 시각을 넘기면 그걸 쓴다 — 시계에 기대지 않는다", () => {
    const t = "2026-08-01T05:30:00.000Z";
    expect(toCanonicalProfile(주문표({}), { collectedAt: t }).source.collectedAt).toBe(t);
  });
});

describe("백엔드가 다룰 수 있는 장소인지 본다", () => {
  it("닭강정집만 참이다", () => {
    // 백엔드의 요청 타입이 ChickenStoreSessionContext 로 못박혀 있다.
    expect(백엔드가아는장소(주문표({}))).toBe(true);
    for (const place of ["카페", "병원", "관공서"] as const) {
      expect(백엔드가아는장소({ ...주문표({}), place })).toBe(false);
    }
    expect(백엔드가아는장소({ ...주문표({}), place: null })).toBe(false);
  });
});

/*
 * 가격 한도.
 *
 * 지금까지 늘 null 로 나가서 서버의 가격 점수가 죽어 있었다. 같은 주문표로 재 본 것:
 *
 *   한도 없음     priceScore 0.0      confidence 0.5   대안 2개
 *   한도 5,800원  priceScore 0.0259   confidence 0.8   대안 0개
 */
describe("가격 한도", () => {
  const 주문표하나 = 주문표({ "이용 방식": ["포장하기"] });

  it("정한 값을 hardConstraints 에 실어 보낸다", () => {
    expect(toChickenStoreContext(주문표하나, { 예산: 8000 }).hardConstraints.maxPriceKrw).toBe(8000);
  });

  it("안 정했으면 정규화 입력에서 칸 자체를 뺀다", () => {
    // 킷 스키마가 { "type": "number", "minimum": 0 } 이라 null 을 안 받는다.
    // 지금 null 이 통하는 것은 백엔드의 @JsonInclude(NON_NULL) 이 킷으로 나가기
    // 전에 지워 주기 때문이다. 그쪽 애노테이션 하나에 기대지 않는다.
    const { contextInput } = toContextNormalizationInput(주문표하나);
    expect(contextInput).not.toHaveProperty("maxPriceKrw");
  });

  it("정했으면 정규화 입력에 실린다", () => {
    const { contextInput } = toContextNormalizationInput(주문표하나, { 예산: 6000 });
    expect(contextInput.maxPriceKrw).toBe(6000);
  });
});
