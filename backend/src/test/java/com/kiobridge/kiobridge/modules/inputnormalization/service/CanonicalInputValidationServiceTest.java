package com.kiobridge.kiobridge.modules.inputnormalization.service;

import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationError;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.CanonicalInput;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.input.CanonicalInputValidationRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanonicalInputValidationServiceTest {

    @Mock
    private SimulationApiClient simulationApiClient;

    @Mock
    private CanonicalProfile profile;

    @Mock
    private ChickenStoreSessionContext sessionContext;

    private CanonicalInputValidationService service;

    @BeforeEach
    void setUp() {
        service = new CanonicalInputValidationService(
                simulationApiClient,
                "WHATTHEBUG",
                "1.0.0"
        );
    }

    @Test
    void 통합_검증에_성공하면_추천_가능_상태를_반환한다() {
        when(simulationApiClient.validateCanonicalInput(any()))
                .thenReturn(new ContractValidationResult(
                        true,
                        "1.0.0",
                        List.of()
                ));

        var response = service.validate(createRequest());

        assertThat(response.status())
                .isEqualTo(NormalizationStatus.VALID);

        assertThat(response.recommendationReady())
                .isTrue();

        assertThat(response.contractValidation().valid())
                .isTrue();

        ArgumentCaptor<Object> captor =
                ArgumentCaptor.forClass(Object.class);

        verify(simulationApiClient)
                .validateCanonicalInput(captor.capture());

        assertThat(captor.getValue())
                .isInstanceOf(CanonicalInput.class);

        CanonicalInput<?> input =
                (CanonicalInput<?>) captor.getValue();

        assertThat(input.inputContractVersion())
                .isEqualTo("1.0.0");

        assertThat(input.teamId())
                .isEqualTo("WHATTHEBUG");

        assertThat(input.environmentId())
                .isEqualTo("chicken-store");

        assertThat(input.profile())
                .isSameAs(profile);

        assertThat(input.sessionContext())
                .isSameAs(sessionContext);
    }

    @Test
    void 재확인_오류가_있으면_재확인_상태를_반환한다() {
        var error = createError(
                "HARD_CONSTRAINT_UNKNOWN"
        );

        when(simulationApiClient.validateCanonicalInput(any()))
                .thenReturn(new ContractValidationResult(
                        false,
                        "1.0.0",
                        List.of(error)
                ));

        var response = service.validate(createRequest());

        assertThat(response.status())
                .isEqualTo(
                        NormalizationStatus.RECONFIRMATION_REQUIRED
                );

        assertThat(response.recommendationReady())
                .isFalse();
    }

    @Test
    void 일반_계약_오류만_있으면_INVALID를_반환한다() {
        var error = createError(
                "ENUM_VALUE_INVALID"
        );

        when(simulationApiClient.validateCanonicalInput(any()))
                .thenReturn(new ContractValidationResult(
                        false,
                        "1.0.0",
                        List.of(error)
                ));

        var response = service.validate(createRequest());

        assertThat(response.status())
                .isEqualTo(NormalizationStatus.INVALID);

        assertThat(response.recommendationReady())
                .isFalse();
    }

    @Test
    void 재확인과_일반_오류가_함께_있으면_재확인을_우선한다() {
        var reconfirmationError = createError(
                "HARD_CONSTRAINT_UNKNOWN"
        );

        var validationError = createError(
                "ENUM_VALUE_INVALID"
        );

        when(simulationApiClient.validateCanonicalInput(any()))
                .thenReturn(new ContractValidationResult(
                        false,
                        "1.0.0",
                        List.of(
                                reconfirmationError,
                                validationError
                        )
                ));

        var response = service.validate(createRequest());

        assertThat(response.status())
                .isEqualTo(
                        NormalizationStatus.RECONFIRMATION_REQUIRED
                );

        assertThat(response.recommendationReady())
                .isFalse();

        assertThat(response.contractValidation().errors())
                .containsExactly(
                        reconfirmationError,
                        validationError
                );
    }

    private CanonicalInputValidationRequest createRequest() {
        return new CanonicalInputValidationRequest(
                "chicken-store",
                profile,
                sessionContext
        );
    }

    private ContractValidationError createError(
            String code
    ) {
        return new ContractValidationError(
                "/sessionContext",
                code,
                "통합 검증 오류",
                List.of(),
                null
        );
    }
}