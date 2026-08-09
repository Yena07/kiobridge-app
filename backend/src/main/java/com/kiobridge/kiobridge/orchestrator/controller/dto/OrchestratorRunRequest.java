package com.kiobridge.kiobridge.orchestrator.controller.dto;

import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.UserDecision;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;

import java.util.Objects;

/**
 * POST /internal/orchestrator/approve 요청.
 * ParticipantSubmission을 조립하는 데 필요한 조각을 전부 여기서 받는다 — environmentId는
 * 받지 않는다 (SubmissionOrchestrator가 sessionId로 다시 조회해서 신뢰할 수 있는 값을 쓴다).
 * profile은 담당1의 Profile 타입이 확정되기 전까지 Object로 느슨하게 받는다
 * (ParticipantSubmission.profile과 동일한 이유).
 */
public record OrchestratorRunRequest(
    String sessionId,
    Object profile,
    ChickenStoreSessionContext sessionContext,
    Recommendation recommendation,
    UserDecision userDecision
) {
    public OrchestratorRunRequest {
        Objects.requireNonNull(sessionId, "sessionId는 null일 수 없습니다.");
        Objects.requireNonNull(profile, "profile은 null일 수 없습니다.");
        Objects.requireNonNull(sessionContext, "sessionContext는 null일 수 없습니다.");
        Objects.requireNonNull(recommendation, "recommendation은 null일 수 없습니다.");
        Objects.requireNonNull(userDecision, "userDecision은 null일 수 없습니다.");
    }
}
