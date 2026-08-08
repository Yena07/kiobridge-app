package com.kiobridge.kiobridge.modules.executionplan.controller.dto;

/** POST /internal/simulation/session 요청. */
public record CreateSessionRequest(String environmentId) {
    public CreateSessionRequest {
        if (environmentId == null || environmentId.isBlank()) {
            throw new IllegalArgumentException("environmentId는 비어있을 수 없습니다.");
        }
    }
}
