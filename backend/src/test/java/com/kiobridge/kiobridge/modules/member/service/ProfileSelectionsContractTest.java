package com.kiobridge.kiobridge.modules.member.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProfileSelectionsContractTest {

    @Test
    void 한글_화면_값은_허용한다() {
        Map<String, List<String>> selections =
                Map.of(
                        "이용 방식",
                        List.of("포장하기"),

                        "맵기",
                        List.of("매운맛"),

                        "형태",
                        List.of("순살"),

                        "컵",
                        List.of("종이컵"),

                        "수량",
                        List.of("1개"),

                        "알레르기 (꼭 빼주세요)",
                        List.of("땅콩")
                );

        assertThatCode(() ->
                ProfileSelectionsContract.validate(
                        "음식점",
                        selections
                )
        ).doesNotThrowAnyException();
    }

    @Test
    void 영문_키는_거절한다() {
        assertThatThrownBy(() ->
                ProfileSelectionsContract.validate(
                        "음식점",
                        Map.of(
                                "spicyLevel",
                                List.of("HOT")
                        )
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "spicyLevel"
                );
    }

    @Test
    void 화면에_없는_값은_거절한다() {
        assertThatThrownBy(() ->
                ProfileSelectionsContract.validate(
                        "음식점",
                        Map.of(
                                "이용 방식",
                                List.of("포장")
                        )
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining("포장");
    }

    @Test
    void 음식점이_아닌_장소는_현재_검증하지_않는다() {
        assertThatCode(() ->
                ProfileSelectionsContract.validate(
                        "병원",
                        Map.of(
                                "예약 여부",
                                List.of("예약 있음")
                        )
                )
        ).doesNotThrowAnyException();
    }
}