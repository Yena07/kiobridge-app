package com.kiobridge.kiobridge.modules.member.controller.dto;

import java.util.List;
import java.util.Map;

public record UserProfileResponse(
        String profileId,
        String menuName,
        String place,
        Map<String, List<String>> selections,
        String memo
) {
}