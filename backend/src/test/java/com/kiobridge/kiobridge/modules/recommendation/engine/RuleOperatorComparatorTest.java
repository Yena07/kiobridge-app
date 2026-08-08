package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.input.context.AllergenId;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuleOperatorComparatorTest {

    @Test
    void DISJOINT는_겹치는_원소가_없어야_통과한다() {
        boolean satisfied = RuleOperatorComparator.compare(
            "DISJOINT",
            List.of(AllergenId.PEANUT),
            List.of("MILK", "EGG")
        );

        assertThat(satisfied).isTrue();
    }

    @Test
    void DISJOINT는_enum_이름과_문자열이_같으면_겹친_것으로_본다() {
        // sourceValue는 AllergenId enum, candidateValue는 Candidate.attributes()에서 온 순수 문자열 —
        // stringOf()가 enum.name()으로 정규화해주지 않으면 이 케이스가 거짓으로 통과해버린다.
        boolean satisfied = RuleOperatorComparator.compare(
            "DISJOINT",
            List.of(AllergenId.PEANUT),
            List.of("PEANUT", "MILK")
        );

        assertThat(satisfied).isFalse();
    }

    @Test
    void MAX는_후보값이_한도_이하일_때만_통과한다() {
        assertThat(RuleOperatorComparator.compare("MAX", 15000, 12000.0)).isTrue();
        assertThat(RuleOperatorComparator.compare("MAX", 15000, 20000.0)).isFalse();
    }

    @Test
    void MAX는_숫자로_못_바꾸면_방어적으로_통과시킨다() {
        assertThat(RuleOperatorComparator.compare("MAX", "숫자아님", 12000.0)).isTrue();
    }

    @Test
    void IN은_사용자값이_후보목록에_있어야_통과한다() {
        assertThat(RuleOperatorComparator.compare("IN", "TAKE_OUT", List.of("TAKE_OUT", "DINE_IN"))).isTrue();
        assertThat(RuleOperatorComparator.compare("IN", "TAKE_OUT", List.of("DINE_IN"))).isFalse();
    }

    @Test
    void EQUALS_SELECTED는_후보값이_없으면_구조검사_대상이라_통과시킨다() {
        assertThat(RuleOperatorComparator.compare("EQUALS_SELECTED", "TAKE_OUT", null)).isTrue();
    }
}
