package com.kiobridge.kiobridge.contracts;

import java.util.List;

public record CompatibilityRule(
        String ruleId,
        String description,
        RuleSource source,          // section, path
        RuleTarget candidate,       // 구버전 레거시, source(supportedOptions/requirements/attributes/field), key
        RuleTarget target,          // 신버전, candidate와 같이 있을 수 있음
        String operator,            // IN/INTERSECTS/EQUALS/CONTAINS/DISJOINT/MAX/CONTAINS_SELECTED/EQUALS_SELECTED
        String severity,             // BLOCK/WARN
        String unknownPolicy,        // RECONFIRM/IGNORE/ALLOW/BLOCK
        String errorCode,
        String evaluationScope,      // CANDIDATE/EXECUTION_CHOICE, null이면 target 유무로 판별
        List<String> neutralValues,  // null이면 기본값 ["NO_PREFERENCE","NOT_APPLICABLE","UNSPECIFIED"] 적용
        List<String> wildcardCandidateValues,
        Double minConfidence,
        String absentMeans            // NONE/UNKNOWN, null이면 기본값 UNKNOWN
) {
    public record RuleSource(String section, String path) {}
    public record RuleTarget(String source, String key) {}
}
