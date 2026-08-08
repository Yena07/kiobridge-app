package com.kiobridge.kiobridge.modules.inputnormalization.service;

import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationError;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.profile.CollectionChannel;
import com.kiobridge.kiobridge.contracts.input.profile.PreferredInput;
import com.kiobridge.kiobridge.contracts.input.profile.RetentionPolicy;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.AccessibilityInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.ConsentInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.InteractionInput;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest.ProfileInput;
import com.kiobridge.kiobridge.modules.inputnormalization.mapper.ProfileMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class ProfileNormalizationServiceTest {

    @Mock
    private SimulationApiClient simulationApiClient;

    private ProfileNormalizationService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);

        service = new ProfileNormalizationService(
                new ProfileMapper(),
                simulationApiClient,
                "WHATTHEBUG"
        );
    }

    @Test
    void 공식_검증에_성공하면_VALID을_반환한다() {
        when(simulationApiClient.validateProfile(any()))
                .thenReturn(new ContractValidationResult(
                        true,
                        "1.0.0",
                        List.of()
                ));

        var response = service.normalize(createRequest());

        assertThat(response.status())
                .isEqualTo(NormalizationStatus.VALID);

        assertThat(response.contractValidation().valid())
                .isTrue();

        assertThat(response.profile().source().providerId())
                .isEqualTo("WHATTHEBUG");
    }

    @Test
    void 공식_검증에_실패하면_INVALID를_반환한다() {
        var error = new ContractValidationError(
                "/interaction/preferredInput",
                "ENUM_VALUE_INVALID",
                "허용되지 않는 입력 방식입니다.",
                List.of("TOUCH", "VOICE"),
                null
        );

        when(simulationApiClient.validateProfile(any()))
                .thenReturn(new ContractValidationResult(
                        false,
                        "1.0.0",
                        List.of(error)
                ));

        var response = service.normalize(createRequest());

        assertThat(response.status())
                .isEqualTo(NormalizationStatus.INVALID);

        assertThat(response.contractValidation().errors())
                .hasSize(1);
    }

    private ProfileNormalizationRequest createRequest() {
        return new ProfileNormalizationRequest(
                "chicken-store",
                new ProfileInput(
                        "WHATTHEBUG-PROFILE-001",
                        "합성 사용자 1",
                        CollectionChannel.WEB_FORM,
                        Instant.parse("2026-08-01T05:30:00Z"),
                        new AccessibilityInput(
                                true,
                                true,
                                false,
                                false,
                                false,
                                true,
                                false
                        ),
                        new InteractionInput(
                                PreferredInput.TOUCH,
                                "ko-KR",
                                true
                        ),
                        new ConsentInput(
                                false,
                                RetentionPolicy.SESSION_ONLY
                        )
                )
        );
    }
}