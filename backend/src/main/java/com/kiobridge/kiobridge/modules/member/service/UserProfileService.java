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
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

@Service
@Transactional(readOnly = true)
public class UserProfileService {

    private static final TypeReference<
            Map<String, List<String>>
            > SELECTIONS_TYPE = new TypeReference<>() {
    };

    private final AppUserRepository appUserRepository;
    private final UserProfileRepository userProfileRepository;
    private final ObjectMapper objectMapper;

    public UserProfileService(
            AppUserRepository appUserRepository,
            UserProfileRepository userProfileRepository,
            ObjectMapper objectMapper
    ) {
        this.appUserRepository = appUserRepository;
        this.userProfileRepository = userProfileRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public UserProfileResponse save(
            Long userId,
            SaveProfileRequest request
    ) {
        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(UserNotFoundException::new);

        String profileId = request.profileId().trim();

        String selectionsJson = objectMapper.writeValueAsString(
                request.selections()
        );

        UserProfile profile = userProfileRepository
                .findByUser_IdAndProfileId(userId, profileId)
                .map(existing -> {
                    existing.update(
                            request.menuName().trim(),
                            request.place().trim(),
                            selectionsJson,
                            normalizeMemo(request.memo())
                    );

                    return existing;
                })
                .orElseGet(() -> new UserProfile(
                        user,
                        profileId,
                        request.menuName().trim(),
                        request.place().trim(),
                        selectionsJson,
                        normalizeMemo(request.memo())
                ));

        UserProfile saved =
                userProfileRepository.save(profile);

        return toResponse(saved);
    }

    public List<UserProfileResponse> findAll(Long userId) {
        if (!appUserRepository.existsById(userId)) {
            throw new UserNotFoundException();
        }

        return userProfileRepository
                .findAllByUser_IdOrderByIdAsc(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private UserProfileResponse toResponse(
            UserProfile profile
    ) {
        Map<String, List<String>> selections =
                objectMapper.readValue(
                        profile.getSelectionsJson(),
                        SELECTIONS_TYPE
                );

        return new UserProfileResponse(
                profile.getProfileId(),
                profile.getMenuName(),
                profile.getPlace(),
                selections,
                profile.getMemo()
        );
    }

    private String normalizeMemo(String memo) {
        return memo == null ? "" : memo.trim();
    }
}