package com.kiobridge.kiobridge.modules.member.service;

import com.kiobridge.kiobridge.modules.member.controller.dto.SaveProfileRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.UserProfileResponse;
import com.kiobridge.kiobridge.modules.member.entity.AppUser;
import com.kiobridge.kiobridge.modules.member.entity.UserProfile;
import com.kiobridge.kiobridge.modules.member.exception.UserNotFoundException;
import com.kiobridge.kiobridge.modules.member.repository.AppUserRepository;
import com.kiobridge.kiobridge.modules.member.repository.UserProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private final AppUserRepository appUserRepository;
    private final UserProfileRepository userProfileRepository;

    public UserProfileService(
            AppUserRepository appUserRepository,
            UserProfileRepository userProfileRepository
    ) {
        this.appUserRepository = appUserRepository;
        this.userProfileRepository =
                userProfileRepository;
    }

    @Transactional
    public UserProfileResponse save(
            Long userId,
            SaveProfileRequest request
    ) {
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(
                        UserNotFoundException::new
                );

        String profileId =
                request.profileId().trim();

        String menuName =
                request.menuName().trim();

        String place =
                request.place().trim();

        ProfileSelectionsContract.validate(
                place,
                request.selections()
        );

        UserProfile profile = userProfileRepository
                .findByUser_IdAndProfileId(
                        userId,
                        profileId
                )
                .map(existing -> {
                    existing.update(
                            menuName,
                            place,
                            request.selections(),
                            normalizeMemo(
                                    request.memo()
                            )
                    );

                    return existing;
                })
                .orElseGet(() ->
                        new UserProfile(
                                user,
                                profileId,
                                menuName,
                                place,
                                request.selections(),
                                normalizeMemo(
                                        request.memo()
                                )
                        )
                );

        UserProfile saved =
                userProfileRepository.save(profile);

        return toResponse(saved);
    }

    public List<UserProfileResponse> findAll(
            Long userId
    ) {
        if (!appUserRepository.existsById(userId)) {
            throw new UserNotFoundException();
        }

        return userProfileRepository
                .findAllByUser_IdOrderByIdAsc(
                        userId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(
            Long userId,
            String profileId
    ) {
        if (!appUserRepository.existsById(userId)) {
            throw new UserNotFoundException();
        }

        String normalizedProfileId =
                profileId.trim();

        if (normalizedProfileId.isBlank()) {
            throw new IllegalArgumentException(
                    "profileId는 비어 있을 수 없습니다."
            );
        }

        userProfileRepository
                .deleteByUser_IdAndProfileId(
                        userId,
                        normalizedProfileId
                );
    }

    private UserProfileResponse toResponse(
            UserProfile profile
    ) {
        return new UserProfileResponse(
                profile.getProfileId(),
                profile.getMenuName(),
                profile.getPlace(),
                profile.getSelections(),
                profile.getMemo()
        );
    }

    private String normalizeMemo(String memo) {
        return memo == null
                ? ""
                : memo.trim();
    }
}