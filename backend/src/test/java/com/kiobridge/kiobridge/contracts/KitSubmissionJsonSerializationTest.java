package com.kiobridge.kiobridge.contracts;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Kit(schemas/core/semantic-action.schema.json, user-decision.schema.json)에 제출하는 값 중
 * "optional이지만 타입은 순수 string(널 불가)"인 필드들이, null일 때 JSON에 아예 안 실리는지 검증한다.
 *
 * 실제 로컬 Kit 연동 테스트에서 발견된 회귀:
 * Target.groupId=null / UserDecision.note=null을 그대로 직렬화하면 "groupId must be string",
 * "note must be string"으로 Kit이 거부했다 (Jackson 기본 동작은 null도 "field": null로 실어보냄).
 * @JsonInclude(NON_NULL)을 Target/UserDecision에 추가해서 고쳤고, 이 테스트는 그 상태를 고정한다.
 */
class KitSubmissionJsonSerializationTest {

    private final JsonMapper mapper = JsonMapper.builder().build();

    @Test
    void target_groupId가_null이면_JSON에_groupId_키_자체가_없다() {
        Target target = Target.of("service", "svc-id");

        String json = mapper.writeValueAsString(target);

        assertThat(json).doesNotContain("groupId");
        assertThat(json).contains("\"kind\":\"service\"").contains("\"id\":\"svc-id\"");
    }

    @Test
    void target_groupId가_있으면_JSON에_그대로_실린다() {
        Target target = Target.option("SPICY_LEVEL", "HOT");

        String json = mapper.writeValueAsString(target);

        assertThat(json).contains("\"groupId\":\"SPICY_LEVEL\"");
    }

    @Test
    void userDecision_note가_null이면_JSON에_note_키_자체가_없다() {
        UserDecision decision = UserDecision.approve();

        String json = mapper.writeValueAsString(decision);

        assertThat(json).doesNotContain("\"note\"");
    }

    @Test
    void userDecision_note가_있으면_JSON에_그대로_실린다() {
        UserDecision decision = UserDecision.reject("가격이 예산을 초과해서 거절");

        String json = mapper.writeValueAsString(decision);

        assertThat(json).contains("\"note\":\"가격이 예산을 초과해서 거절\"");
    }
}
