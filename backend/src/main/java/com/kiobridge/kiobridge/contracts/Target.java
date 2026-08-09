package com.kiobridge.kiobridge.contracts;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Action이 가리키는 대상. 좌표나 컨트롤ID가 아니라 "무엇을 선택하는지"를 의미로 표현한다.
 * automationId, coordinate, btn... 같은 값은 Simulation API 스키마가 거부한다.
 *
 * kind 예: "candidate", "option", "service_type", "visit_type", "appointment",
 *          "department", "support", "category", "auth_method", "review", "staff"
 * groupId 는 kind="option" 일 때만 사용한다 (예: "SPICY_LEVEL").
 *
 * schemas/core/semantic-action.schema.json의 target.groupId는 optional이지만 타입이
 * 순수 "string"이라 null을 허용하지 않는다 (["string","null"]이 아님). @JsonInclude(NON_NULL)
 * 없이 groupId=null인 Target을 직렬화하면 Kit이 "groupId must be string"으로 거부한다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Target(
    String kind,
    String groupId,
    String id
) {
    public static Target candidate(String candidateId) {
        return new Target("candidate", null, candidateId);
    }

    public static Target option(String groupId, String optionId) {
        return new Target("option", groupId, optionId);
    }

    public static Target of(String kind, String id) {
        return new Target(kind, null, id);
    }
}
