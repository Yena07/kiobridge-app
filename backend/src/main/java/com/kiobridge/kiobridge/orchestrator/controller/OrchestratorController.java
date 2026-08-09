package com.kiobridge.kiobridge.orchestrator.controller;

import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.orchestrator.controller.dto.OrchestratorRunRequest;
import com.kiobridge.kiobridge.orchestrator.service.SubmissionOrchestrator;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * STEP9(buildExecutionPlan) -> ParticipantSubmission 조립 -> 제출/검증/실행을 한 번에 처리하는
 * 진입점. 프론트가 recommendation/executionPlan을 직접 조립할 수단이 없었기 때문에(STEP4/5
 * 결과와 STEP9 결과를 프론트가 들고 있지 않음), 그 조립을 여기서 대신한다.
 *
 * /internal/plan/build, /internal/simulation/submit-and-run은 그대로 남겨둔다 — 이미 조립된
 * ExecutionPlan/ParticipantSubmission을 직접 다루고 싶은 호출자(테스트, 다른 내부 도구)를 위한
 * 저수준 진입점으로 계속 유효하다.
 */
@RestController
@RequestMapping("/internal/orchestrator")
public class OrchestratorController {

    private final SubmissionOrchestrator submissionOrchestrator;

    public OrchestratorController(SubmissionOrchestrator submissionOrchestrator) {
        this.submissionOrchestrator = submissionOrchestrator;
    }

    /** POST /internal/orchestrator/approve — STEP9 조립부터 실행까지 전체 승인 플로우. */
    @PostMapping("/approve")
    public ExecuteResult approve(@RequestBody OrchestratorRunRequest request) {
        return submissionOrchestrator.runApprovalFlow(
            request.sessionId(),
            request.profile(),
            request.sessionContext(),
            request.recommendation(),
            request.userDecision()
        );
    }
}
