package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.Action;
import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.ExecutionPlan;
import com.kiobridge.kiobridge.contracts.ParticipantSubmission;
import com.kiobridge.kiobridge.contracts.PublicFixture;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.State;
import com.kiobridge.kiobridge.contracts.Target;
import com.kiobridge.kiobridge.contracts.UserDecision;
import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import com.kiobridge.kiobridge.contracts.client.dto.SessionCreateResponse;
import com.kiobridge.kiobridge.contracts.client.dto.ValidationResult;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStorePreferences;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * STEP 8~9 + Simulation API 제출 파이프라인을 오케스트레이션한다.
 * 담당2 의 recommendation, 프론트에서 받은 사용자 승인 결과를 받아
 * 실행계획을 만들고 KioBridge 서버에 제출 -> 검증 -> 실행까지 처리한다.
 *
 * 세션 생성(/internal/simulation/session)과 제출-검증-실행(/internal/simulation/submit-and-run)이
 * 내부 API에서 별도 엔드포인트로 분리되어 있으므로, submitAndRun은 이미 생성된 sessionId를 받아 처리한다.
 *
 * buildExecutionPlan은 현재 chicken-store 환경 하나만 지원한다 (Kit이 이 해커톤에서 제공하는
 * 유일한 environment). 다른 environment가 추가되면 sessionContext.preferences() 타입 분기가 필요하다.
 */
@Service
public class ExecutionPlanService {

    private static final String REVIEW_TARGET_KIND = "review";

    private final SimulationApiClient simulationApiClient;

    public ExecutionPlanService(SimulationApiClient simulationApiClient) {
        this.simulationApiClient = simulationApiClient;
    }

    /**
     * userDecision.approved()==false 이면 반드시 빈 ExecutionPlan을 반환한다 (Kit 검증 규칙,
     * 어기면 validate 단계에서 USER_NOT_APPROVED 류 오류로 거부된다).
     *
     * approved()==true 인 경우 select_service -> select_menu -> select_option(그룹별) ->
     * confirm_option x2 -> open_cart_review -> verify_cart 순서로 Action 리스트를 조립한다
     * (environments/chicken-store/transitions.json 기준 상태 전이 순서).
     *
     * "review" kind Action(confirm_option/open_cart_review/verify_cart)의 target.id는 도착 상태
     * 이름을 그대로 쓴다 — Kit이 제공하는 examples/submission-format-example/sandbox.json의
     * 실제 관례이자, kiosk-driver-contract의 resolveSemanticTarget()이 review/staff/none kind는
     * id를 검증하지 않는다는 점(kind만 screens.json의 targetKinds에 있으면 통과)도 확인했다.
     * 팀 전체가 공식 합의한 컨벤션은 아니지만, 엔진이 검증하지 않는 값이라 지금 단계에서
     * buildExecutionPlan을 막을 이유가 없다고 판단해 이 컨벤션으로 우선 진행한다.
     *
     * environmentId는 호출자가 다시 보내는 값을 그대로 믿지 않고, sessionId로 Simulation API의
     * GET /api/v1/sessions/:sessionId를 조회해서 세션 생성 시점에 실제로 쓰인 값을 가져온다.
     * (createSession(environmentId) 때 정해진 값과 buildExecutionPlan 때 쓰는 값이 어긋나는 걸
     * 로컬에 별도 상태를 두지 않고 Kit 서버를 단일 진실 공급원으로 삼아 막는다.)
     */
    public ExecutionPlan buildExecutionPlan(
        String sessionId,
        Recommendation recommendation,
        UserDecision userDecision,
        SessionContextBase<?, ?, ?, ?> sessionContext
    ) {
        if (!userDecision.approved()) {
            return ExecutionPlan.empty();
        }
        Objects.requireNonNull(sessionId, "sessionId는 null일 수 없습니다.");
        Objects.requireNonNull(recommendation, "recommendation은 null일 수 없습니다.");
        Objects.requireNonNull(sessionContext, "sessionContext는 null일 수 없습니다.");

        String candidateId = recommendation.recommendedCandidateId();
        if (candidateId == null || candidateId.isBlank()) {
            throw new IllegalStateException(
                "승인된 결정(userDecision.approved=true)인데 recommendation.recommendedCandidateId가 없습니다. "
                    + "buildExecutionPlan은 추천 후보 없이 실행계획을 만들 수 없습니다."
            );
        }

        String environmentId = simulationApiClient.getSession(sessionId).environmentId();
        if (environmentId == null || environmentId.isBlank()) {
            throw new IllegalStateException(
                "sessionId(" + sessionId + ")에 대한 세션을 Simulation API에서 찾지 못했거나 environmentId가 없습니다."
            );
        }

        PublicFixture fixture = simulationApiClient.getFixture(environmentId);
        Candidate candidate = fixture.candidates().stream()
            .filter(c -> candidateId.equals(c.candidateId()))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException(
                "추천된 candidateId(" + candidateId + ")가 " + environmentId + " fixture 후보 목록에 없습니다."
            ));

        if (!(sessionContext.preferences() instanceof ChickenStorePreferences preferences)) {
            throw new IllegalStateException(
                "buildExecutionPlan은 현재 chicken-store 환경(ChickenStorePreferences)만 지원합니다."
            );
        }

        List<Action> actions = assembleActions(fixture.optionGroups(), candidate, candidateId, preferences);
        return ExecutionPlan.of(UUID.randomUUID().toString(), actions);
    }

    private static List<Action> assembleActions(
        List<Map<String, Object>> optionGroups,
        Candidate candidate,
        String candidateId,
        ChickenStorePreferences preferences
    ) {
        List<Action> actions = new ArrayList<>();
        int index = 0;

        String serviceTypeId = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups, "SERVICE_TYPE", enumId(preferences.serviceType()), candidate
        );
        actions.add(new Action(
            index++, "select_service", Target.of("service_type", serviceTypeId),
            State.SERVICE_TYPE, State.MENU_SELECTION
        ));

        actions.add(new Action(
            index++, "select_menu", Target.candidate(candidateId),
            State.MENU_SELECTION, State.OPTION_SELECTION
        ));

        index = addRequiredOption(actions, index, optionGroups, candidate, "SPICY_LEVEL", enumId(preferences.spicyLevel()));
        index = addRequiredOption(actions, index, optionGroups, candidate, "BONE_TYPE", enumId(preferences.boneType()));

        String cupId = enumId(preferences.cupOption());
        if (cupId != null) {
            index = addRequiredOption(actions, index, optionGroups, candidate, "CUP", cupId);
        }

        String quantityId = ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups, "QUANTITY", preferences.quantity());
        index = addRequiredOption(actions, index, optionGroups, candidate, "QUANTITY", quantityId);

        actions.add(new Action(
            index++, "confirm_option", Target.of(REVIEW_TARGET_KIND, State.OPTION_CONFIRM.name()),
            State.OPTION_SELECTION, State.OPTION_CONFIRM
        ));
        actions.add(new Action(
            index++, "confirm_option", Target.of(REVIEW_TARGET_KIND, State.MENU_SELECTION_WITH_CART.name()),
            State.OPTION_CONFIRM, State.MENU_SELECTION_WITH_CART
        ));
        actions.add(new Action(
            index++, "open_cart_review", Target.of(REVIEW_TARGET_KIND, State.CART_REVIEW.name()),
            State.MENU_SELECTION_WITH_CART, State.CART_REVIEW
        ));
        actions.add(new Action(
            index, "verify_cart", Target.of(REVIEW_TARGET_KIND, State.CART_REVIEW.name()),
            State.CART_REVIEW, State.CART_REVIEW
        ));

        return actions;
    }

    private static int addRequiredOption(
        List<Action> actions,
        int index,
        List<Map<String, Object>> optionGroups,
        Candidate candidate,
        String groupId,
        String preferredId
    ) {
        String optionId = ChickenStoreOptionResolver.resolveOptionId(optionGroups, groupId, preferredId, candidate);
        actions.add(new Action(
            index, "select_option", Target.option(groupId, optionId),
            State.OPTION_SELECTION, State.OPTION_SELECTION
        ));
        return index + 1;
    }

    /**
     * ServiceType/SpicyLevel/BoneType/CupOption enum 상수명은 option-groups.json의 option id와
     * 그대로 같다 (예: SpicyLevel.MEDIUM -> "MEDIUM"). 단 NO_PREFERENCE/UNKNOWN/NONE 은 그 그룹에
     * 실존하는 id가 아니므로, ChickenStoreOptionResolver가 후보 지원값/그룹 첫 옵션으로 대신
     * 고르도록 null을 돌려준다.
     */
    private static String enumId(Enum<?> preference) {
        if (preference == null) {
            return null;
        }
        return switch (preference.name()) {
            case "NO_PREFERENCE", "UNKNOWN", "NONE" -> null;
            default -> preference.name();
        };
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
