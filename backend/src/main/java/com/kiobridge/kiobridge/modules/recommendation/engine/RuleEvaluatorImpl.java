package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.input.context.FieldMetadata;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * RuleEvaluator 실제 구현체.
 *
 * Kit 원본(packages/evaluator/src/compatibility.ts의 evaluateCompatibility())의 판정 순서를
 * 그대로 포팅했다 — 우리가 새로 설계한 로직이 아니라 Kit이 자기 검증에 쓰는 알고리즘이다.
 * 판정 순서:
 *   1) absentMeans=="NONE"인데 값이 없으면 -> SKIPPED (제약 없음)
 *   2) 값이 neutralValues(기본 NO_PREFERENCE/NOT_APPLICABLE/UNSPECIFIED)에 해당하면 -> SKIPPED (선호 없음)
 *   3) 값이 없거나(1의 경우 제외)/UNKNOWN이거나/confidence가 rule.minConfidence보다 낮고
 *      confirmedByUser==false면 -> unknownPolicy(IGNORE/ALLOW/BLOCK/RECONFIRM)로 분기
 *   4) candidate 쪽에 이 항목이 없으면 -> SKIPPED (이 후보엔 해당 없음)
 *   5) candidate 값이 wildcardCandidateValues(누구에게나 허용)면 -> PASS
 *   6) 그 외엔 operator(RuleOperatorComparator)로 실제 비교 -> PASS/FAIL(severity대로)
 */
@Component
public class RuleEvaluatorImpl implements RuleEvaluator {

    private static final List<String> DEFAULT_NEUTRAL_VALUES = List.of("NO_PREFERENCE", "NOT_APPLICABLE", "UNSPECIFIED");
    private static final String ABSENT_MEANS_NONE = "NONE";
    private static final String UNKNOWN_VALUE = "UNKNOWN";

    @Override
    public RuleEvaluationResult evaluate(CompatibilityRule rule, Candidate candidate,
                                          SessionContextBase<?, ?, ?, ?> sessionContext) {
        Object sourceValue = RuleValueResolver.resolveSourceValue(rule.source(), sessionContext);
        Object candidateValue = RuleValueResolver.resolveCandidateValue(rule.candidate(), candidate);
        FieldMetadata fieldMetadata = RuleValueResolver.resolveFieldMetadata(rule.source(), sessionContext);

        List<Object> sourceValues = RuleValueSupport.asList(sourceValue);
        boolean isEmptyList = sourceValue instanceof List<?> list && list.isEmpty();
        boolean isAbsent = sourceValue == null || isEmptyList;

        String absentMeans = rule.absentMeans() != null ? rule.absentMeans() : UNKNOWN_VALUE;
        boolean absentIsNone = isAbsent && ABSENT_MEANS_NONE.equals(absentMeans);
        boolean isMissing = isAbsent && !absentIsNone;
        boolean isUnknownValue = sourceValues.stream().anyMatch(v -> UNKNOWN_VALUE.equals(RuleValueSupport.stringOf(v)));

        List<String> neutralValues = rule.neutralValues() != null ? rule.neutralValues() : DEFAULT_NEUTRAL_VALUES;
        boolean isNeutral = !isMissing && !sourceValues.isEmpty()
            && sourceValues.stream().allMatch(v -> neutralValues.contains(RuleValueSupport.stringOf(v)));

        boolean isUnconfirmed = isUnconfirmedByConfidence(rule, fieldMetadata);

        // 1) absentMeans==NONE 인데 값이 없으면: "이 제약 자체가 선언되지 않았다" = 위반할 게 없다.
        if (absentIsNone && !isUnknownValue) {
            return RuleEvaluationResult.skipped(rule.ruleId());
        }

        // 2) NO_PREFERENCE/NOT_APPLICABLE 류: 사용자가 명시적으로 선호를 안 밝힌 것도 유효한 답이다.
        if (isNeutral) {
            return RuleEvaluationResult.skipped(rule.ruleId());
        }

        // 3) 값이 없거나(누락) / UNKNOWN이거나 / 신뢰도가 낮고 사용자 확인이 안 됐으면 임의 추론 금지.
        if (isMissing || isUnknownValue || isUnconfirmed) {
            return resolveUnknownPolicy(rule, sourceValue, candidateValue);
        }

        // 4) candidate가 이 속성 자체를 선언하지 않았으면 이 후보에겐 규칙이 적용될 대상이 없다.
        if (candidateValue == null) {
            return RuleEvaluationResult.skipped(rule.ruleId());
        }

        // 5) candidate 값이 와일드카드(누구에게나 허용되는 후보)면 비교 없이 통과.
        if (matchesWildcard(rule.wildcardCandidateValues(), candidateValue)) {
            return RuleEvaluationResult.pass(rule.ruleId(), sourceValue, candidateValue);
        }

        // 6) 실제 operator 비교.
        boolean satisfied = RuleOperatorComparator.compare(rule.operator(), sourceValue, candidateValue);
        if (satisfied) {
            return RuleEvaluationResult.pass(rule.ruleId(), sourceValue, candidateValue);
        }
        return RuleEvaluationResult.fail(rule.ruleId(), rule.severity(), rule.errorCode(), sourceValue, candidateValue);
    }

    private RuleEvaluationResult resolveUnknownPolicy(CompatibilityRule rule, Object sourceValue, Object candidateValue) {
        String policy = rule.unknownPolicy() != null ? rule.unknownPolicy() : "RECONFIRM";

        return switch (policy) {
            case "IGNORE" -> RuleEvaluationResult.skipped(rule.ruleId());
            case "ALLOW" -> RuleEvaluationResult.pass(rule.ruleId(), sourceValue, candidateValue);
            case "BLOCK" -> RuleEvaluationResult.fail(rule.ruleId(), rule.severity(), rule.errorCode(), sourceValue, candidateValue);
            default -> {
                // RECONFIRM: 단, 이 후보가 "안전 경로"(예: 직원 도움) 와일드카드에 해당하면 재확인 없이 통과시킨다.
                if (matchesWildcard(rule.wildcardCandidateValues(), candidateValue)) {
                    yield RuleEvaluationResult.pass(rule.ruleId(), sourceValue, candidateValue);
                }
                yield RuleEvaluationResult.reconfirm(rule.ruleId(), rule.errorCode(), sourceValue);
            }
        };
    }

    /** confidence가 rule.minConfidence보다 낮고 사용자가 확인하지 않았으면 UNKNOWN과 동일하게 취급한다. */
    private boolean isUnconfirmedByConfidence(CompatibilityRule rule, FieldMetadata fieldMetadata) {
        if (fieldMetadata == null || rule.minConfidence() == null) {
            return false;
        }
        BigDecimal confidence = fieldMetadata.confidence();
        if (confidence == null) {
            return false;
        }
        boolean belowThreshold = confidence.doubleValue() < rule.minConfidence();
        return belowThreshold && !fieldMetadata.confirmedByUser();
    }

    private boolean matchesWildcard(List<String> wildcardValues, Object candidateValue) {
        if (wildcardValues == null || wildcardValues.isEmpty()) {
            return false;
        }
        return RuleValueSupport.asList(candidateValue).stream()
            .anyMatch(v -> wildcardValues.contains(RuleValueSupport.stringOf(v)));
    }
}
