package com.kiobridge.kiobridge.modules.member.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record SaveProfileRequest(
        @NotBlank
        @Size(max = 100)
        String profileId,

        @NotBlank
        @Size(max = 100)
        String menuName,

        @NotBlank
        @Size(max = 50)
        String place,

        @NotNull
        Map<String, List<String>> selections,

        @Size(max = 500)
        String memo
) {
}