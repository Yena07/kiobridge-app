package com.kiobridge.kiobridge.modules.stateevidence.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ValidationErrorMessageServiceTest {

    private final ValidationErrorMessageService service = new ValidationErrorMessageService();

    @Test
    void 매핑된_코드는_친절한_문장으로_변환된다() {
        assertThat(service.toFriendlyMessage("REQUIRED_FIELD_MISSING"))
            .isEqualTo("필수 정보가 빠졌습니다.");
        assertThat(service.toFriendlyMessage("ALLERGEN_CONFLICT"))
            .isEqualTo("등록하신 알레르기와 겹치는 메뉴입니다.");
    }

    @Test
    void 매핑되지_않은_코드는_기본_메시지를_반환한다() {
        assertThat(service.toFriendlyMessage("SOME_UNKNOWN_CODE"))
            .isEqualTo("요청을 처리하는 중 문제가 발생했습니다.");
    }
}