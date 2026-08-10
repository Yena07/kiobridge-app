package com.kiobridge.kiobridge.orchestrator.service;

import com.kiobridge.kiobridge.contracts.ParticipantSubmission;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.UserDecision;
import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import com.kiobridge.kiobridge.modules.executionplan.service.ExecutionPlanResult;
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
 * environmentId는 여기서도 호출자가 보낸 값을 신뢰하지 않는다는 원칙은 buildExecutionPlan과
 * 동일하다. 다만 실제 Simulation API 조회는 가능하면 한 번만 한다 — buildExecutionPlan이
 * approved()==true 경로에서 이미 조회해서 ExecutionPlanResult.environmentId()로 돌려주면 그 값을
 * 그대로 재사용하고, approved()==false라 buildExecutionPlan이 조회를 생략한 경우에만 여기서
 * 직접 Simulation API 세션을 조회한다.
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

        ExecutionPlanResult planResult =
            executionPlanService.buildExecutionPlan(sessionId, recommendation, userDecision, sessionContext);

        // buildExecutionPlan이 이미 조회해둔 값이 있으면 재사용하고, 없을 때만(approved=false 경로) 직접 조회한다.
        String environmentId = planResult.environmentId() != null
            ? planResult.environmentId()
            : simulationApiClient.getSession(sessionId).environmentId();
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
            planResult.executionPlan()
        );

        return executionPlanService.submitAndRun(sessionId, submission);
    }
}
