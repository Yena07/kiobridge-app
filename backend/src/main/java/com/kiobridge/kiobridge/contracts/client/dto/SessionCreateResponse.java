package com.kiobridge.kiobridge.contracts.client.dto;

/** POST /api/v1/sessions 응답. */
public record SessionCreateResponse(
    String sessionId,
    String environmentId,
    String fixtureVersion,
    String initialState,
    String submissionStatus,
    String validationMode,
    String executionEnvironment,
    String driverId,
    String submissionEndpoint
) {}
