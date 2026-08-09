package com.kiobridge.kiobridge.modules.recommendation.controller.dto;

import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;

import java.util.Objects;

/** POST /api/v1/candidate-filters 요청. */
public record CandidateFilterRequest(String environmentId, ChickenStoreSessionContext sessionContext) {
    public CandidateFilterRequest {
        Objects.requireNonNull(environmentId, "environmentId는 null일 수 없습니다.");
        Objects.requireNonNull(sessionContext, "sessionContext는 null일 수 없습니다.");
    }
}
