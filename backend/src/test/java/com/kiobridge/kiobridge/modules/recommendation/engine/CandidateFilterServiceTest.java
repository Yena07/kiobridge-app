package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.ExcludedCandidate;
import com.kiobridge.kiobridge.contracts.input.context.AllergenId;
import com.kiobridge.kiobridge.contracts.input.context.ServiceType;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import com.kiobridge.kiobridge.modules.recommendation.ChickenStoreExclusionMessages;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.allCandidateScopeRules;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.candidate;
import static com.kiobridge.kiobridge.modules.recommendation.engine.ChickenStoreTestFixtures.sessionContext;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * STEP4 filterCandidates 전체(1층 CandidateFilterService + 2층 RuleEvaluatorImpl/RuleValueResolver/
 * RuleOperatorComparator + ChickenStoreExclusionMessages)를 mock 없이 실제 구현체로 엮어서 검증한다.
 * RuleEvaluator를 mock으로 대체하지 않는 이유: 이 테스트의 목적 자체가 "STEP4 전체가 실제로
 * 끝에서 끝까지 동작하는가"를 확인하는 것이라, mock을 쓰면 그 질문에 답할 수 없다.
 */
class CandidateFilterServiceTest {

    private final CandidateFilterService filterService =
        new CandidateFilterService(new RuleEvaluatorImpl(), new ChickenStoreExclusionMessages());

    @Test
    void 정상_후보는_eligible로_가격초과와_알레르기위반은_excluded로_선호불일치는_warning으로_분류한다() {
        var ctx = sessionContext(List.of(AllergenId.PEANUT), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);

        var safe = candidate("chicken-safe", 12000, List.of("MILK"),
            List.of("TAKE_OUT", "DINE_IN"), List.of("HOT", "MEDIUM"));
        var tooExpensive = candidate("chicken-too-expensive", 20000, List.of("MILK"),
            List.of("TAKE_OUT"), List.of("HOT"));
        var hasPeanut = candidate("chicken-has-peanut", 10000, List.of("PEANUT"),
            List.of("TAKE_OUT"), List.of("HOT"));
        var dineInOnly = candidate("chicken-dine-in-only", 9000, List.of("MILK"),
            List.of("DINE_IN"), List.of("HOT"));

        CandidateFilterResult result = filterService.filter(
            List.of(safe, tooExpensive, hasPeanut, dineInOnly),
            allCandidateScopeRules(),
            ctx
        );

        assertThat(result.eligibleCandidates())
            .extracting(Candidate::candidateId)
            .containsExactly("chicken-safe", "chicken-dine-in-only");

        assertThat(result.excludedCandidates())
            .extracting(ExcludedCandidate::candidateId, ExcludedCandidate::reasonCode)
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple("chicken-too-expensive", "PRICE_LIMIT_EXCEEDED"),
                org.assertj.core.groups.Tuple.tuple("chicken-has-peanut", "ALLERGEN_CONFLICT")
            );

        assertThat(result.warningsByCandidateId()).containsOnlyKeys("chicken-dine-in-only");
        assertThat(result.warningsByCandidateId().get("chicken-dine-in-only"))
            .extracting(RuleEvaluationResult::errorCode)
            .containsExactly("SERVICE_TYPE_MISMATCH");

        assertThat(result.reconfirmationsByCandidateId()).isEmpty();
        assertThat(result.requiresReconfirmation()).isFalse();
    }

    @Test
    void 알레르기_정보가_UNKNOWN이면_제외되지않고_재확인_대상으로만_표시된다() {
        var ctx = sessionContext(List.of(AllergenId.UNKNOWN), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);

        var c1 = candidate("c1", 12000, List.of("MILK"), List.of("TAKE_OUT"), List.of("HOT"));
        var c2 = candidate("c2", 9000, List.of("EGG"), List.of("TAKE_OUT"), List.of("HOT"));

        CandidateFilterResult result = filterService.filter(
            List.of(c1, c2),
            allCandidateScopeRules(),
            ctx
        );

        // 알레르기를 몰라서 어느 후보가 안전한지 판단 불가 -> 둘 다 제외하지 않고 재확인 대상으로만 남긴다.
        assertThat(result.eligibleCandidates())
            .extracting(Candidate::candidateId)
            .containsExactly("c1", "c2");
        assertThat(result.excludedCandidates()).isEmpty();

        assertThat(result.reconfirmationsByCandidateId()).containsOnlyKeys("c1", "c2");
        assertThat(result.reconfirmationsByCandidateId().get("c1"))
            .extracting(RuleEvaluationResult::errorCode)
            .containsExactly("ALLERGEN_CONFLICT");
        assertThat(result.requiresReconfirmation()).isTrue();
    }

    @Test
    void 후보목록이_비어있으면_빈_결과를_반환한다() {
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);

        CandidateFilterResult result = filterService.filter(List.of(), allCandidateScopeRules(), ctx);

        assertThat(result.eligibleCandidates()).isEmpty();
        assertThat(result.excludedCandidates()).isEmpty();
        assertThat(result.warningsByCandidateId()).isEmpty();
        assertThat(result.reconfirmationsByCandidateId()).isEmpty();
    }

    @Test
    void null_candidates는_예외를_던진다() {
        var ctx = sessionContext(List.of(), new BigDecimal("15000"), ServiceType.TAKE_OUT, SpicyLevel.HOT);

        assertThat(
            org.junit.jupiter.api.Assertions.assertThrows(
                NullPointerException.class,
                () -> filterService.filter(null, allCandidateScopeRules(), ctx)
            )
        ).hasMessageContaining("candidates");
    }
}
