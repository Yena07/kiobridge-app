package com.kiobridge.kiobridge.modules.executionplan.controller;

import com.kiobridge.kiobridge.contracts.ExecutionPlan;
import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.contracts.client.dto.SessionCreateResponse;
import com.kiobridge.kiobridge.modules.executionplan.controller.dto.BuildExecutionPlanRequest;
import com.kiobridge.kiobridge.modules.executionplan.controller.dto.BuildExecutionPlanResponse;
import com.kiobridge.kiobridge.modules.executionplan.controller.dto.CreateSessionRequest;
import com.kiobridge.kiobridge.modules.executionplan.controller.dto.CreateSessionResponse;
import com.kiobridge.kiobridge.modules.executionplan.controller.dto.SubmitAndRunRequest;
import com.kiobridge.kiobridge.modules.executionplan.service.ExecutionPlanService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 프론트/오케스트레이터가 호출하는 담당3 내부 API.
 * 외부 Simulation API(:4000) 호출은 전부 ExecutionPlanService -> SimulationApiClient로 위임하고,
 * 이 컨트롤러는 요청/응답을 내부 API 스펙(docs/담당3_API_명세서.md 2장)에 맞게 변환하는 역할만 한다.
 */
@RestController
@RequestMapping("/internal")
public class ExecutionPlanController {

    private final ExecutionPlanService executionPlanService;

    public ExecutionPlanController(ExecutionPlanService executionPlanService) {
        this.executionPlanService = executionPlanService;
    }

    /** POST /internal/plan/build — STEP 9 실행계획 생성. */
    @PostMapping("/plan/build")
    public BuildExecutionPlanResponse buildPlan(@RequestBody BuildExecutionPlanRequest request) {
        ExecutionPlan executionPlan = executionPlanService.buildExecutionPlan(
            request.sessionId(), request.recommendation(), request.userDecision(), request.sessionContext()
        );
        return new BuildExecutionPlanResponse(executionPlan);
    }

    /** POST /internal/simulation/session — Simulation API 세션 생성. */
    @PostMapping("/simulation/session")
    public CreateSessionResponse createSession(@RequestBody CreateSessionRequest request) {
        SessionCreateResponse session = executionPlanService.createSession(request.environmentId());
        return new CreateSessionResponse(
            session.sessionId(), session.environmentId(), session.initialState(), session.submissionEndpoint()
        );
    }

    /** POST /internal/simulation/submit-and-run — 제출 -> 검증 -> (통과 시) 실행. */
    @PostMapping("/simulation/submit-and-run")
    public ExecuteResult submitAndRun(@RequestBody SubmitAndRunRequest request) {
        return executionPlanService.submitAndRun(request.sessionId(), request.submission());
    }
}
