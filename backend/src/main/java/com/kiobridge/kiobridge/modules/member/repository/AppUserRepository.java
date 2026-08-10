package com.kiobridge.kiobridge.modules.member.repository;

import com.kiobridge.kiobridge.modules.member.entity.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    boolean existsByLoginId(String loginId);

    Optional<AppUser> findByLoginId(String loginId);
}