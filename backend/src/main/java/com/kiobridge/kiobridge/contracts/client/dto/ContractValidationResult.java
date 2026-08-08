package com.kiobridge.kiobridge.contracts.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ContractValidationResult(
        boolean valid,
        String contractVersion,
        List<ContractValidationError> errors
) {
    public ContractValidationResult {
        errors = errors == null
                ? List.of()
                : List.copyOf(errors);
    }
}