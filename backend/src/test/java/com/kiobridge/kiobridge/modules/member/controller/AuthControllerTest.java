package com.kiobridge.kiobridge.modules.member.controller;

import com.kiobridge.kiobridge.modules.member.controller.dto.LoginResponse;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupResponse;
import com.kiobridge.kiobridge.modules.member.exception.InvalidCredentialsException;
import com.kiobridge.kiobridge.modules.member.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void 회원가입에_성공하면_201을_반환한다() throws Exception {
        when(authService.signup(any()))
                .thenReturn(
                        new SignupResponse(1L, "hyunwoo")
                );

        mockMvc.perform(
                        post("/api/v1/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "hyunwoo",
                                          "password": "1234"
                                        }
                                        """)
                )
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(
                        jsonPath("$.loginId")
                                .value("hyunwoo")
                );
    }

    @Test
    void 비밀번호가_비어있으면_회원가입_요청을_거절한다()
            throws Exception {

        mockMvc.perform(
                        post("/api/v1/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "hyunwoo",
                                          "password": ""
                                        }
                                        """)
                )
                .andExpect(status().isBadRequest());
    }

    @Test
    void 로그인에_성공하면_회원_정보를_반환한다()
            throws Exception {

        when(authService.login(any()))
                .thenReturn(
                        new LoginResponse(1L, "hyunwoo")
                );

        mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "hyunwoo",
                                          "password": "1234"
                                        }
                                        """)
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(
                        jsonPath("$.loginId")
                                .value("hyunwoo")
                );
    }

    @Test
    void 로그인_정보가_틀리면_401을_반환한다()
            throws Exception {

        when(authService.login(any()))
                .thenThrow(
                        new InvalidCredentialsException()
                );

        mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "loginId": "hyunwoo",
                                          "password": "wrong-password"
                                        }
                                        """)
                )
                .andExpect(status().isUnauthorized())
                .andExpect(
                        jsonPath("$.code")
                                .value("INVALID_CREDENTIALS")
                );
    }

    @Test
    void 회원가입_비밀번호_72바이트는_허용하고_73바이트는_거절한다()
            throws Exception {

        String password72 = "가".repeat(24);
        String password73 = "가".repeat(24) + "a";

        when(authService.signup(any()))
                .thenReturn(
                        new SignupResponse(1L, "hyunwoo")
                );

        mockMvc.perform(
                        post("/api/v1/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                    {
                                      "loginId": "hyunwoo",
                                      "password": "%s"
                                    }
                                    """.formatted(password72))
                )
                .andExpect(status().isCreated());

        mockMvc.perform(
                        post("/api/v1/auth/signup")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                    {
                                      "loginId": "hyunwoo",
                                      "password": "%s"
                                    }
                                    """.formatted(password73))
                )
                .andExpect(status().isBadRequest());

        verify(authService, times(1)).signup(any());
    }

    @Test
    void 로그인_비밀번호_72바이트는_허용하고_73바이트는_거절한다()
            throws Exception {

        String password72 = "가".repeat(24);
        String password73 = "가".repeat(24) + "a";

        when(authService.login(any()))
                .thenReturn(
                        new LoginResponse(1L, "hyunwoo")
                );

        mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                    {
                                      "loginId": "hyunwoo",
                                      "password": "%s"
                                    }
                                    """.formatted(password72))
                )
                .andExpect(status().isOk());

        mockMvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                    {
                                      "loginId": "hyunwoo",
                                      "password": "%s"
                                    }
                                    """.formatted(password73))
                )
                .andExpect(status().isBadRequest());

        verify(authService, times(1)).login(any());
    }
}