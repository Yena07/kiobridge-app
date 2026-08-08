package com.kiobridge.kiobridge.modules.executionplan.controller.dto;

import com.kiobridge.kiobridge.contracts.ExecutionPlan;

/** POST /internal/plan/build 응답. */
public record BuildExecutionPlanResponse(ExecutionPlan executionPlan) {}
