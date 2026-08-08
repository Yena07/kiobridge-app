package com.kiobridge.kiobridge.modules.inputnormalization.service;

import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationError;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationResponse;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationResponse.ReconfirmationField;
import com.kiobridge.kiobridge.modules.inputnormalization.mapper.ChickenStoreSessionContextMapper;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
public class SessionContextNormalizationService {

    private static final Set<String> RECONFIRMATION_CODES =
            Set.of(
                    "HARD_CONSTRAINT_UNKNOWN",
                    "LOW_CONFIDENCE_RECONFIRMATION_REQUIRED"
            );

    private final ChickenStoreSessionContextMapper mapper;
    private final SimulationApiClient simulationApiClient;

    public SessionContextNormalizationService(
            ChickenStoreSessionContextMapper mapper,
            SimulationApiClient simulationApiClient
    ) {
        this.mapper = mapper;
        this.simulationApiClient = simulationApiClient;
    }

    public SessionContextNormalizationResponse normalize(
            SessionContextNormalizationRequest request
    ) {
        ChickenStoreSessionContext sessionContext =
                mapper.toSessionContext(request);

        ContractValidationResult validation =
                simulationApiClient.validateSessionContext(
                        request.environmentId(),
                        sessionContext
                );

        List<ReconfirmationField> reconfirmationFields =
                createReconfirmationFields(validation);

        NormalizationStatus status =
                determineStatus(
                        validation,
                        reconfirmationFields
                );

        return new SessionContextNormalizationResponse(
                status,
                sessionContext,
                reconfirmationFields,
                validation
        );
    }

    private NormalizationStatus determineStatus(
            ContractValidationResult validation,
            List<ReconfirmationField> reconfirmationFields
    ) {
        if (!reconfirmationFields.isEmpty()) {
            return NormalizationStatus
                    .RECONFIRMATION_REQUIRED;
        }

        return validation.valid()
                ? NormalizationStatus.VALID
                : NormalizationStatus.INVALID;
    }

    private List<ReconfirmationField> createReconfirmationFields(
            ContractValidationResult validation
    ) {
        return validation.errors().stream()
                .filter(this::requiresReconfirmation)
                .map(error -> new ReconfirmationField(
                        error.path(),
                        error.code(),
                        error.message()
                ))
                .toList();
    }

    private boolean requiresReconfirmation(
            ContractValidationError error
    ) {
        return RECONFIRMATION_CODES.contains(error.code());
    }
}