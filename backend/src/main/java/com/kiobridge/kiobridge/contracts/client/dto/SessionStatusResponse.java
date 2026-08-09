package com.kiobridge.kiobridge.contracts.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * GET /api/v1/sessions/:sessionId 응답 중 우리가 실제로 쓰는 필드만 추린 것.
 * 실제 응답은 submission/validation/evidence/run 등 훨씬 많은 필드를 담고 있으므로
 * (docs/API_CONTRACT.md 참고) ignoreUnknown=true 로 나머지는 무시한다.
 *
 * buildExecutionPlan이 environmentId를 클라이언트가 보낸 값으로 신뢰하지 않고
 * 이 엔드포인트로 세션 생성 시점의 값을 다시 조회해서 쓰는 데 사용한다
 * (세션마다 environmentId가 서버 쪽 기록과 다르게 스푸핑되는 걸 막기 위함).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SessionStatusResponse(
    String sessionId,
    String environmentId,
    String submissionStatus,
    String validationStatus,
    String executionStatus
) {}
