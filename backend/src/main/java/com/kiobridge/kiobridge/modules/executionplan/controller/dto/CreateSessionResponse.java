package com.kiobridge.kiobridge.modules.executionplan.controller.dto;

/**
 * POST /internal/simulation/session 응답.
 * Simulation API 원본 응답(contracts.client.dto.SessionCreateResponse) 중
 * 프론트가 다음 단계(제출)를 진행하는 데 필요한 필드만 추린 것.
 *
 * environmentId를 여기서 돌려주지 않으면 프론트가 이후 단계(예: submit-and-run의
 * ParticipantSubmission.environmentId)에서 값을 다시 하드코딩해야 한다 — 그대로 echo한다.
 */
public record CreateSessionResponse(
    String sessionId,
    String environmentId,
    String initialState,
    String submissionEndpoint
) {}
