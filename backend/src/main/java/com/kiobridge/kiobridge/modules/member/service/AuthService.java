package com.kiobridge.kiobridge.modules.member.service;

import com.kiobridge.kiobridge.modules.member.controller.dto.LoginRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.LoginResponse;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupResponse;
import com.kiobridge.kiobridge.modules.member.entity.AppUser;
import com.kiobridge.kiobridge.modules.member.exception.DuplicateLoginIdException;
import com.kiobridge.kiobridge.modules.member.exception.InvalidCredentialsException;
import com.kiobridge.kiobridge.modules.member.repository.AppUserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.hibernate.exception.ConstraintViolationException;

@Service
@Transactional(readOnly = true)
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        String loginId = request.loginId().trim();

        if (appUserRepository.existsByLoginId(loginId)) {
            throw new DuplicateLoginIdException();
        }

        String passwordHash =
                passwordEncoder.encode(request.password());

        AppUser user;

        try {
            user = appUserRepository.saveAndFlush(
                    new AppUser(loginId, passwordHash)
            );
        } catch (DataIntegrityViolationException e) {
            if (e.getCause() instanceof ConstraintViolationException violation
                    && "uk_app_users_login_id".equalsIgnoreCase(
                    violation.getConstraintName()
            )) {
                throw new DuplicateLoginIdException();
            }

            throw e;
        }

        return new SignupResponse(
                user.getId(),
                user.getLoginId()
        );
    }

    public LoginResponse login(LoginRequest request) {
        String loginId = request.loginId().trim();

        AppUser user = appUserRepository
                .findByLoginId(loginId)
                .orElseThrow(InvalidCredentialsException::new);

        boolean passwordMatches = passwordEncoder.matches(
                request.password(),
                user.getPasswordHash()
        );

        if (!passwordMatches) {
            throw new InvalidCredentialsException();
        }

        return new LoginResponse(
                user.getId(),
                user.getLoginId()
        );
    }
}