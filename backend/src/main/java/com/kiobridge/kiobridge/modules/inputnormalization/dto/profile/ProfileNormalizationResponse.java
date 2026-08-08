package com.kiobridge.kiobridge.modules.inputnormalization.dto.profile;

import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;

public record ProfileNormalizationResponse(
        NormalizationStatus status,
        CanonicalProfile profile,
        ContractValidationResult contractValidation
) {
}