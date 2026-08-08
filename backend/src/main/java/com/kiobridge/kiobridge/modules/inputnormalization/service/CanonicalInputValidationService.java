package com.kiobridge.kiobridge.modules.inputnormalization.service;

import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationError;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.CanonicalInput;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.input.CanonicalInputValidationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.input.CanonicalInputValidationResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class CanonicalInputValidationService {

    private static final Set<String> RECONFIRMATION_CODES =
            Set.of(
                    "HARD_CONSTRAINT_UNKNOWN",
                    "LOW_CONFIDENCE_RECONFIRMATION_REQUIRED"
            );

    private final SimulationApiClient simulationApiClient;
    private final String teamId;
    private final String inputContractVersion;

    public CanonicalInputValidationService(
            SimulationApiClient simulationApiClient,
            @Value("${kiobridge.team-id}")
            String teamId,
            @Value("${kiobridge.input-contract-version}")
            String inputContractVersion
    ) {
        this.simulationApiClient = simulationApiClient;
        this.teamId = teamId;
        this.inputContractVersion = inputContractVersion;
    }

    public CanonicalInputValidationResponse validate(
            CanonicalInputValidationRequest request
    ) {
        CanonicalInput<ChickenStoreSessionContext> canonicalInput =
                new CanonicalInput<>(
                        inputContractVersion,
                        request.environmentId(),
                        teamId,
                        request.profile(),
                        request.sessionContext()
                );

        ContractValidationResult validation =
                simulationApiClient.validateCanonicalInput(
                        canonicalInput
                );

        NormalizationStatus status =
                determineStatus(validation);

        return new CanonicalInputValidationResponse(
                status,
                status == NormalizationStatus.VALID,
                canonicalInput,
                validation
        );
    }

    private NormalizationStatus determineStatus(
            ContractValidationResult validation
    ) {
        if (validation.valid()) {
            return NormalizationStatus.VALID;
        }

        boolean requiresReconfirmation =
                validation.errors().stream()
                        .anyMatch(this::requiresReconfirmation);

        return requiresReconfirmation
                ? NormalizationStatus.RECONFIRMATION_REQUIRED
                : NormalizationStatus.INVALID;
    }

    private boolean requiresReconfirmation(
            ContractValidationError error
    ) {
        return RECONFIRMATION_CODES.contains(
                error.code()
        );
    }
}