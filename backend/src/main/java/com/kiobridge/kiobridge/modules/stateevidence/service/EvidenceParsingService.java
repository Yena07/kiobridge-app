package com.kiobridge.kiobridge.modules.stateevidence.service;

import com.kiobridge.kiobridge.contracts.Evidence;
import com.kiobridge.kiobridge.contracts.RunResult;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * ExecuteResult.evidence()/run()로 오는 JsonNode를 각각 Evidence/RunResult 타입으로 변환한다.
 * Simulation API 응답이 evidence.schema.json 기준을 따른다는 전제 하에 동작하며,
 * 필수 필드가 없거나 형식이 다르면 예외를 던진다.
 */
@Service
public class EvidenceParsingService {

    private static final String[] REQUIRED_FIELDS = {
        "evidenceVersion", "runId", "sessionId", "environmentId", "fixtureVersion",
        "submissionHash", "createdAt", "validationMode", "executionEnvironment",
        "result", "stopType", "resultScope"
    };

    private final ObjectMapper objectMapper;

    public EvidenceParsingService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public Evidence parse(JsonNode evidenceJson) {
        if (evidenceJson == null || evidenceJson.isNull()) {
            throw new IllegalArgumentException("evidence가 비어 있습니다.");
        }
        validateRequiredFields(evidenceJson);
        try {
            return objectMapper.treeToValue(evidenceJson, Evidence.class);
        } catch (Exception e) {
            throw new IllegalStateException(
                "evidence JSON을 Evidence 타입으로 변환하지 못했습니다: " + e.getMessage(), e
            );
        }
    }

    /** ExecuteResult.run()으로 오는 JsonNode를 RunResult로 변환한다. run이 없으면 null을 반환한다. */
    public RunResult parseRun(JsonNode runJson) {
        if (runJson == null || runJson.isNull()) {
            return null;
        }
        try {
            return objectMapper.treeToValue(runJson, RunResult.class);
        } catch (Exception e) {
            throw new IllegalStateException(
                "run JSON을 RunResult 타입으로 변환하지 못했습니다: " + e.getMessage(), e
            );
        }
    }

    private void validateRequiredFields(JsonNode evidenceJson) {
        for (String field : REQUIRED_FIELDS) {
            if (!evidenceJson.has(field) || evidenceJson.get(field).isNull()) {
                throw new IllegalStateException(
                    "evidence JSON에 필수 필드가 없습니다: " + field
                );
            }
        }
    }
}