package com.kiobridge.kiobridge.modules.recommendation;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.context.SpicyLevel;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;
import com.kiobridge.kiobridge.modules.recommendation.engine.CandidateFilterResult;
import com.kiobridge.kiobridge.modules.recommendation.engine.RuleEvaluationResult;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

//STEP5~7(recommend / explainRecommendation / buildAlternatives)을 한 곳에서 처리한다.
@Service
public class RecommendationEngineService {

    private static final String SERVICE_TYPE_MISMATCH_CODE = "SERVICE_TYPE_MISMATCH";
    private static final String SPICY_LEVEL_MISMATCH_CODE = "SPICY_LEVEL_MISMATCH";
    private static final String SPICY_LEVEL_OPTION_KEY = "SPICY_LEVEL";

    private static final String SERVICE_TYPE_SCORE_KEY = "serviceTypeMatch";
    private static final String SPICY_LEVEL_SCORE_KEY = "spicyLevelMatch";
    private static final String PRICE_SCORE_KEY = "priceScore";

    private static final double PREFERENCE_MATCH_BONUS = 1.0;
    private static final double PREFERENCE_MISMATCH_PENALTY = -0.3;
    private static final double PREFERENCE_PARTIAL_MISMATCH_PENALTY = -0.15;
    private static final int ADJACENT_SPICY_LEVEL_DISTANCE = 1;
    private static final int UNRESOLVABLE_SPICY_LEVEL_DISTANCE = Integer.MAX_VALUE;

    private static final double PRICE_SCORE_WEIGHT = 0.5;

    private static final int MAX_ALTERNATIVE_CANDIDATES = 2;

    private static final double SINGLE_CANDIDATE_BASE_CONFIDENCE = 0.8;
    private static final double SINGLE_CANDIDATE_WARNING_PENALTY = 0.15;
    private static final double CONFIDENCE_BASE_FLOOR = 0.5;
    private static final double CONFIDENCE_GAP_SCALE = 0.3;
    private static final double RECONFIRMATION_CONFIDENCE_CAP = 0.5;
    private static final double LOW_CONFIDENCE_THRESHOLD = 0.6;
    private static final double MIN_CONFIDENCE = 0.0;
    private static final double MAX_CONFIDENCE = 1.0;

    private static final String NO_ELIGIBLE_CANDIDATE_REASON = "조건에 맞는 메뉴를 찾지 못해 추천드릴 항목이 없습니다.";
    private static final String SERVICE_TYPE_MATCH_REASON = "선호하신 이용 방식과 일치하는 메뉴라 우선 추천드립니다.";
    private static final String SPICY_LEVEL_MATCH_REASON = "선호하신 맵기와 맞는 메뉴라 우선 추천드립니다.";
    private static final String BEST_REMAINING_REASON = "남은 후보 중 조건에 가장 가까운 메뉴라 추천드립니다.";
    private static final String RECONFIRMATION_REASON = "일부 정보의 확신도가 낮아 다시 확인이 필요합니다.";
    private static final String SERVICE_TYPE_UNMET_TEXT = "선호하신 이용 방식과 다릅니다.";
    private static final String SPICY_LEVEL_UNMET_TEXT = "선호하신 맵기와 다릅니다.";
    private static final String RECONFIRMATION_UNMET_TEXT = "확신도가 낮아 재확인이 필요한 항목이 있습니다.";

    private static final Comparator<ScoredCandidate> RANKING_COMPARATOR =
        Comparator.comparingDouble(ScoredCandidate::totalScore).reversed()
            .thenComparing(scored -> Optional.ofNullable(scored.candidate().price()).orElse(Double.MAX_VALUE))
            .thenComparing(scored -> scored.candidate().candidateId());

    private record ScoredCandidate(Candidate candidate, double totalScore, Map<String, Double> scoreBreakdown) {}

    //메인 진입점
    public Recommendation recommend(CandidateFilterResult filterResult, ChickenStoreSessionContext ctx, CanonicalProfile profile) {
        Objects.requireNonNull(filterResult, "filterResult는 null일 수 없습니다.");
        Objects.requireNonNull(ctx, "ctx는 null일 수 없습니다.");
        Objects.requireNonNull(profile, "profile은 null일 수 없습니다.");

        if (filterResult.eligibleCandidates().isEmpty()) {
            return buildNoEligibleCandidateRecommendation(filterResult);
        }

        List<ScoredCandidate> rankedCandidates = filterResult.eligibleCandidates().stream()
            .map(candidate -> scoreCandidate(candidate, ctx, filterResult))
            .sorted(RANKING_COMPARATOR)
            .toList();

        ScoredCandidate topCandidate = rankedCandidates.getFirst();
        String recommendedCandidateId = topCandidate.candidate().candidateId();

        List<RuleEvaluationResult> recommendedWarnings =
            filterResult.warningsByCandidateId().getOrDefault(recommendedCandidateId, List.of());
        boolean recommendedNeedsReconfirmation =
            !filterResult.reconfirmationsByCandidateId().getOrDefault(recommendedCandidateId, List.of()).isEmpty();

        double confidence = computeConfidence(rankedCandidates, recommendedNeedsReconfirmation);
        boolean requiresReconfirmation = recommendedNeedsReconfirmation || confidence < LOW_CONFIDENCE_THRESHOLD;

        return new Recommendation(
            recommendedCandidateId,
            buildAlternativeCandidateIds(rankedCandidates, recommendedCandidateId),
            filterResult.excludedCandidates(),
            topCandidate.scoreBreakdown(),
            buildRecommendationReasons(recommendedWarnings, recommendedNeedsReconfirmation),
            buildUnmetConditions(recommendedWarnings, recommendedNeedsReconfirmation),
            confidence,
            requiresReconfirmation
        );
    }

    private static Recommendation buildNoEligibleCandidateRecommendation(CandidateFilterResult filterResult) {
        return new Recommendation(
            null,
            List.of(),
            filterResult.excludedCandidates(),
            Map.of(),
            List.of(NO_ELIGIBLE_CANDIDATE_REASON),
            List.of(),
            MIN_CONFIDENCE,
            false
        );
    }

    // 점수 계산 (STEP5)

    private static ScoredCandidate scoreCandidate(Candidate candidate, ChickenStoreSessionContext ctx, CandidateFilterResult filterResult) {
        List<RuleEvaluationResult> warnings =
            filterResult.warningsByCandidateId().getOrDefault(candidate.candidateId(), List.of());
        Map<String, Double> scoreBreakdown = buildScoreBreakdown(candidate, ctx, warnings);
        double totalScore = scoreBreakdown.values().stream().mapToDouble(Double::doubleValue).sum();
        return new ScoredCandidate(candidate, totalScore, scoreBreakdown);
    }

    private static Map<String, Double> buildScoreBreakdown(Candidate candidate, ChickenStoreSessionContext ctx, List<RuleEvaluationResult> warnings) {
        Map<String, Double> scoreBreakdown = new LinkedHashMap<>();
        scoreBreakdown.put(SERVICE_TYPE_SCORE_KEY, scoreServiceType(warnings));
        scoreBreakdown.put(SPICY_LEVEL_SCORE_KEY, scoreSpicyLevel(candidate, ctx, warnings));
        scoreBreakdown.put(PRICE_SCORE_KEY, scorePrice(candidate, ctx));
        return Map.copyOf(scoreBreakdown);
    }

    private static double scoreServiceType(List<RuleEvaluationResult> warnings) {
        return hasWarning(warnings, SERVICE_TYPE_MISMATCH_CODE) ? PREFERENCE_MISMATCH_PENALTY : PREFERENCE_MATCH_BONUS;
    }

    private static double scoreSpicyLevel(Candidate candidate, ChickenStoreSessionContext ctx, List<RuleEvaluationResult> warnings) {
        if (!hasWarning(warnings, SPICY_LEVEL_MISMATCH_CODE)) {
            return PREFERENCE_MATCH_BONUS;
        }
        int distance = spicyLevelDistance(ctx.preferences().spicyLevel(), candidateSupportedSpicyLevels(candidate));
        return distance <= ADJACENT_SPICY_LEVEL_DISTANCE ? PREFERENCE_PARTIAL_MISMATCH_PENALTY : PREFERENCE_MISMATCH_PENALTY;
    }

    private static List<String> candidateSupportedSpicyLevels(Candidate candidate) {
        return candidate.supportedOptions() == null
            ? List.of()
            : candidate.supportedOptions().getOrDefault(SPICY_LEVEL_OPTION_KEY, List.of());
    }

    private static int spicyLevelDistance(SpicyLevel userLevel, List<String> candidateSupportedLevels) {
        if (userLevel == null || isNeutralSpicyLevel(userLevel)) {
            return UNRESOLVABLE_SPICY_LEVEL_DISTANCE;
        }
        return candidateSupportedLevels.stream()
            .map(RecommendationEngineService::parseSpicyLevel)
            .filter(Objects::nonNull)
            .filter(level -> !isNeutralSpicyLevel(level))
            .mapToInt(level -> Math.abs(level.ordinal() - userLevel.ordinal()))
            .min()
            .orElse(UNRESOLVABLE_SPICY_LEVEL_DISTANCE);
    }

    private static SpicyLevel parseSpicyLevel(String rawValue) {
        try {
            return SpicyLevel.valueOf(rawValue);
        } catch (IllegalArgumentException | NullPointerException ex) {
            return null;
        }
    }

    private static boolean isNeutralSpicyLevel(SpicyLevel level) {
        return level == SpicyLevel.NO_PREFERENCE || level == SpicyLevel.UNKNOWN;
    }

    private static double scorePrice(Candidate candidate, ChickenStoreSessionContext ctx) {
        BigDecimal maxPriceKrw = ctx.hardConstraints().maxPriceKrw();
        if (maxPriceKrw == null || maxPriceKrw.signum() <= 0 || candidate.price() == null) {
            return 0.0;
        }
        double remainingBudgetRatio = 1 - (candidate.price() / maxPriceKrw.doubleValue());
        return PRICE_SCORE_WEIGHT * clamp(remainingBudgetRatio, 0.0, 1.0);
    }

    private static boolean hasWarning(List<RuleEvaluationResult> warnings, String errorCode) {
        return warnings.stream().anyMatch(warning -> errorCode.equals(warning.errorCode()));
    }

    private static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    // confidence / requiresReconfirmation

    private static double computeConfidence(List<ScoredCandidate> rankedCandidates, boolean recommendedNeedsReconfirmation) {
        double baseConfidence = rankedCandidates.size() == 1
            ? computeSingleCandidateConfidence(rankedCandidates.get(0))
            : computeRankingGapConfidence(rankedCandidates.get(0), rankedCandidates.get(1));

        double effectiveConfidence = recommendedNeedsReconfirmation
            ? Math.min(baseConfidence, RECONFIRMATION_CONFIDENCE_CAP)
            : baseConfidence;

        return clamp(effectiveConfidence, MIN_CONFIDENCE, MAX_CONFIDENCE);
    }

    private static double computeSingleCandidateConfidence(ScoredCandidate onlyCandidate) {
        long mismatchCount = onlyCandidate.scoreBreakdown().values().stream().filter(score -> score < 0).count();
        return clamp(SINGLE_CANDIDATE_BASE_CONFIDENCE - mismatchCount * SINGLE_CANDIDATE_WARNING_PENALTY, MIN_CONFIDENCE, MAX_CONFIDENCE);
    }

    private static double computeRankingGapConfidence(ScoredCandidate first, ScoredCandidate second) {
        double scoreGap = first.totalScore() - second.totalScore();
        return clamp(CONFIDENCE_BASE_FLOOR + scoreGap * CONFIDENCE_GAP_SCALE, MIN_CONFIDENCE, MAX_CONFIDENCE);
    }

    // STEP6 recommendationReasons / unmetConditions, STEP7 alternativeCandidateIds

    private static List<String> buildRecommendationReasons(List<RuleEvaluationResult> recommendedWarnings, boolean needsReconfirmation) {
        List<String> reasons = new ArrayList<>();
        if (!hasWarning(recommendedWarnings, SERVICE_TYPE_MISMATCH_CODE)) {
            reasons.add(SERVICE_TYPE_MATCH_REASON);
        }
        if (!hasWarning(recommendedWarnings, SPICY_LEVEL_MISMATCH_CODE)) {
            reasons.add(SPICY_LEVEL_MATCH_REASON);
        }
        if (reasons.isEmpty()) {
            reasons.add(BEST_REMAINING_REASON);
        }
        if (needsReconfirmation) {
            reasons.add(RECONFIRMATION_REASON);
        }
        return List.copyOf(reasons);
    }

    private static List<String> buildUnmetConditions(List<RuleEvaluationResult> recommendedWarnings, boolean needsReconfirmation) {
        List<String> unmetConditions = recommendedWarnings.stream()
            .map(RecommendationEngineService::describeUnmetWarning)
            .collect(Collectors.toCollection(ArrayList::new));
        if (needsReconfirmation) {
            unmetConditions.add(RECONFIRMATION_UNMET_TEXT);
        }
        return List.copyOf(unmetConditions);
    }

    private static String describeUnmetWarning(RuleEvaluationResult warning) {
        return switch (warning.errorCode()) {
            case SERVICE_TYPE_MISMATCH_CODE -> SERVICE_TYPE_UNMET_TEXT;
            case SPICY_LEVEL_MISMATCH_CODE -> SPICY_LEVEL_UNMET_TEXT;
            default -> warning.errorCode();
        };
    }

    private static List<String> buildAlternativeCandidateIds(List<ScoredCandidate> rankedCandidates, String recommendedCandidateId) {
        return rankedCandidates.stream()
            .map(scored -> scored.candidate().candidateId())
            .filter(candidateId -> !candidateId.equals(recommendedCandidateId))
            .limit(MAX_ALTERNATIVE_CANDIDATES)
            .toList();
    }
}
