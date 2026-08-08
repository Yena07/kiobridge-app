package com.kiobridge.kiobridge.contracts.client.dto;

import tools.jackson.databind.JsonNode;

/**
 * POST /api/v1/sessions/:id/execute 응답.
 * 성공 시 run/evidence 가 채워지고, 검증 실패 시 validation 만 채워진다.
 * run/evidence 의 상세 구조는 담당4(resultprocessing)가 소비하므로
 * 여기서는 JsonNode 로 느슨하게 받아 그대로 전달한다.
 */
public record ExecuteResult(
    boolean valid,
    JsonNode run,
    JsonNode evidence,
    ValidationResult validation
) {}
