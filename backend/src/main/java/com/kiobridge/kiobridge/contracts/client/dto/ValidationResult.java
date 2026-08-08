package com.kiobridge.kiobridge.contracts.client.dto;

import java.util.List;

/** POST /api/v1/sessions/:id/validate 응답. */
public record ValidationResult(
    boolean valid,
    List<ValidationError> errors
) {}
