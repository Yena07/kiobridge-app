package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.ExecutionPlan;

/**
 * buildExecutionPlan()의 반환값. ExecutionPlan과 함께, 그 안에서 이미 Simulation API로부터
 * 조회한 environmentId를 같이 돌려준다.
 *
 * 배경: SubmissionOrchestrator.runApprovalFlow()도 ParticipantSubmission.environmentId를
 * 채우기 위해 environmentId가 필요한데, 예전엔 buildExecutionPlan이 이미 조회한 값을 돌려줄
 * 방법이 없어서 runApprovalFlow가 같은 세션을 Simulation API에 한 번 더(중복) 조회했다.
 * 이 레코드로 그 중복 호출을 없앤다.
 *
 * userDecision.approved()==false 인 경우 buildExecutionPlan은 environmentId 조회 자체를
 * 생략한다(거절된 요청까지 굳이 Kit을 호출할 필요가 없어서) — 이 경우 environmentId는 null이며,
 * 호출자가 필요하면 직접 조회해야 한다.
 */
public record ExecutionPlanResult(ExecutionPlan executionPlan, String environmentId) {
}
