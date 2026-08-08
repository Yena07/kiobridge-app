package com.kiobridge.kiobridge.modules.inputnormalization.dto.input;

import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record CanonicalInputValidationRequest(

        @NotBlank
        @Pattern(
                regexp = "^chicken-store$",
                message = "P0에서는 chicken-store 환경만 지원합니다."
        )
        String environmentId,

        @Valid
        @NotNull
        CanonicalProfile profile,

        @Valid
        @NotNull
        ChickenStoreSessionContext sessionContext
) {
}