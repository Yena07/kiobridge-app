package com.kiobridge.kiobridge.modules.inputnormalization.dto.context;

import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;

import java.util.List;

public record SessionContextNormalizationResponse(
        NormalizationStatus status,
        ChickenStoreSessionContext sessionContext,
        List<ReconfirmationField> reconfirmationFields,
        ContractValidationResult contractValidation
) {
    public SessionContextNormalizationResponse {
        reconfirmationFields = reconfirmationFields == null
                ? List.of()
                : List.copyOf(reconfirmationFields);
    }

    public record ReconfirmationField(
            String path,
            String reasonCode,
            String message
    ) {
    }
}