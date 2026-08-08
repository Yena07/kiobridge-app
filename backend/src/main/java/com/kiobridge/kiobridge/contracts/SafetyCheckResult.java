package com.kiobridge.kiobridge.contracts;

public record SafetyCheckResult(
    String ruleId,
    String outcome,
    String message,
    Integer actionIndex
) {}