package com.kiobridge.kiobridge.contracts.client;

import tools.jackson.databind.JsonNode;
import com.kiobridge.kiobridge.contracts.client.dto.ContractValidationResult;
import com.kiobridge.kiobridge.contracts.client.dto.InputContractResponse;
import com.kiobridge.kiobridge.contracts.client.dto.SupportedContractsResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class SimulationApiClientTest {

    private static final String BASE_URL =
            "http://localhost:4000";

    private MockRestServiceServer server;
    private SimulationApiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder()
                .baseUrl(BASE_URL);

        server = MockRestServiceServer
                .bindTo(builder)
                .build();

        client = new SimulationApiClient(builder.build());
    }

    @AfterEach
    void verifyServer() {
        server.verify();
    }

    @Test
    void 지원하는_계약_버전을_조회한다() {
        server.expect(
                        requestTo(BASE_URL + "/api/v1/contracts")
                )
                .andExpect(method(GET))
                .andRespond(withSuccess(
                        """
                        {
                          "supportedInputContractVersions": ["1.0.0"],
                          "defaultInputContractVersion": "1.0.0",
                          "supportedSubmissionVersions": ["1.0.0"],
                          "coreContractVersion": "1.0.0"
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        SupportedContractsResponse response =
                client.getSupportedContracts();

        assertThat(response.supportedInputContractVersions())
                .containsExactly("1.0.0");

        assertThat(response.defaultInputContractVersion())
                .isEqualTo("1.0.0");

        assertThat(response.supportedSubmissionVersions())
                .containsExactly("1.0.0");

        assertThat(response.coreContractVersion())
                .isEqualTo("1.0.0");
    }

    @Test
    void chickenStore의_입력_계약을_조회한다() {
        server.expect(
                        requestTo(
                                BASE_URL
                                        + "/api/v1/environments/chicken-store/input-contract"
                        )
                )
                .andExpect(method(GET))
                .andRespond(withSuccess(
                        """
                        {
                          "environmentId": "chicken-store",
                          "inputContractVersion": "1.0.0",
                          "schemaUrl": "/api/v1/schemas/chicken-store.context.schema.json",
                          "vocabularyUrl": "/api/v1/vocabularies/chicken-store",
                          "requiredFields": [
                            "intent",
                            "facts",
                            "preferences",
                            "hardConstraints",
                            "capabilities"
                          ],
                          "optionalFields": [
                            "fieldMetadata"
                          ]
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        InputContractResponse response =
                client.getInputContract("chicken-store");

        assertThat(response.environmentId())
                .isEqualTo("chicken-store");

        assertThat(response.inputContractVersion())
                .isEqualTo("1.0.0");

        assertThat(response.requiredFields())
                .containsExactly(
                        "intent",
                        "facts",
                        "preferences",
                        "hardConstraints",
                        "capabilities"
                );

        assertThat(response.optionalFields())
                .containsExactly("fieldMetadata");
    }

    @Test
    void chickenStore의_vocabulary를_조회한다() {
        server.expect(
                        requestTo(
                                BASE_URL
                                        + "/api/v1/vocabularies/chicken-store"
                        )
                )
                .andExpect(method(GET))
                .andRespond(withSuccess(
                        """
                        {
                          "vocabularyVersion": "1.0.0",
                          "environmentId": "chicken-store",
                          "preferences": {
                            "serviceType": [
                              "DINE_IN",
                              "TAKE_OUT",
                              "NO_PREFERENCE",
                              "UNKNOWN"
                            ],
                            "spicyLevel": [
                              "MILD",
                              "MEDIUM",
                              "HOT",
                              "NO_PREFERENCE",
                              "UNKNOWN"
                            ]
                          },
                          "hardConstraints": {
                            "allergenIds": [
                              "PEANUT",
                              "SOY",
                              "MILK",
                              "EGG",
                              "WHEAT",
                              "SHRIMP",
                              "UNKNOWN"
                            ]
                          }
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        JsonNode vocabulary =
                client.getVocabulary("chicken-store");

        assertThat(vocabulary.path("environmentId").asText())
                .isEqualTo("chicken-store");

        assertThat(
                vocabulary
                        .path("preferences")
                        .path("serviceType")
                        .isArray()
        ).isTrue();

        assertThat(
                vocabulary
                        .path("preferences")
                        .path("serviceType")
                        .toString()
        ).contains("TAKE_OUT");

        assertThat(
                vocabulary
                        .path("hardConstraints")
                        .path("allergenIds")
                        .toString()
        ).contains("PEANUT");
    }

    @Test
    void Profile_검증_성공_결과를_반환한다() {
        server.expect(
                        requestTo(
                                BASE_URL
                                        + "/api/v1/contracts/profile/validate"
                        )
                )
                .andExpect(method(POST))
                .andExpect(
                        content().contentType(MediaType.APPLICATION_JSON)
                )
                .andExpect(content().json(
                        """
                        {
                          "profileId": "WHATTHEBUG-DEMO-001"
                        }
                        """
                ))
                .andRespond(withSuccess(
                        """
                        {
                          "valid": true,
                          "contractVersion": "1.0.0",
                          "errors": []
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        Map<String, Object> profile = Map.of(
                "profileId",
                "WHATTHEBUG-DEMO-001"
        );

        ContractValidationResult response =
                client.validateProfile(profile);

        assertThat(response.valid()).isTrue();

        assertThat(response.contractVersion())
                .isEqualTo("1.0.0");

        assertThat(response.errors()).isEmpty();
    }

    @Test
    void Profile_계약_위반은_예외가_아닌_검증_실패로_반환한다() {
        server.expect(
                        requestTo(
                                BASE_URL
                                        + "/api/v1/contracts/profile/validate"
                        )
                )
                .andExpect(method(POST))
                .andRespond(withSuccess(
                        """
                        {
                          "valid": false,
                          "contractVersion": "1.0.0",
                          "errors": [
                            {
                              "path": "/interaction/preferredInput",
                              "code": "ENUM_VALUE_INVALID",
                              "message": "허용되지 않는 입력 방식입니다.",
                              "allowedValues": [
                                "TOUCH",
                                "VOICE",
                                "KEYBOARD",
                                "ASSISTED",
                                "MULTIMODAL"
                              ],
                              "receivedValue": "MOUSE"
                            }
                          ]
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        ContractValidationResult response =
                client.validateProfile(
                        Map.of("profileId", "INVALID-PROFILE")
                );

        assertThat(response.valid()).isFalse();
        assertThat(response.errors()).hasSize(1);

        assertThat(response.errors().getFirst().code())
                .isEqualTo("ENUM_VALUE_INVALID");

        assertThat(response.errors().getFirst().path())
                .isEqualTo("/interaction/preferredInput");

        assertThat(response.errors().getFirst().allowedValues())
                .contains("TOUCH", "VOICE");

        assertThat(
                response
                        .errors()
                        .getFirst()
                        .receivedValue()
                        .asText()
        ).isEqualTo("MOUSE");
    }

    @Test
    void SessionContext를_environmentId와_함께_검증한다() {
        server.expect(
                        requestTo(
                                BASE_URL
                                        + "/api/v1/contracts/session-context/validate"
                        )
                )
                .andExpect(method(POST))
                .andExpect(
                        content().contentType(MediaType.APPLICATION_JSON)
                )
                .andExpect(content().json(
                        """
                        {
                          "environmentId": "chicken-store",
                          "sessionContext": {
                            "hardConstraints": {
                              "allergenIds": ["PEANUT"]
                            }
                          }
                        }
                        """
                ))
                .andRespond(withSuccess(
                        """
                        {
                          "valid": true,
                          "contractVersion": "1.0.0",
                          "errors": []
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        Map<String, Object> sessionContext = Map.of(
                "hardConstraints",
                Map.of(
                        "allergenIds",
                        List.of("PEANUT")
                )
        );

        ContractValidationResult response =
                client.validateSessionContext(
                        "chicken-store",
                        sessionContext
                );

        assertThat(response.valid()).isTrue();
        assertThat(response.errors()).isEmpty();
    }

    @Test
    void CanonicalInput을_통합_검증한다() {
        server.expect(
                        requestTo(
                                BASE_URL
                                        + "/api/v1/contracts/input/validate"
                        )
                )
                .andExpect(method(POST))
                .andExpect(
                        content().contentType(MediaType.APPLICATION_JSON)
                )
                .andExpect(content().json(
                        """
                        {
                          "inputContractVersion": "1.0.0",
                          "teamId": "WHATTHEBUG",
                          "environmentId": "chicken-store",
                          "profile": {
                            "profileId": "WHATTHEBUG-DEMO-001"
                          },
                          "sessionContext": {
                            "intent": {
                              "task": "ORDER_FOOD"
                            }
                          }
                        }
                        """
                ))
                .andRespond(withSuccess(
                        """
                        {
                          "valid": true,
                          "contractVersion": "1.0.0",
                          "errors": []
                        }
                        """,
                        MediaType.APPLICATION_JSON
                ));

        Map<String, Object> canonicalInput = Map.of(
                "inputContractVersion", "1.0.0",
                "teamId", "WHATTHEBUG",
                "environmentId", "chicken-store",
                "profile", Map.of(
                        "profileId",
                        "WHATTHEBUG-DEMO-001"
                ),
                "sessionContext", Map.of(
                        "intent",
                        Map.of("task", "ORDER_FOOD")
                )
        );

        ContractValidationResult response =
                client.validateCanonicalInput(canonicalInput);

        assertThat(response.valid()).isTrue();
        assertThat(response.errors()).isEmpty();
    }

    @Test
    void Simulation_API의_5xx_응답은_HTTP_예외로_처리한다() {
        server.expect(
                        requestTo(BASE_URL + "/api/v1/contracts")
                )
                .andExpect(method(GET))
                .andRespond(
                        withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(
                                        """
                                        {
                                          "message": "Internal Server Error"
                                        }
                                        """
                                )
                );

        assertThatThrownBy(
                () -> client.getSupportedContracts()
        ).isInstanceOf(RestClientResponseException.class);
    }
}