package com.kiobridge.kiobridge.modules.member.service;

import com.kiobridge.kiobridge.modules.member.controller.dto.SaveProfileRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.UserProfileResponse;
import com.kiobridge.kiobridge.modules.member.entity.AppUser;
import com.kiobridge.kiobridge.modules.member.entity.UserProfile;
import com.kiobridge.kiobridge.modules.member.exception.UserNotFoundException;
import com.kiobridge.kiobridge.modules.member.repository.AppUserRepository;
import com.kiobridge.kiobridge.modules.member.repository.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserProfileServiceTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private UserProfileRepository userProfileRepository;

    private UserProfileService userProfileService;

    @BeforeEach
    void setUp() {
        userProfileService =
                new UserProfileService(
                        appUserRepository,
                        userProfileRepository
                );
    }

    @Test
    void 새로운_프로필을_저장한다() {
        AppUser user =
                new AppUser(
                        "hyunwoo",
                        "encoded-password"
                );

        SaveProfileRequest request =
                request(
                        "profile-001",
                        "닭강정",
                        "매운맛"
                );

        when(appUserRepository.findById(1L))
                .thenReturn(
                        Optional.of(user)
                );

        when(userProfileRepository
                .findByUser_IdAndProfileId(
                        1L,
                        "profile-001"
                ))
                .thenReturn(
                        Optional.empty()
                );

        when(userProfileRepository.save(any()))
                .thenAnswer(invocation ->
                        invocation.getArgument(0)
                );

        UserProfileResponse response =
                userProfileService.save(
                        1L,
                        request
                );

        assertThat(response.profileId())
                .isEqualTo("profile-001");

        assertThat(response.selections())
                .containsEntry(
                        "맵기",
                        List.of("매운맛")
                );
    }

    @Test
    void 같은_profileId가_있으면_수정한다() {
        AppUser user =
                new AppUser(
                        "hyunwoo",
                        "encoded-password"
                );

        UserProfile existing =
                new UserProfile(
                        user,
                        "profile-001",
                        "기존 메뉴",
                        "음식점",
                        Map.of(
                                "맵기",
                                List.of("순한맛")
                        ),
                        ""
                );

        when(appUserRepository.findById(1L))
                .thenReturn(
                        Optional.of(user)
                );

        when(userProfileRepository
                .findByUser_IdAndProfileId(
                        1L,
                        "profile-001"
                ))
                .thenReturn(
                        Optional.of(existing)
                );

        when(userProfileRepository.save(existing))
                .thenReturn(existing);

        UserProfileResponse response =
                userProfileService.save(
                        1L,
                        request(
                                "profile-001",
                                "수정된 닭강정",
                                "매운맛"
                        )
                );

        assertThat(response.menuName())
                .isEqualTo("수정된 닭강정");

        assertThat(response.selections())
                .containsEntry(
                        "맵기",
                        List.of("매운맛")
                );

        verify(userProfileRepository)
                .save(existing);
    }

    @Test
    void 회원의_프로필_목록을_조회한다() {
        AppUser user =
                new AppUser(
                        "hyunwoo",
                        "encoded-password"
                );

        UserProfile profile =
                new UserProfile(
                        user,
                        "profile-001",
                        "닭강정",
                        "음식점",
                        Map.of(
                                "맵기",
                                List.of("매운맛")
                        ),
                        ""
                );

        when(appUserRepository.existsById(1L))
                .thenReturn(true);

        when(userProfileRepository
                .findAllByUser_IdOrderByIdAsc(
                        1L
                ))
                .thenReturn(
                        List.of(profile)
                );

        List<UserProfileResponse> responses =
                userProfileService.findAll(1L);

        assertThat(responses)
                .hasSize(1);

        assertThat(
                responses.getFirst().profileId()
        ).isEqualTo("profile-001");
    }

    @Test
    void 사용자가_없으면_저장할_수_없다() {
        when(appUserRepository.findById(999L))
                .thenReturn(
                        Optional.empty()
                );

        assertThatThrownBy(() ->
                userProfileService.save(
                        999L,
                        request(
                                "profile-001",
                                "닭강정",
                                "매운맛"
                        )
                )
        ).isInstanceOf(
                UserNotFoundException.class
        );
    }

    @Test
    void 지원하지_않는_선택값은_저장할_수_없다() {
        AppUser user =
                new AppUser(
                        "hyunwoo",
                        "encoded-password"
                );

        when(appUserRepository.findById(1L))
                .thenReturn(
                        Optional.of(user)
                );

        SaveProfileRequest invalid =
                new SaveProfileRequest(
                        "profile-001",
                        "닭강정",
                        "음식점",
                        Map.of(
                                "spicyLevel",
                                List.of("HOT")
                        ),
                        ""
                );

        assertThatThrownBy(() ->
                userProfileService.save(
                        1L,
                        invalid
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "spicyLevel"
                );
    }

    @Test
    void 회원의_프로필을_삭제한다() {
        when(appUserRepository.existsById(1L))
                .thenReturn(true);

        when(userProfileRepository
                .deleteByUser_IdAndProfileId(
                        1L,
                        "profile-001"
                ))
                .thenReturn(1L);

        userProfileService.delete(
                1L,
                "profile-001"
        );

        verify(userProfileRepository)
                .deleteByUser_IdAndProfileId(
                        1L,
                        "profile-001"
                );
    }

    @Test
    void 없는_프로필을_삭제해도_성공한다() {
        when(appUserRepository.existsById(1L))
                .thenReturn(true);

        when(userProfileRepository
                .deleteByUser_IdAndProfileId(
                        1L,
                        "profile-001"
                ))
                .thenReturn(0L);

        userProfileService.delete(
                1L,
                "profile-001"
        );

        verify(userProfileRepository)
                .deleteByUser_IdAndProfileId(
                        1L,
                        "profile-001"
                );
    }

    @Test
    void 없는_회원의_프로필은_삭제할_수_없다() {
        when(appUserRepository.existsById(999L))
                .thenReturn(false);

        assertThatThrownBy(() ->
                userProfileService.delete(
                        999L,
                        "profile-001"
                )
        ).isInstanceOf(
                UserNotFoundException.class
        );
    }

    private SaveProfileRequest request(
            String profileId,
            String menuName,
            String spicyLevel
    ) {
        return new SaveProfileRequest(
                profileId,
                menuName,
                "음식점",
                Map.of(
                        "맵기",
                        List.of(spicyLevel),

                        "형태",
                        List.of("순살")
                ),
                ""
        );
    }
}