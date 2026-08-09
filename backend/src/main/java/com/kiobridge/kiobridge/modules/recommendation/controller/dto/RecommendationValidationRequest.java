package com.kiobridge.kiobridge.modules.recommendation.controller.dto;

import com.kiobridge.kiobridge.contracts.Recommendation;

import java.util.Objects;

/** POST /api/v1/recommendation-output-validations 요청. */
public record RecommendationValidationRequest(String environmentId, Recommendation recommendation) {
    public RecommendationValidationRequest {
        Objects.requireNonNull(environmentId, "environmentId는 null일 수 없습니다.");
        Objects.requireNonNull(recommendation, "recommendation은 null일 수 없습니다.");
    }
}
