package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.input.context.AllergenId;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.allergenHardConstraintRule;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.candidate;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.fieldMetadata;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.priceLimitRule;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.serviceTypePreferenceRule;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.sessionContext;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * RuleEvaluatorImpl의 6단계 판정 순서(Kit packages/evaluator/src/compatibility.ts 포팅)를
 * 실제 chicken-store 규칙으로 검증한다. 규칙 4개는 ChickenStoreTestFixtures에서 실제
 * compatibility-rules.json 내용 그대로 가져온다.
 */
class RuleEvaluatorImplTest {

    private final RuleEvaluatorImpl evaluator = new RuleEvaluatorImpl();

    @Test
    void 정상_비교에서_위반이_없으면_PASS() {
        var ctx = sessionContext(List.of(AllergenId.MILK), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of("PEANUT"), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(allergenHardConstraintRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.PASS);
    }

    @Test
    void BLOCK_규칙_위반이면_FAIL_이면서_severity가_BLOCK이다() {
        var ctx = sessionContext(List.of(AllergenId.PEANUT), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of("PEANUT"), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(allergenHardConstraintRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.FAIL);
        assertThat(result.severity()).isEqualTo("BLOCK");
        assertThat(result.errorCode()).isEqualTo("ALLERGEN_CONFLICT");
    }

    @Test
    void WARN_규칙_위반이면_FAIL_이면서_severity가_WARN이다() {
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of(), List.of("DINE_IN"), List.of("HOT"));

        var result = evaluator.evaluate(serviceTypePreferenceRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.FAIL);
        assertThat(result.severity()).isEqualTo("WARN");
        assertThat(result.errorCode()).isEqualTo("SERVICE_TYPE_MISMATCH");
    }

    @Test
    void absentMeans가_NONE인데_값이_없으면_SKIPPED() {
        // maxPriceKrw를 아예 안 정한 사용자 -> "가격 제약 없음"으로 취급, unknownPolicy 안 탐.
        var ctx = sessionContext(List.of(), null, ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var candidate = candidate("c1", 999999, List.of(), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(priceLimitRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.SKIPPED);
    }

    @Test
    void NO_PREFERENCE값은_SKIPPED로_통과한다() {
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.NO_PREFERENCE, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of(), List.of("DINE_IN"), List.of("HOT"));

        var result = evaluator.evaluate(serviceTypePreferenceRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.SKIPPED);
    }

    @Test
    void candidate에_해당_속성이_없으면_SKIPPED() {
        var ctx = sessionContext(List.of(AllergenId.PEANUT), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        // attributes 맵에 allergenIds 키 자체가 없는 후보 (예: 후보 데이터가 이 속성을 아예 선언 안 함)
        var candidateWithoutAllergenInfo = new Candidate(
            "c1", "c1-name", "chicken-store", true, "PUBLIC", 12000.0, "설명",
            Map.of("SERVICE_TYPE", List.of("TAKE_OUT"), "SPICY_LEVEL", List.of("HOT")),
            Map.of(),
            Map.of(),
            Map.of()
        );

        var result = evaluator.evaluate(allergenHardConstraintRule(), candidateWithoutAllergenInfo, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.SKIPPED);
    }

    @Test
    void 값이_UNKNOWN이면_RECONFIRM() {
        var ctx = sessionContext(List.of(AllergenId.UNKNOWN), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of("MILK"), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(allergenHardConstraintRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.RECONFIRM);
        assertThat(result.errorCode()).isEqualTo("ALLERGEN_CONFLICT");
    }

    @Test
    void confidence가_minConfidence보다_낮고_미확인이면_RECONFIRM() {
        // chicken-store 실제 규칙엔 minConfidence가 없어서, 이 메커니즘 자체를 검증하기 위한 합성 규칙.
        var lowConfidenceRule = new CompatibilityRule(
            "TEST_LOW_CONFIDENCE_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "WARN", "RECONFIRM", "SPICY_LEVEL_MISMATCH",
            null, null, null, 0.6, "NONE"
        );
        var fieldMetadata = Map.of("/preferences/spicyLevel", fieldMetadata(0.3, false));
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT, fieldMetadata);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(lowConfidenceRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.RECONFIRM);
    }

    @Test
    void confidence가_낮아도_사용자가_확인했으면_RECONFIRM_아니다() {
        var lowConfidenceRule = new CompatibilityRule(
            "TEST_LOW_CONFIDENCE_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "WARN", "RECONFIRM", "SPICY_LEVEL_MISMATCH",
            null, null, null, 0.6, "NONE"
        );
        var fieldMetadata = Map.of("/preferences/spicyLevel", fieldMetadata(0.3, true));
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT, fieldMetadata);
        var candidate = candidate("c1", 12000, List.of(), List.of("HOT"), List.of("HOT"));

        var result = evaluator.evaluate(lowConfidenceRule, candidate, ctx);

        assertThat(result.result()).isNotEqualTo(RuleResult.RECONFIRM);
    }

    @Test
    void wildcard_안전경로_후보면_RECONFIRM_대신_PASS() {
        // 알레르기 정보를 몰라도(UNKNOWN), "직원 도움" 같은 안전 경로 후보는 재확인 없이 통과시킨다.
        var ruleWithWildcard = new CompatibilityRule(
            "CHICKEN_ALLERGEN_HARD_CONSTRAINT", "알레르기 하드 제약",
            new CompatibilityRule.RuleSource("hardConstraints", "allergenIds"),
            new CompatibilityRule.RuleTarget("attributes", "allergenIds"),
            null, "DISJOINT", "BLOCK", "RECONFIRM", "ALLERGEN_CONFLICT",
            null, null, List.of("STAFF_ASSISTED"), null, "NONE"
        );
        var ctx = sessionContext(List.of(AllergenId.UNKNOWN), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var safeRouteCandidate = candidate("staff-help", 0, List.of("STAFF_ASSISTED"), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(ruleWithWildcard, safeRouteCandidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.PASS);
    }

    @Test
    void unknownPolicy가_IGNORE이면_UNKNOWN값도_SKIPPED로_처리한다() {
        // 실제 CHICKEN_SERVICE_TYPE_PREFERENCE는 unknownPolicy=IGNORE.
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.UNKNOWN, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(serviceTypePreferenceRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.SKIPPED);
    }

    @Test
    void unknownPolicy가_ALLOW이면_UNKNOWN값도_PASS로_처리한다() {
        // chicken-store 실제 규칙엔 ALLOW가 없어서 메커니즘 자체를 검증하기 위한 합성 규칙.
        var allowRule = new CompatibilityRule(
            "TEST_ALLOW_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "WARN", "ALLOW", "SPICY_LEVEL_MISMATCH",
            null, null, null, null, "NONE"
        );
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.UNKNOWN);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("MILD"));

        var result = evaluator.evaluate(allowRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.PASS);
    }

    @Test
    void unknownPolicy가_BLOCK이면_UNKNOWN값도_FAIL로_처리한다() {
        var blockRule = new CompatibilityRule(
            "TEST_BLOCK_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "BLOCK", "BLOCK", "SPICY_LEVEL_MISMATCH",
            null, null, null, null, "NONE"
        );
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.UNKNOWN);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("MILD"));

        var result = evaluator.evaluate(blockRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.FAIL);
        assertThat(result.severity()).isEqualTo("BLOCK");
    }

    @Test
    void unknownPolicy가_null이면_기본값_RECONFIRM으로_처리한다() {
        var defaultPolicyRule = new CompatibilityRule(
            "TEST_DEFAULT_POLICY_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "WARN", null, "SPICY_LEVEL_MISMATCH",
            null, null, null, null, "NONE"
        );
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.UNKNOWN);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("MILD"));

        var result = evaluator.evaluate(defaultPolicyRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.RECONFIRM);
    }

    @Test
    void 값이_아예_없고_absentMeans가_NONE이_아니면_missing으로_unknownPolicy를_탄다() {
        // absentMeans를 null로 둬서 "null이면 기본값 UNKNOWN 적용"도 같이 검증한다.
        // isUnknownValue(문자열 "UNKNOWN")가 아니라 isMissing(값 자체가 null) 경로를 타는지가 핵심.
        var missingValueRule = new CompatibilityRule(
            "TEST_MISSING_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "WARN", "RECONFIRM", "SPICY_LEVEL_MISMATCH",
            null, null, null, null, null
        );
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, null);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(missingValueRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.RECONFIRM);
    }

    @Test
    void 빈_리스트도_absentMeans_NONE이면_SKIPPED된다() {
        // null이 아니라 "빈 배열"로 없는 경우도 isAbsent로 잡히는지 확인 (isEmptyList 경로).
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        var candidate = candidate("c1", 12000, List.of("MILK"), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(allergenHardConstraintRule(), candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.SKIPPED);
    }

    @Test
    void 정상값이어도_candidate가_wildcard면_비교없이_PASS() {
        // 3단계(RECONFIRM 안전경로)와 다른, 5단계(정상 비교 경로)의 wildcard 체크를 검증한다.
        var wildcardServiceTypeRule = new CompatibilityRule(
            "CHICKEN_SERVICE_TYPE_PREFERENCE", "포장/매장 선호",
            new CompatibilityRule.RuleSource("preferences", "serviceType"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SERVICE_TYPE"),
            null, "IN", "WARN", "IGNORE", "SERVICE_TYPE_MISMATCH",
            null, null, List.of("ANY"), null, "NONE"
        );
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);
        // 후보가 TAKE_OUT을 지원 안 하니 wildcard가 없으면 IN 비교에서 FAIL이어야 정상 -> 진짜로 비교를 건너뛰는지 검증.
        var candidate = candidate("c1", 12000, List.of(), List.of("ANY"), List.of("HOT"));

        var result = evaluator.evaluate(wildcardServiceTypeRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.PASS);
    }

    @Test
    void neutralValues를_커스텀으로_지정하면_기본목록_대신_그값을_쓴다() {
        var customNeutralRule = new CompatibilityRule(
            "TEST_CUSTOM_NEUTRAL_RULE", "테스트용",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null, "IN", "WARN", "IGNORE", "SPICY_LEVEL_MISMATCH",
            null, List.of("MILD"), null, null, "NONE"
        );
        // MILD는 원래 중립값이 아니지만, 이 규칙이 커스텀 neutralValues로 MILD를 지정했으니 SKIPPED여야 한다.
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.MILD);
        var candidate = candidate("c1", 12000, List.of(), List.of("TAKE_OUT"), List.of("HOT"));

        var result = evaluator.evaluate(customNeutralRule, candidate, ctx);

        assertThat(result.result()).isEqualTo(RuleResult.SKIPPED);
    }
}
