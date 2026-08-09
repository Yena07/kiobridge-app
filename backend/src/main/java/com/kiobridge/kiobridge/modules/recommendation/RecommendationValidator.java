package com.kiobridge.kiobridge.modules.recommendation;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.ExcludedCandidate;
import com.kiobridge.kiobridge.contracts.Recommendation;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * RecommendationEngineService가 만든 Recommendation을 담당3에게 넘기기 전 자체 검증한다.
 * Kit의 공식 /validate API가 최종적으로 다시 검사하지만, 그 전에 여기서 잡아내면
 * 원격 호출 없이 로컬에서 바로 버그를 확인할 수 있다.
 */
@Service
public class RecommendationValidator {

    // ERROR_CATALOG에 실제로 있는 코드
    private static final String CANDIDATE_NOT_FOUND = "CANDIDATE_NOT_FOUND";
    private static final String CANDIDATE_UNAVAILABLE = "CANDIDATE_UNAVAILABLE";
    private static final String EXCLUDED_CANDIDATE_NOT_FOUND = "EXCLUDED_CANDIDATE_NOT_FOUND";

    // 팀 내부 전용 코드 (Kit 공식 ERROR_CATALOG엔 없음, 우리 쪽 정합성 체크용)
    private static final String EXCLUDED_CANDIDATE_ID_UNKNOWN = "EXCLUDED_CANDIDATE_ID_UNKNOWN";
    private static final String ALTERNATIVE_DUPLICATES_RECOMMENDED = "ALTERNATIVE_DUPLICATES_RECOMMENDED";
    private static final String ALTERNATIVE_CANDIDATE_DUPLICATED = "ALTERNATIVE_CANDIDATE_DUPLICATED";
    private static final String ALTERNATIVES_WITHOUT_RECOMMENDATION = "ALTERNATIVES_WITHOUT_RECOMMENDATION";
    private static final String RECOMMENDATION_REASONS_EMPTY = "RECOMMENDATION_REASONS_EMPTY";
    private static final String CONFIDENCE_OUT_OF_RANGE = "CONFIDENCE_OUT_OF_RANGE";

    private static final String RECOMMENDED_CANDIDATE_PATH = "/recommendation/recommendedCandidateId";
    private static final String RECOMMENDATION_REASONS_PATH = "/recommendation/recommendationReasons";
    private static final String CONFIDENCE_PATH = "/recommendation/confidence";

    private static final double MIN_CONFIDENCE = 0.0;
    private static final double MAX_CONFIDENCE = 1.0;

    public ValidationOutcome validate(Recommendation recommendation, List<Candidate> allCandidates) {
        Objects.requireNonNull(recommendation, "recommendation은 null일 수 없습니다.");
        Objects.requireNonNull(allCandidates, "allCandidates는 null일 수 없습니다.");

        Map<String, Candidate> candidatesById = indexById(allCandidates);
        Set<String> excludedCandidateIds = excludedCandidateIds(recommendation);

        List<ValidationIssue> issues = new ArrayList<>();
        issues.addAll(validateRecommendedCandidate(recommendation, candidatesById, excludedCandidateIds));
        issues.addAll(validateAlternativeCandidates(recommendation, candidatesById, excludedCandidateIds));
        issues.addAll(validateExcludedCandidateIds(recommendation, candidatesById));
        issues.addAll(validateRecommendationReasons(recommendation));
        issues.addAll(validateConfidence(recommendation));

        return ValidationOutcome.of(List.copyOf(issues));
    }

    private static Map<String, Candidate> indexById(List<Candidate> candidates) {
        return candidates.stream()
            .collect(Collectors.toUnmodifiableMap(Candidate::candidateId, Function.identity(), (first, second) -> first));
    }

    private static Set<String> excludedCandidateIds(Recommendation recommendation) {
        return recommendation.excludedCandidates().stream()
            .map(ExcludedCandidate::candidateId)
            .collect(Collectors.toUnmodifiableSet());
    }

    // ------------------------------------------------------------------
    // recommendedCandidateId
    // ------------------------------------------------------------------

    private static List<ValidationIssue> validateRecommendedCandidate(
        Recommendation recommendation, Map<String, Candidate> candidatesById, Set<String> excludedCandidateIds
    ) {
        String recommendedCandidateId = recommendation.recommendedCandidateId();

        if (recommendedCandidateId == null) {
            return recommendation.alternativeCandidateIds().isEmpty()
                ? List.of()
                : List.of(new ValidationIssue(ALTERNATIVES_WITHOUT_RECOMMENDATION,
                    "recommendedCandidateId가 없는데 alternativeCandidateIds가 채워져 있습니다.", RECOMMENDED_CANDIDATE_PATH));
        }

        if (excludedCandidateIds.contains(recommendedCandidateId)) {
            return List.of(new ValidationIssue(EXCLUDED_CANDIDATE_NOT_FOUND,
                "recommendedCandidateId=" + recommendedCandidateId + "는 이미 제외된 후보입니다.", RECOMMENDED_CANDIDATE_PATH));
        }

        Candidate recommended = candidatesById.get(recommendedCandidateId);
        if (recommended == null) {
            return List.of(new ValidationIssue(CANDIDATE_NOT_FOUND,
                "recommendedCandidateId=" + recommendedCandidateId + "가 후보 목록에 없습니다.", RECOMMENDED_CANDIDATE_PATH));
        }
        if (!Boolean.TRUE.equals(recommended.available())) {
            return List.of(new ValidationIssue(CANDIDATE_UNAVAILABLE,
                "recommendedCandidateId=" + recommendedCandidateId + "는 품절 상태입니다.", RECOMMENDED_CANDIDATE_PATH));
        }
        return List.of();
    }

    // ------------------------------------------------------------------
    // alternativeCandidateIds
    // ------------------------------------------------------------------

    private static List<ValidationIssue> validateAlternativeCandidates(
        Recommendation recommendation, Map<String, Candidate> candidatesById, Set<String> excludedCandidateIds
    ) {
        List<String> alternativeCandidateIds = recommendation.alternativeCandidateIds();
        List<ValidationIssue> issues = new ArrayList<>();
        Set<String> seenCandidateIds = new HashSet<>();

        for (int index = 0; index < alternativeCandidateIds.size(); index++) {
            String candidateId = alternativeCandidateIds.get(index);
            String path = "/recommendation/alternativeCandidateIds/" + index;

            if (!seenCandidateIds.add(candidateId)) {
                issues.add(new ValidationIssue(ALTERNATIVE_CANDIDATE_DUPLICATED,
                    "alternativeCandidateIds에 " + candidateId + "가 중복으로 들어있습니다.", path));
                continue;
            }

            validateAlternativeCandidate(candidateId, path, recommendation.recommendedCandidateId(), candidatesById, excludedCandidateIds)
                .ifPresent(issues::add);
        }

        return List.copyOf(issues);
    }

    private static Optional<ValidationIssue> validateAlternativeCandidate(
        String candidateId, String path, String recommendedCandidateId, Map<String, Candidate> candidatesById, Set<String> excludedCandidateIds
    ) {
        if (candidateId.equals(recommendedCandidateId)) {
            return Optional.of(new ValidationIssue(ALTERNATIVE_DUPLICATES_RECOMMENDED,
                "alternativeCandidateIds에 recommendedCandidateId(" + candidateId + ")가 중복으로 들어있습니다.", path));
        }
        if (excludedCandidateIds.contains(candidateId)) {
            return Optional.of(new ValidationIssue(EXCLUDED_CANDIDATE_NOT_FOUND,
                "제외됐던 후보(" + candidateId + ")가 대안으로 다시 포함됐습니다.", path));
        }

        Candidate alternative = candidatesById.get(candidateId);
        if (alternative == null) {
            return Optional.of(new ValidationIssue(CANDIDATE_NOT_FOUND,
                "alternativeCandidateIds의 " + candidateId + "가 후보 목록에 없습니다.", path));
        }
        if (!Boolean.TRUE.equals(alternative.available())) {
            return Optional.of(new ValidationIssue(CANDIDATE_UNAVAILABLE,
                "alternativeCandidateIds의 " + candidateId + "는 품절 상태입니다.", path));
        }
        return Optional.empty();
    }

    // ------------------------------------------------------------------
    // excludedCandidates
    // ------------------------------------------------------------------

    private static List<ValidationIssue> validateExcludedCandidateIds(Recommendation recommendation, Map<String, Candidate> candidatesById) {
        List<ExcludedCandidate> excludedCandidates = recommendation.excludedCandidates();
        return IntStream.range(0, excludedCandidates.size())
            .filter(index -> !candidatesById.containsKey(excludedCandidates.get(index).candidateId()))
            .mapToObj(index -> new ValidationIssue(EXCLUDED_CANDIDATE_ID_UNKNOWN,
                "excludedCandidates의 " + excludedCandidates.get(index).candidateId() + "가 후보 목록에 없습니다.",
                "/recommendation/excludedCandidates/" + index))
            .toList();
    }

    // ------------------------------------------------------------------
    // recommendationReasons / confidence
    // ------------------------------------------------------------------

    private static List<ValidationIssue> validateRecommendationReasons(Recommendation recommendation) {
        return recommendation.recommendationReasons().isEmpty()
            ? List.of(new ValidationIssue(RECOMMENDATION_REASONS_EMPTY,
                "recommendationReasons는 최소 1개 이상이어야 합니다.", RECOMMENDATION_REASONS_PATH))
            : List.of();
    }

    private static List<ValidationIssue> validateConfidence(Recommendation recommendation) {
        Double confidence = recommendation.confidence();
        boolean outOfRange = confidence == null || confidence < MIN_CONFIDENCE || confidence > MAX_CONFIDENCE;
        return outOfRange
            ? List.of(new ValidationIssue(CONFIDENCE_OUT_OF_RANGE,
                "confidence는 0~1 사이여야 합니다. 현재 값=" + confidence, CONFIDENCE_PATH))
            : List.of();
    }
}
