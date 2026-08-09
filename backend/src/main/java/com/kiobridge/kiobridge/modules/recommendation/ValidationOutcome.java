package com.kiobridge.kiobridge.modules.recommendation;

import java.util.List;
import java.util.Objects;

/** RecommendationValidator.validate(...)의 결과. issues가 비어있으면 valid=true. */
public record ValidationOutcome(boolean valid, List<ValidationIssue> issues) {
    public ValidationOutcome {
        Objects.requireNonNull(issues, "issues는 null일 수 없습니다.");
        issues = List.copyOf(issues);
    }

    public static ValidationOutcome of(List<ValidationIssue> issues) {
        return new ValidationOutcome(issues.isEmpty(), issues);
    }
}
