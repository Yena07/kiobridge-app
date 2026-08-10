package com.kiobridge.kiobridge.modules.stateevidence.service;

public record RunStep(
    int actionIndex,
    String action,
    String label,
    boolean success
) {}