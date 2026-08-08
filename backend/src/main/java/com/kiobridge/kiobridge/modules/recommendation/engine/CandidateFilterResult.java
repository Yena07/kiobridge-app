package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.ExcludedCandidate;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * STEP4 filterCandidates 의 결과.
 *
 * eligibleCandidates — 살아남은 후보. 그대로 STEP5(recommend)로 넘긴다.
 * excludedCandidates — BLOCK 규칙 위반으로 제외된 후보. Recommendation.excludedCandidates()에 그대로 담는다.
 * warningsByCandidateId — WARN 규칙 위반 결과만 candidateId별로 모은 것. 후보를 제외하진 않지만
 *                          STEP5 점수 계산(scoreBreakdown)이나 STEP6 설명(recommendationReasons/unmetConditions)에 쓴다.
 * reconfirmationsByCandidateId — unknownPolicy==RECONFIRM으로 판정을 내릴 수 없었던 결과만 candidateId별로
 *                                모은 것. 어떤 후보가 어떤 규칙 때문에 재확인이 필요한지 알아야 unmetConditions/
 *                                recommendationReasons에 구체적인 문장을 만들 수 있어서 후보별로 유지한다.
 *
 * 주의: 이 타입은 STEP4→STEP5 사이에서만 쓰는 내부 타입이다. Kit에 실제로 제출하는
 * Recommendation.requiresReconfirmation()은 schemas/core/recommendation.schema.json 상
 * boolean으로 고정(additionalProperties:false)이라 후보별 상세 정보를 담을 수 없다.
 * RecommendationEngineService가 Recommendation을 만들 때 requiresReconfirmation() 메서드로
 * boolean을 유도해서 채워야 한다.
 */
public record CandidateFilterResult(
    List<Candidate> eligibleCandidates,
    List<ExcludedCandidate> excludedCandidates,
    Map<String, List<RuleEvaluationResult>> warningsByCandidateId,
    Map<String, List<RuleEvaluationResult>> reconfirmationsByCandidateId
) {
    public CandidateFilterResult {
        Objects.requireNonNull(eligibleCandidates, "eligibleCandidates는 null일 수 없습니다.");
        Objects.requireNonNull(excludedCandidates, "excludedCandidates는 null일 수 없습니다.");
        Objects.requireNonNull(warningsByCandidateId, "warningsByCandidateId는 null일 수 없습니다.");
        Objects.requireNonNull(reconfirmationsByCandidateId, "reconfirmationsByCandidateId는 null일 수 없습니다.");

        // 방어적 복사: 호출자가 반환된 결과의 리스트/맵을 변경해도 이 레코드 내부 상태는 영향받지 않도록 불변으로 저장한다.
        eligibleCandidates = List.copyOf(eligibleCandidates);
        excludedCandidates = List.copyOf(excludedCandidates);
        warningsByCandidateId = warningsByCandidateId.entrySet().stream()
            .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, e -> List.copyOf(e.getValue())));
        reconfirmationsByCandidateId = reconfirmationsByCandidateId.entrySet().stream()
            .collect(Collectors.toUnmodifiableMap(Map.Entry::getKey, e -> List.copyOf(e.getValue())));
    }

    /**
     * Recommendation.requiresReconfirmation()(boolean, Kit 스키마 고정)을 채울 때 쓰는 유도 값.
     * 하나라도 재확인이 필요한 후보가 있으면 true.
     */
    public boolean requiresReconfirmation() {
        return !reconfirmationsByCandidateId.isEmpty();
    }
}
