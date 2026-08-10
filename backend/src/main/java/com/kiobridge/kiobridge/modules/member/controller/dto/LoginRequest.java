package com.kiobridge.kiobridge.modules.member.controller.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;

import java.nio.charset.StandardCharsets;

public record LoginRequest(
        @NotBlank
        String loginId,

        @NotBlank
        String password
) {

    @AssertTrue(
            message = "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."
    )
    public boolean isPasswordWithinBcryptLimit() {
        return password == null
                || password
                .getBytes(StandardCharsets.UTF_8)
                .length <= 72;
    }
}