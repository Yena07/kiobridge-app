package com.kiobridge.kiobridge.contracts;

import java.util.List;
import java.util.Map;

public record RunResult(
    List<ExecutedAction> executedActions,
    List<ExecutionEvent> events,
    List<String> stateHistory,
    List<SafetyCheckResult> safetyChecks,
    String lastBusinessState,
    String terminalState,
    String stopType,
    String stopReason,
    boolean boundaryReached,
    boolean requiredVerifierExecuted,
    int plannedPaymentActionCount,
    int executedPaymentActionCount,
    int blockedPaymentActionCount,
    Map<String, Object> reviewSnapshot,
    Map<String, Object> finalUiState,
    boolean stopped
) {}