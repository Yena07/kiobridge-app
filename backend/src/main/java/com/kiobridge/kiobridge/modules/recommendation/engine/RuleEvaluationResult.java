package com.kiobridge.kiobridge.modules.recommendation.engine;

import java.util.Objects;

/**
 * RuleEvaluator가 CompatibilityRule 하나를 판정한 결과.
 * severity/errorCode는 CompatibilityRule에서 그대로 가져와 호출자(RecommendationService 등)가
 * FAIL을 만났을 때 BLOCK/WARN 중 무엇으로 처리할지 CompatibilityRule을 다시 참조하지 않아도 되게 한다.
 *
 * sourceValue/candidateValue는 디버깅·설명(explainRecommendation) 용도로, 실제 비교에 쓰인
 * 원본 값을 담는다 (예: sessionContext.hardConstraints()에서 읽은 값 / candidate.attributes()에서 읽은 값).
 */
public record RuleEvaluationResult(
    String ruleId,
    RuleResult result,
    String severity,       // BLOCK / WARN (rule.severity() 그대로, result==PASS/SKIPPED 이면 null 허용)
    String errorCode,       // rule.errorCode() 그대로 (result==PASS 이면 null 허용)
    Object sourceValue,      // 디버깅용: sessionContext 쪽에서 읽은 값
    Object candidateValue    // 디버깅용: candidate 쪽에서 읽은 값
) {
    public RuleEvaluationResult {
        Objects.requireNonNull(ruleId, "ruleId는 null일 수 없습니다.");
        Objects.requireNonNull(result, "result는 null일 수 없습니다.");
    }

    public static RuleEvaluationResult pass(String ruleId, Object sourceValue, Object candidateValue) {
        return new RuleEvaluationResult(ruleId, RuleResult.PASS, null, null, sourceValue, candidateValue);
    }

    public static RuleEvaluationResult fail(String ruleId, String severity, String errorCode,
                                             Object sourceValue, Object candidateValue) {
        return new RuleEvaluationResult(ruleId, RuleResult.FAIL, severity, errorCode, sourceValue, candidateValue);
    }

    public static RuleEvaluationResult reconfirm(String ruleId, String errorCode, Object sourceValue) {
        return new RuleEvaluationResult(ruleId, RuleResult.RECONFIRM, null, errorCode, sourceValue, null);
    }

    public static RuleEvaluationResult skipped(String ruleId) {
        return new RuleEvaluationResult(ruleId, RuleResult.SKIPPED, null, null, null, null);
    }
}
