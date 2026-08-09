package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.Candidate;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * environments/chicken-store/option-groups.json 실제 데이터를 그대로 옮긴 픽스처로 검증한다.
 * (ChickenStoreTestFixtures와 같은 원칙 — Kit 실제 데이터와 어긋나면 테스트도 의미 없음)
 */
class ChickenStoreOptionResolverTest {

    @Test
    void 선호값이_후보_지원목록에도_있으면_그대로_쓴다() {
        // candidateWithSupport()의 SPICY_LEVEL 지원값은 [MILD, MEDIUM] — MEDIUM은 그 안에 있음
        String result = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups(), "SPICY_LEVEL", "MEDIUM", candidateWithSupport()
        );

        assertThat(result).isEqualTo("MEDIUM");
    }

    @Test
    void 후보가_지원하지_않는_선호값은_선택하지_않고_후보_지원값으로_대체한다() {
        // HOT은 option-groups.json 상 유효한 그룹 값이지만, candidateWithSupport()는 SPICY_LEVEL을
        // [MILD, MEDIUM]으로만 지원한다 — 그룹에 유효하다는 이유만으로 HOT을 고르면 실제로는
        // 이 후보가 지원하지 않는 옵션을 선택하는 실행계획이 만들어진다 (CodeRabbit 지적 사항).
        String result = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups(), "SPICY_LEVEL", "HOT", candidateWithSupport()
        );

        assertThat(result).isEqualTo("MILD");
    }

    @Test
    void 선호값이_없으면_후보가_지원하는_옵션으로_대체한다() {
        // candidateWithSupport()의 SPICY_LEVEL 지원값은 [MILD, MEDIUM] 중 첫 값 (HOT은 지원 안 함)
        String result = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups(), "SPICY_LEVEL", null, candidateWithSupport()
        );

        assertThat(result).isEqualTo("MILD");
    }

    @Test
    void 선호값이_그룹에_없는_값이면_무시하고_후보_지원값으로_대체한다() {
        // NO_PREFERENCE/UNKNOWN 같은 sentinel은 호출부에서 null로 바뀌어 들어오지만,
        // 혹시 그룹에 없는 임의 문자열이 들어와도 같은 폴백 경로를 타야 한다.
        String result = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups(), "SPICY_LEVEL", "NOT_A_REAL_OPTION", candidateWithSupport()
        );

        assertThat(result).isEqualTo("MILD");
    }

    @Test
    void 선호값도_후보_지원값도_없으면_그룹의_첫번째_옵션으로_대체한다() {
        String result = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups(), "BONE_TYPE", null, ExecutionPlanTestFixtures.candidateWithoutSupportedOptions("CHICKEN-TEST")
        );

        assertThat(result).isEqualTo("BONE");
    }

    @Test
    void 후보_지원값_중에_그룹에_실존하지_않는_값만_있으면_그룹_첫번째_옵션으로_대체한다() {
        Candidate candidate = new Candidate(
            "CHICKEN-TEST", "test", "chicken-store", true, "PUBLIC", 10000.0, "설명",
            Map.of("CUP", List.of("GLASS")), // GLASS는 실존하지 않는 옵션
            Map.of(), Map.of(), Map.of()
        );

        String result = ChickenStoreOptionResolver.resolveOptionId(
            optionGroups(), "CUP", null, candidate
        );

        assertThat(result).isEqualTo("PAPER");
    }

    @Test
    void 존재하지_않는_그룹이면_예외를_던진다() {
        assertThatThrownBy(() ->
            ChickenStoreOptionResolver.resolveOptionId(optionGroups(), "NOT_A_GROUP", null, candidateWithSupport())
        ).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void QUANTITY는_숫자값으로_옵션id를_찾는다() {
        assertThat(ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups(), "QUANTITY", 1)).isEqualTo("Q1");
        assertThat(ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups(), "QUANTITY", 2)).isEqualTo("Q2");
        assertThat(ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups(), "QUANTITY", 3)).isEqualTo("Q3");
    }

    @Test
    void QUANTITY_값이_null이면_null을_반환한다() {
        assertThat(ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups(), "QUANTITY", null)).isNull();
    }

    @Test
    void QUANTITY_값에_해당하는_옵션이_없으면_null을_반환한다() {
        assertThat(ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups(), "QUANTITY", 99)).isNull();
    }

    @Test
    void resolveOptionIdByValue는_그룹이_없으면_예외_대신_null을_반환한다() {
        assertThat(ChickenStoreOptionResolver.resolveOptionIdByValue(optionGroups(), "NOT_A_GROUP", 1)).isNull();
    }

    private static Candidate candidateWithSupport() {
        return new Candidate(
            "CHICKEN-TEST", "test", "chicken-store", true, "PUBLIC", 10000.0, "설명",
            Map.of("SPICY_LEVEL", List.of("MILD", "MEDIUM")),
            Map.of(), Map.of(), Map.of()
        );
    }

    /** environments/chicken-store/option-groups.json 그대로. */
    private static List<Map<String, Object>> optionGroups() {
        return List.of(
            Map.of(
                "groupId", "SERVICE_TYPE", "kind", "service_type", "required", true,
                "options", List.of(
                    Map.of("id", "DINE_IN", "label", "먹고 가기"),
                    Map.of("id", "TAKE_OUT", "label", "포장하기")
                )
            ),
            Map.of(
                "groupId", "SPICY_LEVEL", "kind", "option", "required", true,
                "options", List.of(
                    Map.of("id", "MILD", "label", "순한맛"),
                    Map.of("id", "MEDIUM", "label", "보통맛"),
                    Map.of("id", "HOT", "label", "매운맛")
                )
            ),
            Map.of(
                "groupId", "BONE_TYPE", "kind", "option", "required", true,
                "options", List.of(
                    Map.of("id", "BONE", "label", "뼈"),
                    Map.of("id", "BONELESS", "label", "순살")
                )
            ),
            Map.of(
                "groupId", "CUP", "kind", "option", "required", false,
                "options", List.of(
                    Map.of("id", "PAPER", "label", "종이컵"),
                    Map.of("id", "REGULAR", "label", "일반컵")
                )
            ),
            Map.of(
                "groupId", "QUANTITY", "kind", "option", "required", true,
                "options", List.of(
                    Map.of("id", "Q1", "label", "1개", "value", 1),
                    Map.of("id", "Q2", "label", "2개", "value", 2),
                    Map.of("id", "Q3", "label", "3개", "value", 3)
                )
            )
        );
    }
}
