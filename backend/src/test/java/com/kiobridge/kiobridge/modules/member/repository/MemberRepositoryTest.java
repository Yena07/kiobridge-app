package com.kiobridge.kiobridge.modules.member.repository;

import com.kiobridge.kiobridge.modules.member.entity.AppUser;
import com.kiobridge.kiobridge.modules.member.entity.UserProfile;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
@AutoConfigureTestDatabase(
        replace = AutoConfigureTestDatabase.Replace.NONE
)
class MemberRepositoryTest {

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void 회원을_아이디로_조회한다() {
        AppUser saved =
                appUserRepository.save(
                        new AppUser(
                                "hyunwoo",
                                "encoded-password"
                        )
                );

        AppUser found = appUserRepository
                .findByLoginId("hyunwoo")
                .orElseThrow();

        assertThat(found.getId())
                .isEqualTo(saved.getId());

        assertThat(found.getLoginId())
                .isEqualTo("hyunwoo");

        assertThat(
                appUserRepository
                        .existsByLoginId("hyunwoo")
        ).isTrue();
    }

    @Test
    void 같은_로그인_아이디는_중복_저장할_수_없다() {
        appUserRepository.saveAndFlush(
                new AppUser(
                        "hyunwoo",
                        "encoded-password-1"
                )
        );

        assertThatThrownBy(() ->
                appUserRepository.saveAndFlush(
                        new AppUser(
                                "hyunwoo",
                                "encoded-password-2"
                        )
                )
        ).isInstanceOf(
                DataIntegrityViolationException.class
        );
    }

    @Test
    void 회원별로_프로필을_분리해서_조회한다() {
        AppUser user1 =
                appUserRepository.save(
                        new AppUser(
                                "user1",
                                "password-1"
                        )
                );

        AppUser user2 =
                appUserRepository.save(
                        new AppUser(
                                "user2",
                                "password-2"
                        )
                );

        userProfileRepository.save(
                profile(
                        user1,
                        "profile-001",
                        "매운 닭강정"
                )
        );

        userProfileRepository.save(
                profile(
                        user2,
                        "profile-001",
                        "순한 닭강정"
                )
        );

        List<UserProfile> user1Profiles =
                userProfileRepository
                        .findAllByUser_IdOrderByIdAsc(
                                user1.getId()
                        );

        List<UserProfile> user2Profiles =
                userProfileRepository
                        .findAllByUser_IdOrderByIdAsc(
                                user2.getId()
                        );

        assertThat(user1Profiles)
                .hasSize(1);

        assertThat(
                user1Profiles
                        .getFirst()
                        .getMenuName()
        ).isEqualTo("매운 닭강정");

        assertThat(user2Profiles)
                .hasSize(1);

        assertThat(
                user2Profiles
                        .getFirst()
                        .getMenuName()
        ).isEqualTo("순한 닭강정");
    }

    @Test
    void selections를_JSON으로_저장하고_조회한다() {
        AppUser user =
                appUserRepository.save(
                        new AppUser(
                                "json-user",
                                "encoded-password"
                        )
                );

        UserProfile saved =
                userProfileRepository
                        .saveAndFlush(
                                profile(
                                        user,
                                        "profile-json",
                                        "닭강정"
                                )
                        );

        Long profileEntityId =
                saved.getId();

        entityManager.clear();

        UserProfile found =
                userProfileRepository
                        .findById(
                                profileEntityId
                        )
                        .orElseThrow();

        assertThat(found.getSelections())
                .containsEntry(
                        "맵기",
                        List.of("매운맛")
                );

        assertThat(found.getSelections())
                .containsEntry(
                        "형태",
                        List.of("순살")
                );
    }

    @Test
    void 프로필을_단건_삭제한다() {
        AppUser user =
                appUserRepository.save(
                        new AppUser(
                                "delete-user",
                                "password"
                        )
                );

        userProfileRepository.saveAndFlush(
                profile(
                        user,
                        "profile-001",
                        "닭강정"
                )
        );

        long deleted =
                userProfileRepository
                        .deleteByUser_IdAndProfileId(
                                user.getId(),
                                "profile-001"
                        );

        userProfileRepository.flush();
        entityManager.clear();

        assertThat(deleted)
                .isEqualTo(1L);

        assertThat(
                userProfileRepository
                        .findAllByUser_IdOrderByIdAsc(
                                user.getId()
                        )
        ).isEmpty();
    }

    @Test
    void 회원을_삭제하면_소속_프로필도_삭제된다() {
        AppUser user =
                appUserRepository.save(
                        new AppUser(
                                "cascade-user",
                                "password"
                        )
                );

        Long userId = user.getId();

        userProfileRepository.saveAndFlush(
                profile(
                        user,
                        "profile-001",
                        "닭강정"
                )
        );

        entityManager.clear();

        AppUser savedUser =
                appUserRepository
                        .findById(userId)
                        .orElseThrow();

        appUserRepository.delete(savedUser);
        appUserRepository.flush();

        entityManager.clear();

        assertThat(
                userProfileRepository
                        .findAllByUser_IdOrderByIdAsc(
                                userId
                        )
        ).isEmpty();
    }

    private UserProfile profile(
            AppUser user,
            String profileId,
            String menuName
    ) {
        return new UserProfile(
                user,
                profileId,
                menuName,
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