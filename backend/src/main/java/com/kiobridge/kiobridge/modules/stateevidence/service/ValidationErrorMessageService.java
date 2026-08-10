package com.kiobridge.kiobridge.modules.stateevidence.service;

import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Kit의 docs/ERROR_CATALOG.md 기준 검증 오류 코드를 사용자 친화적 문장으로 변환한다.
 */
@Service
public class ValidationErrorMessageService {

    private static final Map<String, String> FRIENDLY_MESSAGES = Map.ofEntries(
        // 1. 계약·형식
        Map.entry("SCHEMA_INVALID", "입력하신 정보의 형식이 올바르지 않습니다."),
        Map.entry("REQUIRED_FIELD_MISSING", "필수 정보가 빠졌습니다."),
        Map.entry("ENUM_VALUE_INVALID", "선택하신 값이 지원되지 않는 옵션입니다."),
        Map.entry("TYPE_MISMATCH", "입력하신 정보의 형식이 올바르지 않습니다."),
        Map.entry("PERSONAL_DATA_NOT_ALLOWED", "실제 개인정보는 사용할 수 없습니다."),

        // 2. 후보
        Map.entry("CANDIDATE_NOT_FOUND", "추천된 메뉴를 찾을 수 없습니다."),
        Map.entry("CANDIDATE_UNAVAILABLE", "선택하신 메뉴는 현재 품절입니다."),
        Map.entry("ALLERGEN_CONFLICT", "등록하신 알레르기와 겹치는 메뉴입니다."),
        Map.entry("PRICE_LIMIT_EXCEEDED", "설정하신 가격 한도를 초과했습니다."),

        // 4. 실행계획 구조
        Map.entry("USER_NOT_APPROVED", "먼저 주문을 확인하고 승인해 주세요."),
        Map.entry("FORBIDDEN_ACTION", "허용되지 않는 동작이 포함되어 처리할 수 없습니다."),
        Map.entry("EXECUTION_REQUIRED_OPTION_MISSING", "필수 옵션을 선택해 주세요."),
        Map.entry("OPTION_NOT_SUPPORTED_BY_CANDIDATE", "선택하신 메뉴에서 지원하지 않는 옵션입니다."),

        // 5. 상태·안전 경계
        Map.entry("BOUNDARY_NOT_REACHED", "주문 확인 단계까지 진행하지 못했습니다."),
        Map.entry("MISSING_VERIFIER", "최종 확인 절차가 누락되었습니다.")
    );

    private static final String DEFAULT_MESSAGE = "요청을 처리하는 중 문제가 발생했습니다.";

    public String toFriendlyMessage(String code) {
        return FRIENDLY_MESSAGES.getOrDefault(code, DEFAULT_MESSAGE);
    }
}