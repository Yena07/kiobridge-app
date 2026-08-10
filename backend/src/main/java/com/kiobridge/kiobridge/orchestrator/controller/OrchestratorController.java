package com.kiobridge.kiobridge.orchestrator.controller;

import com.kiobridge.kiobridge.contracts.Evidence;
import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.modules.stateevidence.service.ApprovalResult;
import com.kiobridge.kiobridge.modules.stateevidence.service.EvidenceParsingService;
import com.kiobridge.kiobridge.modules.stateevidence.service.EvidenceSummary;
import com.kiobridge.kiobridge.modules.stateevidence.service.EvidenceSummaryService;
import com.kiobridge.kiobridge.modules.stateevidence.service.ValidationErrorMessageService;
import com.kiobridge.kiobridge.orchestrator.controller.dto.OrchestratorRunRequest;
import com.kiobridge.kiobridge.orchestrator.service.SubmissionOrchestrator;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
    private final EvidenceParsingService evidenceParsingService;
    private final EvidenceSummaryService evidenceSummaryService;
    private final ValidationErrorMessageService validationErrorMessageService;

    public OrchestratorController(
        SubmissionOrchestrator submissionOrchestrator,
        EvidenceParsingService evidenceParsingService,
        EvidenceSummaryService evidenceSummaryService,
        ValidationErrorMessageService validationErrorMessageService
    ) {
        this.submissionOrchestrator = submissionOrchestrator;
        this.evidenceParsingService = evidenceParsingService;
        this.evidenceSummaryService = evidenceSummaryService;
        this.validationErrorMessageService = validationErrorMessageService;
    }

    /** POST /internal/orchestrator/approve — STEP9 조립부터 실행까지 전체 승인 플로우. */
    @PostMapping("/approve")
    public ApprovalResult approve(@RequestBody OrchestratorRunRequest request) {
        ExecuteResult result = submissionOrchestrator.runApprovalFlow(
            request.sessionId(),
            request.profile(),
            request.sessionContext(),
            request.recommendation(),
            request.userDecision()
        );

        EvidenceSummary summary = null;
        List<String> validationMessages = List.of();

        if (result.valid() && result.evidence() != null && !result.evidence().isNull()) {
            try {
                Evidence evidence = evidenceParsingService.parse(result.evidence());
                summary = evidenceSummaryService.summarize(evidence);
            } catch (Exception e) {
                summary = new EvidenceSummary("결과를 처리하는 중 문제가 발생했습니다.", null, null);
            }
        } else if (!result.valid() && result.validation() != null) {
            validationMessages = result.validation().errors().stream()
                .map(err -> validationErrorMessageService.toFriendlyMessage(err.code()))
                .distinct()
                .toList();
        }

        return new ApprovalResult(result.valid(), summary, validationMessages, result);
    }
}