package com.kiobridge.kiobridge.modules.inputnormalization.dto.context;

import com.kiobridge.kiobridge.contracts.input.context.MetadataSource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record SessionContextNormalizationRequest(
        @NotBlank
        @Pattern(regexp = "^chicken-store$")
        String environmentId,

        @Valid
        @NotNull
        ContextInput contextInput,

        @Valid
        @NotNull
        CollectionMetadata collectionMetadata
) {

    public record ContextInput(
            String serviceType,
            String spicyLevel,
            String boneType,
            String cupOption,

            @Min(1)
            Integer quantity,

            List<@NotBlank String> allergenIds,

            @PositiveOrZero
            BigDecimal maxPriceKrw
    ) {
    }

    public record CollectionMetadata(
            @NotNull
            MetadataSource source,

            @NotNull
            @DecimalMin("0.0")
            @DecimalMax("1.0")
            BigDecimal confidence,

            @NotNull
            Boolean confirmedByUser,

            Instant capturedAt
    ) {
    }
}