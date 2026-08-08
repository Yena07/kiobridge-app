package com.kiobridge.kiobridge.contracts.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InputContractResponse(
        String environmentId,
        String inputContractVersion,
        String schemaUrl,
        String vocabularyUrl,
        List<String> requiredFields,
        List<String> optionalFields
) {
}