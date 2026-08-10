package com.kiobridge.kiobridge.modules.member.service;

import com.kiobridge.kiobridge.modules.member.controller.dto.LoginRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.LoginResponse;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupResponse;
import com.kiobridge.kiobridge.modules.member.entity.AppUser;
import com.kiobridge.kiobridge.modules.member.exception.DuplicateLoginIdException;
import com.kiobridge.kiobridge.modules.member.exception.InvalidCredentialsException;
import com.kiobridge.kiobridge.modules.member.repository.AppUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                appUserRepository,
                passwordEncoder
        );
    }

    @Test
    void 회원가입할_때_비밀번호를_해시로_변환해서_저장한다() {
        SignupRequest request =
                new SignupRequest("hyunwoo", "1234");

        when(appUserRepository.existsByLoginId("hyunwoo"))
                .thenReturn(false);

        when(passwordEncoder.encode("1234"))
                .thenReturn("encoded-password");

        when(appUserRepository.saveAndFlush(any(AppUser.class)))
                .thenAnswer(invocation -> {
                    AppUser user = invocation.getArgument(0);
                    ReflectionTestUtils.setField(user, "id", 1L);
                    return user;
                });

        SignupResponse response = authService.signup(request);

        assertThat(response.userId()).isEqualTo(1L);
        assertThat(response.loginId()).isEqualTo("hyunwoo");

        verify(passwordEncoder).encode("1234");
        verify(appUserRepository)
                .saveAndFlush(any(AppUser.class));
    }

    @Test
    void 이미_존재하는_아이디로는_회원가입할_수_없다() {
        SignupRequest request =
                new SignupRequest("hyunwoo", "1234");

        when(appUserRepository.existsByLoginId("hyunwoo"))
                .thenReturn(true);

        assertThatThrownBy(() -> authService.signup(request))
                .isInstanceOf(DuplicateLoginIdException.class);

        verify(passwordEncoder, never()).encode(any());
        verify(appUserRepository, never())
                .saveAndFlush(any());
    }

    @Test
    void 아이디와_비밀번호가_일치하면_로그인한다() {
        AppUser user =
                new AppUser("hyunwoo", "encoded-password");

        ReflectionTestUtils.setField(user, "id", 1L);

        when(appUserRepository.findByLoginId("hyunwoo"))
                .thenReturn(Optional.of(user));

        when(passwordEncoder.matches(
                "1234",
                "encoded-password"
        )).thenReturn(true);

        LoginResponse response = authService.login(
                new LoginRequest("hyunwoo", "1234")
        );

        assertThat(response.userId()).isEqualTo(1L);
        assertThat(response.loginId()).isEqualTo("hyunwoo");
    }

    @Test
    void 비밀번호가_일치하지_않으면_로그인할_수_없다() {
        AppUser user =
                new AppUser("hyunwoo", "encoded-password");

        when(appUserRepository.findByLoginId("hyunwoo"))
                .thenReturn(Optional.of(user));

        when(passwordEncoder.matches(
                "wrong-password",
                "encoded-password"
        )).thenReturn(false);

        assertThatThrownBy(() ->
                authService.login(
                        new LoginRequest(
                                "hyunwoo",
                                "wrong-password"
                        )
                )
        ).isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void 존재하지_않는_아이디로는_로그인할_수_없다() {
        when(appUserRepository.findByLoginId("unknown"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                authService.login(
                        new LoginRequest("unknown", "1234")
                )
        ).isInstanceOf(InvalidCredentialsException.class);

        verify(passwordEncoder, never())
                .matches(any(), any());
    }
}