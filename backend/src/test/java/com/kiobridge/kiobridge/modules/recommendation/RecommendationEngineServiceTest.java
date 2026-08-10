package com.kiobridge.kiobridge.modules.recommendation;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.ExcludedCandidate;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreCapabilities;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreFacts;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreHardConstraints;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStorePreferences;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SessionIntent;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import com.kiobridge.kiobridge.contracts.input.profile.Accessibility;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;
import com.kiobridge.kiobridge.contracts.input.profile.CollectionChannel;
import com.kiobridge.kiobridge.contracts.input.profile.Consent;
import com.kiobridge.kiobridge.contracts.input.profile.DataClassification;
import com.kiobridge.kiobridge.contracts.input.profile.Interaction;
import com.kiobridge.kiobridge.contracts.input.profile.PreferredInput;
import com.kiobridge.kiobridge.contracts.input.profile.ProfileSource;
import com.kiobridge.kiobridge.contracts.input.profile.RetentionPolicy;
import com.kiobridge.kiobridge.modules.recommendation.engine.CandidateFilterResult;
import com.kiobridge.kiobridge.modules.recommendation.engine.RuleEvaluationResult;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

class RecommendationEngineServiceTest {

    private final RecommendationEngineService service = new RecommendationEngineService();

    @Test
    void 적격_후보가_없으면_추천ID는_null이고_이유는_최소_1개다() {
        CandidateFilterResult filterResult = new CandidateFilterResult(List.of(), List.of(), Map.of(), Map.of(), Map.of());

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.recommendedCandidateId()).isNull();
        assertThat(recommendation.alternativeCandidateIds()).isEmpty();
        assertThat(recommendation.recommendationReasons()).isNotEmpty();
        assertThat(recommendation.confidence()).isEqualTo(0.0);
        assertThat(recommendation.requiresReconfirmation()).isFalse();
    }

    @Test
    void WARN이_없는_후보가_1순위로_선정되고_대안은_점수순으로_담긴다() {
        Candidate clean = candidate("CHICKEN-CLEAN", 6000.0, List.of("HOT"));
        Candidate oneWarn = candidate("CHICKEN-ONE-WARN", 6000.0, List.of("HOT"));
        Candidate twoWarns = candidate("CHICKEN-TWO-WARNS", 6000.0, List.of("MILD"));

        Map<String, List<RuleEvaluationResult>> warnings = Map.of(
            oneWarn.candidateId(), List.of(serviceTypeMismatch()),
            twoWarns.candidateId(), List.of(serviceTypeMismatch(), spicyLevelMismatch())
        );
        // clean/oneWarn은 WARN이 없는 항목에 대해 실제로 PASS까지 났다고 가정한다 (사용자가 TAKE_OUT/HOT을
        // 명시했고 후보도 이를 지원함). PASS가 없으면 "WARN 없음"을 "일치"로 오인하는 버그가 재현된다.
        Map<String, List<RuleEvaluationResult>> passes = Map.of(
            clean.candidateId(), List.of(serviceTypePass(), spicyLevelPass()),
            oneWarn.candidateId(), List.of(spicyLevelPass())
        );

        CandidateFilterResult filterResult =
            new CandidateFilterResult(List.of(clean, oneWarn, twoWarns), List.of(), warnings, Map.of(), passes);

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.recommendedCandidateId()).isEqualTo("CHICKEN-CLEAN");
        assertThat(recommendation.alternativeCandidateIds())
            .containsExactly("CHICKEN-ONE-WARN", "CHICKEN-TWO-WARNS");
        assertThat(recommendation.confidence()).isCloseTo(0.89, offset(0.0001));
        assertThat(recommendation.requiresReconfirmation()).isFalse();
        assertThat(recommendation.recommendationReasons()).containsExactly(
            "선호하신 이용 방식과 일치하는 메뉴라 우선 추천드립니다.",
            "선호하신 맵기와 맞는 메뉴라 우선 추천드립니다."
        );
    }

    @Test
    void WARN도_PASS도_없이_SKIPPED로_끝난_항목은_일치_보너스나_일치_사유를_받지_않는다() {
        // 사용자가 이 항목에 대해 아무 선호도 밝히지 않은 경우(중립값, absentMeans=NONE, unknownPolicy=IGNORE/ALLOW 등)
        // RuleEvaluatorImpl은 WARN도 PASS도 안 남기고 SKIPPED로 끝낸다. STEP4가 이걸 그대로 전달하면
        // (= warningsByCandidateId/passesByCandidateId 둘 다 비어있으면) "일치"라고 단정하면 안 된다.
        Candidate onlyCandidate = candidate("CHICKEN-NEUTRAL", 6000.0, List.of("HOT"));

        CandidateFilterResult filterResult =
            new CandidateFilterResult(List.of(onlyCandidate), List.of(), Map.of(), Map.of(), Map.of());

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.scoreBreakdown().get("serviceTypeMatch")).isEqualTo(0.0);
        assertThat(recommendation.scoreBreakdown().get("spicyLevelMatch")).isEqualTo(0.0);
        assertThat(recommendation.recommendationReasons())
            .containsExactly("남은 후보 중 조건에 가장 가까운 메뉴라 추천드립니다.");
    }

    @Test
    void 추천_후보_본인이_RECONFIRM이면_확신도가_낮아지고_재확인이_필요하다() {
        Candidate onlyCandidate = candidate("CHICKEN-UNSURE", 6000.0, List.of("HOT"));

        Map<String, List<RuleEvaluationResult>> reconfirmations =
            Map.of(onlyCandidate.candidateId(), List.of(allergenReconfirm()));

        CandidateFilterResult filterResult =
            new CandidateFilterResult(List.of(onlyCandidate), List.of(), Map.of(), reconfirmations, Map.of());

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.recommendedCandidateId()).isEqualTo("CHICKEN-UNSURE");
        assertThat(recommendation.confidence()).isCloseTo(0.5, offset(0.0001));
        assertThat(recommendation.requiresReconfirmation()).isTrue();
    }

    @Test
    void 추천_후보가_아닌_대안의_RECONFIRM은_결과에_영향을_주지_않는다() {
        Candidate best = candidate("CHICKEN-A", 6000.0, List.of("HOT"));
        Candidate worse = candidate("CHICKEN-B", 6000.0, List.of("HOT"));

        Map<String, List<RuleEvaluationResult>> warnings = Map.of(worse.candidateId(), List.of(serviceTypeMismatch()));
        Map<String, List<RuleEvaluationResult>> reconfirmations = Map.of(worse.candidateId(), List.of(allergenReconfirm()));
        // best는 두 항목 다, worse는 WARN 안 뜬 맵기만 실제로 PASS났다고 가정한다 (둘 다 HOT을 지원하니까).
        // 이게 없으면 두 후보 점수 격차가 좁아져서 confidence가 재확인 임계값(0.6) 밑으로 떨어져버린다.
        Map<String, List<RuleEvaluationResult>> passes = Map.of(
            best.candidateId(), List.of(serviceTypePass(), spicyLevelPass()),
            worse.candidateId(), List.of(spicyLevelPass())
        );

        CandidateFilterResult filterResult =
            new CandidateFilterResult(List.of(best, worse), List.of(), warnings, reconfirmations, passes);

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.recommendedCandidateId()).isEqualTo("CHICKEN-A");
        assertThat(recommendation.requiresReconfirmation()).isFalse();
    }

    @Test
    void survivors가_1개면_WARN_개수_기반으로_확신도를_계산한다() {
        Candidate onlyCandidate = candidate("CHICKEN-SOLO", 6000.0, List.of("HOT"));

        Map<String, List<RuleEvaluationResult>> warnings = Map.of(onlyCandidate.candidateId(), List.of(serviceTypeMismatch()));

        CandidateFilterResult filterResult =
            new CandidateFilterResult(List.of(onlyCandidate), List.of(), warnings, Map.of(), Map.of());

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.confidence()).isCloseTo(0.65, offset(0.0001));
        assertThat(recommendation.requiresReconfirmation()).isFalse();
    }

    @Test
    void excludedCandidates는_그대로_Recommendation에_전달된다() {
        Candidate eligible = candidate("CHICKEN-OK", 6000.0, List.of("HOT"));
        ExcludedCandidate excluded =
            new ExcludedCandidate("CHICKEN-PEANUT", "ALLERGEN_CONFLICT", null, "땅콩 알레르기와 겹쳐 제외");

        CandidateFilterResult filterResult =
            new CandidateFilterResult(List.of(eligible), List.of(excluded), Map.of(), Map.of(), Map.of());

        Recommendation recommendation = service.recommend(filterResult, sessionContext(null), profile());

        assertThat(recommendation.excludedCandidates()).containsExactly(excluded);
    }

    // ------------------------------------------------------------------
    // fixtures
    // ------------------------------------------------------------------

    private RuleEvaluationResult serviceTypeMismatch() {
        return RuleEvaluationResult.fail(
            "CHICKEN_SERVICE_TYPE_PREFERENCE", "WARN", "SERVICE_TYPE_MISMATCH", "TAKE_OUT", List.of("DINE_IN"));
    }

    private RuleEvaluationResult spicyLevelMismatch() {
        return RuleEvaluationResult.fail(
            "CHICKEN_SPICY_LEVEL_PREFERENCE", "WARN", "SPICY_LEVEL_MISMATCH", "HOT", List.of("MILD"));
    }

    private RuleEvaluationResult serviceTypePass() {
        return RuleEvaluationResult.pass(
            "CHICKEN_SERVICE_TYPE_PREFERENCE", "TAKE_OUT", List.of("DINE_IN", "TAKE_OUT"));
    }

    private RuleEvaluationResult spicyLevelPass() {
        return RuleEvaluationResult.pass(
            "CHICKEN_SPICY_LEVEL_PREFERENCE", "HOT", List.of("HOT"));
    }

    private RuleEvaluationResult allergenReconfirm() {
        return RuleEvaluationResult.reconfirm(
            "CHICKEN_ALLERGEN_HARD_CONSTRAINT", "LOW_CONFIDENCE_RECONFIRMATION_REQUIRED", "UNKNOWN");
    }

    private Candidate candidate(String candidateId, Double price, List<String> spicyLevels) {
        return new Candidate(
            candidateId, "테스트 후보", "chicken-store", true, "SYNTHETIC_MOCK",
            price, null,
            Map.of("SERVICE_TYPE", List.of("DINE_IN", "TAKE_OUT"), "SPICY_LEVEL", spicyLevels),
            Map.of(), Map.of(), Map.of()
        );
    }

    private ChickenStoreSessionContext sessionContext(java.math.BigDecimal maxPriceKrw) {
        return new ChickenStoreSessionContext(
            new SessionIntent(SessionTask.ORDER_FOOD),
            new ChickenStoreFacts(),
            new ChickenStorePreferences(ServiceType.TAKE_OUT, SpicyLevel.HOT, null, null, null),
            new ChickenStoreHardConstraints(List.of(), maxPriceKrw),
            new ChickenStoreCapabilities(),
            Map.of()
        );
    }

    private CanonicalProfile profile() {
        return new CanonicalProfile(
            "user_test_001",
            "테스트 사용자",
            DataClassification.SYNTHETIC_PROFILE,
            new ProfileSource(CollectionChannel.WEB_FORM, "TEST", Instant.parse("2026-08-01T00:00:00Z")),
            new Accessibility(false, false, false, false, false, false, false),
            new Interaction(PreferredInput.TOUCH, "ko-KR", true),
            new Consent(false, RetentionPolicy.SESSION_ONLY)
        );
    }
}
