package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRuleSet;
import com.kiobridge.kiobridge.contracts.PublicFixture;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.input.context.BoneType;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreCapabilities;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreFacts;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreHardConstraints;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStorePreferences;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.context.CupOption;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SessionIntent;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;

import java.util.List;
import java.util.Map;

/**
 * modules/executionplan/service 테스트 전용 픽스처.
 * option-groups.json / candidates.json은 environments/chicken-store의 실제 데이터를 그대로 옮겨온다
 * (ChickenStoreTestFixtures와 같은 원칙 — 실제 Kit 데이터와 어긋나면 테스트도 의미 없음).
 */
final class ExecutionPlanTestFixtures {

    private ExecutionPlanTestFixtures() {
    }

    /** environments/chicken-store/option-groups.json 그대로. */
    static List<Map<String, Object>> optionGroups() {
        return List.of(
            Map.of(
                "groupId", "SERVICE_TYPE", "kind", "service_type", "required", true,
                "options", List.of(
                    Map.of("id", "DINE_IN", "label", "먹고 가기"),
                    Map.of("id", "TAKE_OUT", "label", "포장하기")
                )
            ),
            Map.of(
                "groupId", "SPICY_LEVEL", "kind", "option", "required", true,
                "options", List.of(
                    Map.of("id", "MILD", "label", "순한맛"),
                    Map.of("id", "MEDIUM", "label", "보통맛"),
                    Map.of("id", "HOT", "label", "매운맛")
                )
            ),
            Map.of(
                "groupId", "BONE_TYPE", "kind", "option", "required", true,
                "options", List.of(
                    Map.of("id", "BONE", "label", "뼈"),
                    Map.of("id", "BONELESS", "label", "순살")
                )
            ),
            Map.of(
                "groupId", "CUP", "kind", "option", "required", false,
                "options", List.of(
                    Map.of("id", "PAPER", "label", "종이컵"),
                    Map.of("id", "REGULAR", "label", "일반컵")
                )
            ),
            Map.of(
                "groupId", "QUANTITY", "kind", "option", "required", true,
                "options", List.of(
                    Map.of("id", "Q1", "label", "1개", "value", 1),
                    Map.of("id", "Q2", "label", "2개", "value", 2),
                    Map.of("id", "Q3", "label", "3개", "value", 3)
                )
            )
        );
    }

    /** 모든 그룹의 모든 옵션을 지원하는 candidate. candidateId만 바꿔 재사용한다. */
    static Candidate candidate(String candidateId) {
        return candidate(candidateId, Map.of(
            "SERVICE_TYPE", List.of("DINE_IN", "TAKE_OUT"),
            "SPICY_LEVEL", List.of("MILD", "MEDIUM", "HOT"),
            "BONE_TYPE", List.of("BONE", "BONELESS"),
            "CUP", List.of("PAPER", "REGULAR"),
            "QUANTITY", List.of("Q1", "Q2", "Q3")
        ));
    }

    /**
     * supportedOptions를 직접 지정하는 candidate. 실제 candidates.json처럼 그룹별 지원값이
     * 좁게 제한된 후보(예: SPICY_LEVEL을 MILD 하나만 지원)를 만들 때 쓴다.
     */
    static Candidate candidate(String candidateId, Map<String, List<String>> supportedOptions) {
        return new Candidate(
            candidateId,
            candidateId + "-name",
            "chicken-store",
            true,
            "PUBLIC",
            9900.0,
            candidateId + " 설명",
            supportedOptions,
            Map.of(),
            Map.of(),
            Map.of()
        );
    }

    /** 아무 그룹도 지원값을 안 주는 candidate (폴백이 그룹 첫 옵션까지 내려가는지 검증용). */
    static Candidate candidateWithoutSupportedOptions(String candidateId) {
        return new Candidate(
            candidateId, candidateId + "-name", "chicken-store", true, "PUBLIC", 9900.0,
            candidateId + " 설명", Map.of(), Map.of(), Map.of(), Map.of()
        );
    }

    static PublicFixture fixture(Candidate... candidates) {
        return new PublicFixture(
            Map.of(),
            List.of(candidates),
            optionGroups(),
            new CompatibilityRuleSet("1.0.0", "chicken-store", List.of())
        );
    }

    static ChickenStoreSessionContext sessionContext(
        ServiceType serviceType, SpicyLevel spicyLevel, BoneType boneType, CupOption cupOption, Integer quantity
    ) {
        return new ChickenStoreSessionContext(
            new SessionIntent(SessionTask.ORDER_FOOD),
            new ChickenStoreFacts(),
            new ChickenStorePreferences(serviceType, spicyLevel, boneType, cupOption, quantity),
            new ChickenStoreHardConstraints(null, null),
            new ChickenStoreCapabilities(),
            Map.of()
        );
    }

    static Recommendation recommendation(String recommendedCandidateId) {
        return new Recommendation(
            recommendedCandidateId,
            List.of(),
            List.of(),
            Map.of(),
            List.of("테스트 추천 사유"),
            List.of(),
            0.9,
            false
        );
    }
}
