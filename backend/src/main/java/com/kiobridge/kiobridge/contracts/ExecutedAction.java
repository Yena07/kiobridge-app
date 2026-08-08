package com.kiobridge.kiobridge.contracts;

public record ExecutedAction(
    int actionIndex,
    String action,
    Target target,
    Object value,
    State expectedBeforeState,
    State expectedAfterState,
    String resultState,
    boolean ok,
    String resolvedLabel
) {}