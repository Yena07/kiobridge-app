package com.kiobridge.kiobridge.contracts.input.context;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FieldMetadata(
        MetadataSource source,
        BigDecimal confidence,
        boolean confirmedByUser,
        Instant capturedAt,
        String normalizerId,
        String originalValueHash
) {
}