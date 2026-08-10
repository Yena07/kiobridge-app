package com.kiobridge.kiobridge.modules.member.controller.dto;

public record LoginResponse(
        Long userId,
        String loginId
) {
}