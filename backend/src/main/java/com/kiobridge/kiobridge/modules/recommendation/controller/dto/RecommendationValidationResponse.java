package com.kiobridge.kiobridge.modules.recommendation.controller.dto;

import com.kiobridge.kiobridge.modules.recommendation.ValidationIssue;
import com.kiobridge.kiobridge.modules.recommendation.ValidationOutcome;

import java.util.List;
import java.util.Objects;

/**
 * POST /api/v1/recommendation-output-validations 응답.
 * ValidationOutcome은 valid/issues만 갖고 있어서, 프론트가 기대하는
 * readyForExecutionPlan/errors/warnings 모양으로 여기서 변환한다.
 * 지금은 severity 구분이 없어 모든 issue를 errors로 넣고 warnings는 항상 빈 배열이다 —
 * 나중에 "막지는 않지만 경고만 주는" 검증이 생기면 그때 분리 기준을 추가하면 된다.
 */
public record RecommendationValidationResponse(
    boolean valid,
    boolean readyForExecutionPlan,
    List<ValidationIssue> errors,
    List<ValidationIssue> warnings
) {
    public RecommendationValidationResponse {
        Objects.requireNonNull(errors, "errors는 null일 수 없습니다.");
        Objects.requireNonNull(warnings, "warnings는 null일 수 없습니다.");
    }

    public static RecommendationValidationResponse from(ValidationOutcome outcome) {
        Objects.requireNonNull(outcome, "outcome은 null일 수 없습니다.");
        return new RecommendationValidationResponse(outcome.valid(), outcome.valid(), outcome.issues(), List.of());
    }
}
