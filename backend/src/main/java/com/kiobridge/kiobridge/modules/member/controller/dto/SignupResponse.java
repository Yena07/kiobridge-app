package com.kiobridge.kiobridge.modules.member.controller.dto;

public record SignupResponse(
        Long userId,
        String loginId
) {
}