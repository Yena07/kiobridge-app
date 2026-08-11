package com.kiobridge.kiobridge.modules.member.controller.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/**
 * selections는 화면에서 사용자가 선택한 한글 표시값을 저장한다.
 * 공식 enum 변환은 추천 API를 호출하기 직전에 수행한다.
 */
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
        @Size(max = 20)
        Map<
                @NotBlank @Size(max = 50) String,
                @NotEmpty @Size(max = 20)
                        List<@NotBlank @Size(max = 50) String>
                > selections,

        @Size(max = 500)
        String memo
) {
}