package com.kiobridge.kiobridge.modules.member.repository;

import com.kiobridge.kiobridge.modules.member.entity.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserProfileRepository
        extends JpaRepository<UserProfile, Long> {

    List<UserProfile> findAllByUser_IdOrderByIdAsc(Long userId);

    Optional<UserProfile> findByUser_IdAndProfileId(
            Long userId,
            String profileId
    );
}