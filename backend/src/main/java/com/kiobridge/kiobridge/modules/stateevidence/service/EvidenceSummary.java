package com.kiobridge.kiobridge.modules.stateevidence.service;

public record EvidenceSummary(
    String status,
    String recommendation,
    String stopReason
) {}