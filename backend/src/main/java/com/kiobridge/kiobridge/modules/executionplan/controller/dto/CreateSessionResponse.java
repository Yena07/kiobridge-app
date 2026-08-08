package com.kiobridge.kiobridge.modules.executionplan.controller.dto;

/**
 * POST /internal/simulation/session 응답.
 * Simulation API 원본 응답(contracts.client.dto.SessionCreateResponse) 중
 * 프론트가 다음 단계(제출)를 진행하는 데 필요한 필드만 추린 것.
 */
public record CreateSessionResponse(
    String sessionId,
    String initialState,
    String submissionEndpoint
) {}
