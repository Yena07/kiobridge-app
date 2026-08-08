package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.input.context.AllergenId;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreCapabilities;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreFacts;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreHardConstraints;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStorePreferences;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.context.FieldMetadata;
import com.kiobridge.kiobridge.contracts.input.context.MetadataSource;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SessionIntent;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * environments/chicken-store/compatibility-rules.json의 CANDIDATE scope 규칙 4개를 그대로
 * 옮겨온 테스트 픽스처. Kit의 실제 데이터와 어긋나면 테스트도 의미가 없어지므로, 규칙 필드값은
 * 절대 임의로 바꾸지 말고 실제 JSON과 대조해서만 수정한다.
 */
final class ChickenStoreTestFixtures {

    private ChickenStoreTestFixtures() {
    }

    static CompatibilityRule allergenHardConstraintRule() {
        return new CompatibilityRule(
            "CHICKEN_ALLERGEN_HARD_CONSTRAINT",
            "알레르기 하드 제약 (후보 알레르겐과 겹치면 안 됨)",
            new CompatibilityRule.RuleSource("hardConstraints", "allergenIds"),
            new CompatibilityRule.RuleTarget("attributes", "allergenIds"),
            null,
            "DISJOINT",
            "BLOCK",
            "RECONFIRM",
            "ALLERGEN_CONFLICT",
            null,
            null,
            null,
            null,
            "NONE"
        );
    }

    static CompatibilityRule priceLimitRule() {
        return new CompatibilityRule(
            "CHICKEN_PRICE_LIMIT",
            "가격 상한",
            new CompatibilityRule.RuleSource("hardConstraints", "maxPriceKrw"),
            new CompatibilityRule.RuleTarget("field", "price"),
            null,
            "MAX",
            "BLOCK",
            "IGNORE",
            "PRICE_LIMIT_EXCEEDED",
            null,
            null,
            null,
            null,
            "NONE"
        );
    }

    static CompatibilityRule serviceTypePreferenceRule() {
        return new CompatibilityRule(
            "CHICKEN_SERVICE_TYPE_PREFERENCE",
            "포장/매장 선호",
            new CompatibilityRule.RuleSource("preferences", "serviceType"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SERVICE_TYPE"),
            null,
            "IN",
            "WARN",
            "IGNORE",
            "SERVICE_TYPE_MISMATCH",
            null,
            null,
            null,
            null,
            "NONE"
        );
    }

    static CompatibilityRule spicyLevelPreferenceRule() {
        return new CompatibilityRule(
            "CHICKEN_SPICY_LEVEL_PREFERENCE",
            "맵기 선호",
            new CompatibilityRule.RuleSource("preferences", "spicyLevel"),
            new CompatibilityRule.RuleTarget("supportedOptions", "SPICY_LEVEL"),
            null,
            "IN",
            "WARN",
            "IGNORE",
            "SPICY_LEVEL_MISMATCH",
            null,
            null,
            null,
            null,
            "NONE"
        );
    }

    static List<CompatibilityRule> allCandidateScopeRules() {
        return List.of(
            allergenHardConstraintRule(),
            priceLimitRule(),
            serviceTypePreferenceRule(),
            spicyLevelPreferenceRule()
        );
    }

    /** allergenIds/maxPriceKrw/serviceType/spicyLevel만 채운 sessionContext. fieldMetadata는 비워둔다. */
    static ChickenStoreSessionContext sessionContext(List<AllergenId> allergenIds, BigDecimal maxPriceKrw,
                                                       ServiceType serviceType, SpicyLevel spicyLevel) {
        return sessionContext(allergenIds, maxPriceKrw, serviceType, spicyLevel, Map.of());
    }

    static ChickenStoreSessionContext sessionContext(List<AllergenId> allergenIds, BigDecimal maxPriceKrw,
                                                       ServiceType serviceType, SpicyLevel spicyLevel,
                                                       Map<String, FieldMetadata> fieldMetadata) {
        return new ChickenStoreSessionContext(
            new SessionIntent(SessionTask.ORDER_FOOD),
            new ChickenStoreFacts(),
            new ChickenStorePreferences(serviceType, spicyLevel, null, null, 1),
            new ChickenStoreHardConstraints(allergenIds, maxPriceKrw),
            new ChickenStoreCapabilities(),
            fieldMetadata
        );
    }

    static FieldMetadata fieldMetadata(double confidence, boolean confirmedByUser) {
        return new FieldMetadata(
            MetadataSource.VOICE,
            BigDecimal.valueOf(confidence),
            confirmedByUser,
            Instant.parse("2026-08-08T12:00:00Z"),
            "test-normalizer",
            null
        );
    }

    static Candidate candidate(String candidateId, double price, List<String> allergenIds,
                                List<String> supportedServiceTypes, List<String> supportedSpicyLevels) {
        return new Candidate(
            candidateId,
            candidateId + "-name",
            "chicken-store",
            true,
            "PUBLIC",
            price,
            candidateId + " 설명",
            Map.of(
                "SERVICE_TYPE", supportedServiceTypes,
                "SPICY_LEVEL", supportedSpicyLevels
            ),
            Map.of("allergenIds", allergenIds),
            Map.of(),
            Map.of()
        );
    }
}
