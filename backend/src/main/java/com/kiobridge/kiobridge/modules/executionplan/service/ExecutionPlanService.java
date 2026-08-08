package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.ParticipantSubmission;
import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.contracts.client.dto.SessionCreateResponse;
import com.kiobridge.kiobridge.contracts.client.dto.ValidationResult;
import com.kiobridge.kiobridge.contracts.ExecutionPlan;
import com.kiobridge.kiobridge.contracts.UserDecision;
import org.springframework.stereotype.Service;

/**
 * STEP 8~9 + Simulation API 제출 파이프라인을 오케스트레이션한다.
 * 담당2 의 recommendation, 프론트에서 받은 사용자 승인 결과를 받아
 * 실행계획을 만들고 KioBridge 서버에 제출 -> 검증 -> 실행까지 처리한다.
 *
 * 세션 생성(/internal/simulation/session)과 제출-검증-실행(/internal/simulation/submit-and-run)이
 * 내부 API에서 별도 엔드포인트로 분리되어 있으므로, submitAndRun은 이미 생성된 sessionId를 받아 처리한다.
 */
@Service
public class ExecutionPlanService {

    private final SimulationApiClient simulationApiClient;

    public ExecutionPlanService(SimulationApiClient simulationApiClient) {
        this.simulationApiClient = simulationApiClient;
    }

    /**
     * userDecision.approved()==false 이면 반드시 빈 ExecutionPlan을 반환한다 (Kit 검증 규칙,
     * 어기면 validate 단계에서 USER_NOT_APPROVED 류 오류로 거부된다).
     *
     * approved()==true인 경우의 실제 조립 로직(recommendation 기반 Action 리스트 생성)은
     * 담당2의 Recommendation 타입이 확정되기 전까지 구현할 수 없다. 이 상태로 빈 ExecutionPlan을
     * 반환하면 호출자(컨트롤러) 입장에서는 정상 성공 응답처럼 보이므로, 미구현임을 숨기지 않기
     * 위해 명시적으로 실패시킨다.
     *
     * TODO: 담당2의 Recommendation 타입이 확정되면 Object 대신 실제 타입으로 교체하고, 아래
     *       예외 대신 select_service_type -> select_menu -> select_option* -> confirm_option
     *       -> open_cart_review -> verify_cart 순서로 Action 리스트를 조립한다.
     */
    public ExecutionPlan buildExecutionPlan(UserDecision userDecision, Object recommendation) {
        if (!userDecision.approved()) {
            return ExecutionPlan.empty();
        }
        throw new UnsupportedOperationException(
            "buildExecutionPlan: recommendation 기반 Action 조립이 아직 구현되지 않았습니다. "
                + "승인된 요청에 빈 ExecutionPlan을 성공으로 반환하지 않도록 임시로 실패 처리합니다."
        );
    }

    /** POST /api/v1/sessions 위임. 내부 API 컨트롤러의 /internal/simulation/session 에서 호출한다. */
    public SessionCreateResponse createSession(String environmentId) {
        return simulationApiClient.createSession(environmentId);
    }

    /**
     * 이미 생성된 세션에 제출 -> 검증 -> (통과 시) 실행까지 한 번에 처리한다.
     * 검증에 실패하면 execute를 호출하지 않고 그 자리에서 실패 결과를 반환한다.
     *
     * approved=false 인데 actions가 비어있지 않은 제출은 ParticipantSubmission 생성 시점에
     * 이미 거부되므로(compact constructor), 여기서는 별도로 재검증하지 않는다.
     */
    public ExecuteResult submitAndRun(String sessionId, ParticipantSubmission submission) {
        simulationApiClient.submit(sessionId, submission);

        ValidationResult validation = simulationApiClient.validate(sessionId);
        if (!validation.valid()) {
            return new ExecuteResult(false, null, null, validation);
        }

        return simulationApiClient.execute(sessionId);
    }
}
