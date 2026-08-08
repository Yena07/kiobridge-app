package com.kiobridge.kiobridge.contracts;

import java.util.Map;

public record ExecutionEvent(
    String type,
    int actionIndex,
    String message,
    Map<String, Object> target,
    String fromState,
    String toState,
    Map<String, Object> uiState
) {}