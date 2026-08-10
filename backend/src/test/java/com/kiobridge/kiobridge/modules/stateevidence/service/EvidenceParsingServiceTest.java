package com.kiobridge.kiobridge.modules.stateevidence.service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.jackson.autoconfigure.JacksonAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EvidenceParsingServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final EvidenceParsingService service = new EvidenceParsingService(objectMapper);

    @Test
    void 필수_필드가_다있으면_정상_파싱된다() {
        JsonNode json = objectMapper.readTree(VALID_EVIDENCE_JSON);

        var evidence = service.parse(json);

        assertThat(evidence.result()).isEqualTo("PASS");
        assertThat(evidence.sessionId()).isEqualTo("SIM-1");
    }

    @Test
    void evidence가_null이면_예외가_발생한다() {
        assertThatThrownBy(() -> service.parse(null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void JSON_null_노드도_예외가_발생한다() {
        JsonNode nullNode = objectMapper.nullNode();

        assertThatThrownBy(() -> service.parse(nullNode))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 필수_필드가_없으면_예외가_발생한다() {
        JsonNode json = objectMapper.readTree("""
            { "evidenceVersion": "1.2", "runId": "RUN-1" }
            """);

        assertThatThrownBy(() -> service.parse(json))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("필수 필드가 없습니다");
    }

    private static final String VALID_EVIDENCE_JSON = """
        {
          "evidenceVersion": "1.2",
          "runId": "RUN-1",
          "sessionId": "SIM-1",
          "environmentId": "chicken-store",
          "fixtureVersion": "chicken-store@0.2.0",
          "submissionHash": "hash",
          "createdAt": "2026-08-10T00:00:00Z",
          "validationMode": "SIMULATION_ONLY",
          "executionEnvironment": "DIGITAL_TWIN",
          "actualDeviceCommandSent": false,
          "participantSubmissionUsed": true,
          "officialRecommendationGenerated": false,
          "profileSummary": {},
          "recommendation": null,
          "userDecision": null,
          "executionPlan": [],
          "executedActions": [],
          "stateHistory": [],
          "safetyChecks": [],
          "validationErrors": [],
          "plannedPaymentActionCount": 0,
          "executedPaymentActionCount": 0,
          "blockedPaymentActionCount": 0,
          "lastBusinessState": "CART_REVIEW",
          "terminalState": "STOP",
          "stopType": "NONE",
          "stopReason": "",
          "boundaryReached": true,
          "requiredVerifierExecuted": true,
          "submissionValid": true,
          "result": "PASS",
          "driverId": "SIMULATION",
          "driverStatus": "READY",
          "reviewSnapshot": {},
          "sessionContextSummary": {},
          "resultScope": "SIMULATION_VALIDATION_ONLY",
          "simulationValidation": {
            "result": "PASS", "contractValid": true, "safetyValid": true,
            "stateTransitionValid": true, "boundaryReached": true, "requiredVerifierExecuted": true
          }
        }
        """;
}