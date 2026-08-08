package com.kiobridge.kiobridge.contracts.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SupportedContractsResponse(
        List<String> supportedInputContractVersions,
        String defaultInputContractVersion,
        List<String> supportedSubmissionVersions,
        String coreContractVersion
) {
}