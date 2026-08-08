package com.kiobridge.kiobridge.modules.inputnormalization.dto.input;

import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.CanonicalInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;

public record CanonicalInputValidationResponse(
        NormalizationStatus status,
        boolean recommendationReady,
        CanonicalInput<?> canonicalInput,
        ContractValidationResult contractValidation
) {
}