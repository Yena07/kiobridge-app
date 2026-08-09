package com.kiobridge.kiobridge.orchestrator.service;

import com.kiobridge.kiobridge.contracts.ExecutionPlan;
import com.kiobridge.kiobridge.contracts.ParticipantSubmission;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.UserDecision;
import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import com.kiobridge.kiobridge.modules.executionplan.service.ExecutionPlanService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Objects;

/**
 * STEP9(buildExecutionPlan) -> ParticipantSubmission 조립 -> 제출/검증/실행을 한 번에 잇는다.
 *
 * 지금까지 이 세 단계는 전부 존재했지만 아무도 순서대로 이어 부르지 않았다 — 프론트는
 * recommendation/executionPlan 없이 얇은 승인 신호만 만들어서 바로 /internal/simulation/submit-and-run을
 * 불렀고(ParticipantSubmission을 프론트가 조립할 방법이 없었다), /internal/plan/build는 그래서
 * 실제 플로우에서 호출되는 곳이 없었다. 이 클래스가 그 빠진 연결이다.
 *
 * environmentId는 여기서도 호출자가 보낸 값을 신뢰하지 않고, buildExecutionPlan과 동일하게
 * sessionId로 Simulation API 세션을 다시 조회해서 가져온다 — ParticipantSubmission.environmentId도
 * 세션 생성 시점 값과 어긋나면 안 되기 때문에 같은 원칙을 여기서도 유지한다.
 */
@Service
public class SubmissionOrchestrator {

    private final ExecutionPlanService executionPlanService;
    private final SimulationApiClient simulationApiClient;
    private final String teamId;
    private final String inputContractVersion;
    private final String submissionVersion;

    public SubmissionOrchestrator(
        ExecutionPlanService executionPlanService,
        SimulationApiClient simulationApiClient,
        @Value("${kiobridge.team-id}") String teamId,
        @Value("${kiobridge.input-contract-version}") String inputContractVersion,
        @Value("${kiobridge.submission-version}") String submissionVersion
    ) {
        this.executionPlanService = executionPlanService;
        this.simulationApiClient = simulationApiClient;
        this.teamId = teamId;
        this.inputContractVersion = inputContractVersion;
        this.submissionVersion = submissionVersion;
    }

    /**
     * STEP9 -> 제출까지 전체 승인 플로우를 실행한다.
     * userDecision.approved()==false 인 경우에도 그대로 진행한다 — buildExecutionPlan이 빈 ExecutionPlan을
     * 돌려주고, ParticipantSubmission이 그 상태를 그대로 실어 제출/검증까지는 가되(Kit이 거절 사유를
     * 판단), execute는 검증 실패 시 자동으로 건너뛴다 (ExecutionPlanService.submitAndRun 참고).
     */
    public ExecuteResult runApprovalFlow(
        String sessionId,
        Object profile,
        SessionContextBase<?, ?, ?, ?> sessionContext,
        Recommendation recommendation,
        UserDecision userDecision
    ) {
        Objects.requireNonNull(sessionId, "sessionId는 null일 수 없습니다.");
        Objects.requireNonNull(profile, "profile은 null일 수 없습니다.");
        Objects.requireNonNull(sessionContext, "sessionContext는 null일 수 없습니다.");
        Objects.requireNonNull(recommendation, "recommendation은 null일 수 없습니다.");
        Objects.requireNonNull(userDecision, "userDecision은 null일 수 없습니다.");

        ExecutionPlan executionPlan =
            executionPlanService.buildExecutionPlan(sessionId, recommendation, userDecision, sessionContext);

        String environmentId = simulationApiClient.getSession(sessionId).environmentId();
        if (environmentId == null || environmentId.isBlank()) {
            throw new IllegalStateException(
                "sessionId(" + sessionId + ")에 대한 세션을 Simulation API에서 찾지 못했거나 environmentId가 없습니다."
            );
        }

        ParticipantSubmission submission = new ParticipantSubmission(
            inputContractVersion,
            submissionVersion,
            teamId,
            environmentId,
            profile,
            sessionContext,
            recommendation,
            userDecision,
            executionPlan
        );

        return executionPlanService.submitAndRun(sessionId, submission);
    }
}
