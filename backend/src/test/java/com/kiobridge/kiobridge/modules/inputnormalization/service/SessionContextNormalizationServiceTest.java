package com.kiobridge.kiobridge.modules.inputnormalization.service;

import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationError;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.context.MetadataSource;
import com.kiobridge.kiobridge.contracts.input.context.SessionTask;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.NormalizationStatus;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest.CollectionMetadata;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest.ContextInput;
import com.kiobridge.kiobridge.modules.inputnormalization.mapper.ChickenStoreSessionContextMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionContextNormalizationServiceTest {

    @Mock
    private SimulationApiClient simulationApiClient;

    private SessionContextNormalizationService service;

    @BeforeEach
    void setUp() {
        service = new SessionContextNormalizationService(
                new ChickenStoreSessionContextMapper(),
                simulationApiClient
        );
    }

    @Test
    void 공식_검증에_성공하면_VALID을_반환한다() {
        when(simulationApiClient.validateSessionContext(
                eq("chicken-store"),
                any(ChickenStoreSessionContext.class)
        )).thenReturn(new ContractValidationResult(
                true,
                "1.0.0",
                List.of()
        ));

        var response = service.normalize(
                createRequest()
        );

        assertThat(response.status())
                .isEqualTo(NormalizationStatus.VALID);

        assertThat(response.contractValidation().valid())
                .isTrue();

        assertThat(response.reconfirmationFields())
                .isEmpty();

        assertThat(response.sessionContext().intent().task())
                .isEqualTo(SessionTask.ORDER_FOOD);

        verify(simulationApiClient)
                .validateSessionContext(
                        eq("chicken-store"),
                        any(ChickenStoreSessionContext.class)
                );
    }

    @Test
    void 일반_계약_위반이면_INVALID를_반환한다() {
        var error = new ContractValidationError(
                "/preferences/quantity",
                "MINIMUM_VIOLATION",
                "quantity는 1 이상이어야 합니다.",
                List.of(),
                null
        );

        when(simulationApiClient.validateSessionContext(
                eq("chicken-store"),
                any(ChickenStoreSessionContext.class)
        )).thenReturn(new ContractValidationResult(
                false,
                "1.0.0",
                List.of(error)
        ));

        var response = service.normalize(
                createRequest()
        );

        assertThat(response.status())
                .isEqualTo(NormalizationStatus.INVALID);

        assertThat(response.contractValidation().valid())
                .isFalse();

        assertThat(response.contractValidation().errors())
                .containsExactly(error);

        assertThat(response.reconfirmationFields())
                .isEmpty();
    }

    @Test
    void 알레르기_UNKNOWN이면_재확인_상태를_반환한다() {
        var error = new ContractValidationError(
                "/hardConstraints/allergenIds",
                "HARD_CONSTRAINT_UNKNOWN",
                "알레르기 정보를 다시 확인해야 합니다.",
                List.of(),
                null
        );

        when(simulationApiClient.validateSessionContext(
                eq("chicken-store"),
                any(ChickenStoreSessionContext.class)
        )).thenReturn(new ContractValidationResult(
                false,
                "1.0.0",
                List.of(error)
        ));

        var response = service.normalize(
                createRequest()
        );

        assertThat(response.status())
                .isEqualTo(
                        NormalizationStatus
                                .RECONFIRMATION_REQUIRED
                );

        assertThat(response.reconfirmationFields())
                .hasSize(1);

        var reconfirmation =
                response.reconfirmationFields().getFirst();

        assertThat(reconfirmation.path())
                .isEqualTo(
                        "/hardConstraints/allergenIds"
                );

        assertThat(reconfirmation.reasonCode())
                .isEqualTo(
                        "HARD_CONSTRAINT_UNKNOWN"
                );

        assertThat(reconfirmation.message())
                .isEqualTo(
                        "알레르기 정보를 다시 확인해야 합니다."
                );
    }

    @Test
    void 낮은_신뢰도이고_사용자_확인이_없으면_재확인_상태를_반환한다() {
        var error = new ContractValidationError(
                "/fieldMetadata/~1preferences~1spicyLevel",
                "LOW_CONFIDENCE_RECONFIRMATION_REQUIRED",
                "신뢰도가 낮아 사용자 확인이 필요합니다.",
                List.of(),
                null
        );

        when(simulationApiClient.validateSessionContext(
                eq("chicken-store"),
                any(ChickenStoreSessionContext.class)
        )).thenReturn(new ContractValidationResult(
                false,
                "1.0.0",
                List.of(error)
        ));

        var response = service.normalize(
                createRequest()
        );

        assertThat(response.status())
                .isEqualTo(
                        NormalizationStatus
                                .RECONFIRMATION_REQUIRED
                );

        assertThat(response.reconfirmationFields())
                .singleElement()
                .satisfies(field -> {
                    assertThat(field.reasonCode())
                            .isEqualTo(
                                    "LOW_CONFIDENCE_RECONFIRMATION_REQUIRED"
                            );
                });
    }

    @Test
    void 재확인_오류와_일반_오류가_함께_있으면_재확인을_우선한다() {
        var reconfirmationError =
                new ContractValidationError(
                        "/hardConstraints/allergenIds",
                        "HARD_CONSTRAINT_UNKNOWN",
                        "알레르기 확인이 필요합니다.",
                        List.of(),
                        null
                );

        var validationError =
                new ContractValidationError(
                        "/preferences/quantity",
                        "MINIMUM_VIOLATION",
                        "quantity는 1 이상이어야 합니다.",
                        List.of(),
                        null
                );

        when(simulationApiClient.validateSessionContext(
                eq("chicken-store"),
                any(ChickenStoreSessionContext.class)
        )).thenReturn(new ContractValidationResult(
                false,
                "1.0.0",
                List.of(
                        reconfirmationError,
                        validationError
                )
        ));

        var response = service.normalize(
                createRequest()
        );

        assertThat(response.status())
                .isEqualTo(
                        NormalizationStatus
                                .RECONFIRMATION_REQUIRED
                );

        assertThat(response.reconfirmationFields())
                .hasSize(1);

        assertThat(
                response.reconfirmationFields()
                        .getFirst()
                        .reasonCode()
        ).isEqualTo("HARD_CONSTRAINT_UNKNOWN");

        assertThat(response.contractValidation().errors())
                .hasSize(2);
    }

    private SessionContextNormalizationRequest createRequest() {
        return new SessionContextNormalizationRequest(
                "chicken-store",
                new ContextInput(
                        "포장",
                        "매운맛",
                        "순살",
                        "종이컵",
                        2,
                        List.of("땅콩"),
                        new BigDecimal("20000")
                ),
                new CollectionMetadata(
                        MetadataSource.WEB_FORM,
                        new BigDecimal("1.0"),
                        true,
                        Instant.parse(
                                "2026-08-06T12:00:00Z"
                        )
                )
        );
    }
}