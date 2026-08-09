package com.kiobridge.kiobridge.contracts.client;

import com.kiobridge.kiobridge.contracts.CompatibilityRuleSet;
import com.kiobridge.kiobridge.contracts.Evidence;
import com.kiobridge.kiobridge.contracts.PublicFixture;
import tools.jackson.databind.JsonNode;
import com.kiobridge.kiobridge.contracts.ParticipantSubmission;
import com.kiobridge.kiobridge.contracts.client.dto.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * KioBridge Simulation API(:4000) 전용 클라이언트.
 * 세션 생성 -> 제출 -> 검증 -> 실행 순서를 그대로 호출한다.
 * 기존에 계획했던 "기존 Agent adapter"는 개발하지 않으며, 이 클래스가 그 역할을 대체한다.
 *
 * base-url 은 application.yaml 의 kiobridge.simulation-api.base-url 로 주입한다.
 * connect/read timeout을 명시하지 않으면 Simulation API가 응답하지 않을 때 호출 스레드가
 * 무기한 블로킹될 수 있어 반드시 설정한다 (kiobridge.simulation-api.connect-timeout-ms / read-timeout-ms).
 */
@Component
public class SimulationApiClient {

    private final RestClient restClient;

    @Autowired
    public SimulationApiClient(
        @Value("${kiobridge.simulation-api.base-url}") String baseUrl,
        @Value("${kiobridge.simulation-api.connect-timeout-ms:3000}") int connectTimeoutMs,
        @Value("${kiobridge.simulation-api.read-timeout-ms:10000}") int readTimeoutMs
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);

        this.restClient = RestClient.builder()
            .baseUrl(baseUrl)
            .requestFactory(requestFactory)
            .build();
    }
    SimulationApiClient(RestClient restClient) {
        this.restClient = restClient;
    }


    /** POST /api/v1/sessions */
    public SessionCreateResponse createSession(String environmentId) {
        return restClient.post()
            .uri("/api/v1/sessions")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("environmentId", environmentId))
            .retrieve()
            .body(SessionCreateResponse.class);
    }

    /** POST /api/v1/sessions/:sessionId/submission — 저장만 하고 상태를 SUBMITTED로 바꾼다. */
    public void submit(String sessionId, ParticipantSubmission submission) {
        restClient.post()
            .uri("/api/v1/sessions/{sessionId}/submission", sessionId)
            .contentType(MediaType.APPLICATION_JSON)
            .body(submission)
            .retrieve()
            .toBodilessEntity();
    }

    /** POST /api/v1/sessions/:sessionId/validate — 스키마+시맨틱+상태머신 dry-run. */
    public ValidationResult validate(String sessionId) {
        return restClient.post()
            .uri("/api/v1/sessions/{sessionId}/validate", sessionId)
            .retrieve()
            .body(ValidationResult.class);
    }

    /** POST /api/v1/sessions/:sessionId/execute — 검증 통과분만 Simulation Driver로 재생. */
    public ExecuteResult execute(String sessionId) {
        return restClient.post()
            .uri("/api/v1/sessions/{sessionId}/execute", sessionId)
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of())
            .retrieve()
            .body(ExecuteResult.class);
    }

    /** GET /api/v1/sessions/:sessionId — 세션 상태 조회. environmentId를 클라이언트 재신고 없이 다시 확인할 때 쓴다. */
    public SessionStatusResponse getSession(String sessionId) {
        return restClient.get()
            .uri("/api/v1/sessions/{sessionId}", sessionId)
            .retrieve()
            .body(SessionStatusResponse.class);
    }

    /** GET /api/v1/sessions/:sessionId/evidence — evidence 조회 */
    public Evidence getEvidence(String sessionId) {
        return restClient.get()
            .uri("/api/v1/sessions/{sessionId}/evidence", sessionId)
            .retrieve()
            .body(Evidence.class);
    }

    /** GET /api/v1/contracts — 지원하는 계약 버전을 조회한다. */
    public SupportedContractsResponse getSupportedContracts() {
        return restClient.get()
                .uri("/api/v1/contracts")
                .retrieve()
                .body(SupportedContractsResponse.class);
    }

    /** GET /api/v1/environments/:environmentId/input-contract */
    public InputContractResponse getInputContract(String environmentId) {
        return restClient.get()
                .uri(
                        "/api/v1/environments/{environmentId}/input-contract",
                        environmentId
                )
                .retrieve()
                .body(InputContractResponse.class);
    }

    /** GET /api/v1/environments/:environmentId/fixture */
    public PublicFixture getFixture(String environmentId) {
        return restClient.get()
                .uri("/api/v1/environments/{environmentId}/fixture", environmentId)
                .retrieve()
                .body(PublicFixture.class);
    }

    /** GET /api/v1/environments/:environmentId/compatibility-rules */
    public CompatibilityRuleSet getCompatibilityRules(String environmentId) {
        return restClient.get()
                .uri("/api/v1/environments/{environmentId}/compatibility-rules", environmentId)
                .retrieve()
                .body(CompatibilityRuleSet.class);
    }

    /** GET /api/v1/vocabularies/:environmentId */
    public JsonNode getVocabulary(String environmentId) {
        return restClient.get()
                .uri(
                        "/api/v1/vocabularies/{environmentId}",
                        environmentId
                )
                .retrieve()
                .body(JsonNode.class);
    }

    /** POST /api/v1/contracts/profile/validate */
    public ContractValidationResult validateProfile(Object profile) {
        return restClient.post()
                .uri("/api/v1/contracts/profile/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(profile)
                .retrieve()
                .body(ContractValidationResult.class);
    }

    /** POST /api/v1/contracts/session-context/validate */
    public ContractValidationResult validateSessionContext(
            String environmentId,
            Object sessionContext
    ) {
        Map<String, Object> request = Map.of(
                "environmentId", environmentId,
                "sessionContext", sessionContext
        );

        return restClient.post()
                .uri("/api/v1/contracts/session-context/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(ContractValidationResult.class);
    }

    /** POST /api/v1/contracts/input/validate */
    public ContractValidationResult validateCanonicalInput(
            Object canonicalInput
    ) {
        return restClient.post()
                .uri("/api/v1/contracts/input/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(canonicalInput)
                .retrieve()
                .body(ContractValidationResult.class);
    }
}
