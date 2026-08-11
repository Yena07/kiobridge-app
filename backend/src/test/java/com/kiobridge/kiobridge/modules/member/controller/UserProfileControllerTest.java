package com.kiobridge.kiobridge.modules.member.controller;

import com.kiobridge.kiobridge.modules.member.controller.dto.UserProfileResponse;
import com.kiobridge.kiobridge.modules.member.exception.UserNotFoundException;
import com.kiobridge.kiobridge.modules.member.service.UserProfileService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserProfileController.class)
class UserProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserProfileService userProfileService;

    @Test
    void 프로필을_저장한다() throws Exception {
        when(userProfileService.save(
                eq(1L),
                any()
        )).thenReturn(response());

        mockMvc.perform(
                        post(
                                "/api/v1/users/1/profiles"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content("""
                                        {
                                          "profileId": "profile-001",
                                          "menuName": "닭강정",
                                          "place": "음식점",
                                          "selections": {
                                            "맵기": ["매운맛"],
                                            "형태": ["순살"]
                                          },
                                          "memo": ""
                                        }
                                        """)
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.profileId")
                                .value("profile-001")
                );
    }

    @Test
    void 프로필_목록을_조회한다()
            throws Exception {

        when(userProfileService.findAll(1L))
                .thenReturn(
                        List.of(response())
                );

        mockMvc.perform(
                        get(
                                "/api/v1/users/1/profiles"
                        )
                )
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath(
                                "$[0].profileId"
                        ).value("profile-001")
                )
                .andExpect(
                        jsonPath(
                                "$[0].selections['맵기'][0]"
                        ).value("매운맛")
                );
    }

    @Test
    void 필수값이_없으면_저장을_거절한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/users/1/profiles"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content("""
                                        {
                                          "profileId": "",
                                          "menuName": "",
                                          "place": "음식점",
                                          "selections": {}
                                        }
                                        """)
                )
                .andExpect(
                        status().isBadRequest()
                );
    }

    @Test
    void 선택값_배열이_비어있으면_저장을_거절한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/users/1/profiles"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content("""
                                        {
                                          "profileId": "profile-001",
                                          "menuName": "닭강정",
                                          "place": "음식점",
                                          "selections": {
                                            "맵기": []
                                          },
                                          "memo": ""
                                        }
                                        """)
                )
                .andExpect(
                        status().isBadRequest()
                );
    }

    @Test
    void 사용자가_없으면_404를_반환한다()
            throws Exception {

        when(userProfileService.findAll(999L))
                .thenThrow(
                        new UserNotFoundException()
                );

        mockMvc.perform(
                        get(
                                "/api/v1/users/999/profiles"
                        )
                )
                .andExpect(status().isNotFound())
                .andExpect(
                        jsonPath("$.code")
                                .value("USER_NOT_FOUND")
                );
    }

    @Test
    void 프로필을_삭제한다()
            throws Exception {

        mockMvc.perform(
                        delete(
                                "/api/v1/users/1/profiles/profile-001"
                        )
                )
                .andExpect(
                        status().isNoContent()
                );

        verify(userProfileService)
                .delete(
                        1L,
                        "profile-001"
                );
    }

    private UserProfileResponse response() {
        return new UserProfileResponse(
                "profile-001",
                "닭강정",
                "음식점",
                Map.of(
                        "맵기",
                        List.of("매운맛"),

                        "형태",
                        List.of("순살")
                ),
                ""
        );
    }
}