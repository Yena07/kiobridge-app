package com.kiobridge.kiobridge.contracts.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import tools.jackson.databind.JsonNode;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ContractValidationError(
        String path,
        String code,
        String message,
        List<String> allowedValues,
        JsonNode receivedValue
) {
}