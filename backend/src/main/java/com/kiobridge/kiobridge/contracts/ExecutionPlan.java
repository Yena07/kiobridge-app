package com.kiobridge.kiobridge.contracts;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * STEP 9 buildExecutionPlan 의 결과물. Simulation API가 검증하는 핵심 객체.
 * 스키마 원본: schemas/core/execution-plan.schema.json (Kit 제공)
 * required 5개 필드를 그대로 반영한다: planId, validationMode, executionEnvironment,
 * actualDeviceCommandSent, actions.
 *
 * validationMode/executionEnvironment/actualDeviceCommandSent는 스키마상 const로 고정된
 * 값("SIMULATION_ONLY", "DIGITAL_TWIN", false)이라 참가팀이 다른 값으로 바꿀 수 없다.
 *
 * 통과 조건(WHAT_YOU_BUILD.md 기준):
 *  - 추천 후보 선택 Action이 정확히 한 번 존재하고 추천과 일치
 *  - 각 Action 이 현재 상태에서 허용되고 expectedBeforeState/After 가 일치
 *  - 검토 경계 상태(reviewBoundaryState) 도달 후 필수 verifier 실행
 *  - verifier 이후 추가 Action 없음, 결제/실제처리 Action 없음
 */
public record ExecutionPlan(
    String planId,
    String validationMode,
    String executionEnvironment,
    boolean actualDeviceCommandSent,
    List<Action> actions
) {
    private static final String VALIDATION_MODE = "SIMULATION_ONLY";
    private static final String EXECUTION_ENVIRONMENT = "DIGITAL_TWIN";

    public ExecutionPlan {
        Objects.requireNonNull(planId, "planId는 null일 수 없습니다.");
        if (!VALIDATION_MODE.equals(validationMode)) {
            throw new IllegalArgumentException("validationMode는 \"" + VALIDATION_MODE + "\" 고정입니다.");
        }
        if (!EXECUTION_ENVIRONMENT.equals(executionEnvironment)) {
            throw new IllegalArgumentException("executionEnvironment는 \"" + EXECUTION_ENVIRONMENT + "\" 고정입니다.");
        }
        if (actualDeviceCommandSent) {
            throw new IllegalArgumentException("actualDeviceCommandSent는 반드시 false여야 합니다.");
        }
        Objects.requireNonNull(actions, "actions는 null일 수 없습니다 (빈 배열은 허용).");
    }

    /** planId를 새로 발급하며 빈 ExecutionPlan을 만든다. */
    public static ExecutionPlan empty() {
        return new ExecutionPlan(UUID.randomUUID().toString(), VALIDATION_MODE, EXECUTION_ENVIRONMENT, false, List.of());
    }

    /** 이미 발급된 planId를 재사용해 Action 목록을 담는다 (재시도 시 같은 planId 유지 용도). */
    public static ExecutionPlan of(String planId, List<Action> actions) {
        return new ExecutionPlan(planId, VALIDATION_MODE, EXECUTION_ENVIRONMENT, false, actions);
    }
}
