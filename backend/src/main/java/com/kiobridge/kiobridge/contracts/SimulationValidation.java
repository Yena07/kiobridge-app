package com.kiobridge.kiobridge.contracts;

public record SimulationValidation(
    String result,
    boolean contractValid,
    boolean safetyValid,
    boolean stateTransitionValid,
    boolean boundaryReached,
    boolean requiredVerifierExecuted
) {}