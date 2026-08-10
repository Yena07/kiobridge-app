package com.kiobridge.kiobridge.modules.member.controller;

import com.kiobridge.kiobridge.modules.member.controller.dto.LoginRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.LoginResponse;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.SignupResponse;
import com.kiobridge.kiobridge.modules.member.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SignupResponse signup(
            @Valid @RequestBody SignupRequest request
    ) {
        return authService.signup(request);
    }

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request
    ) {
        return authService.login(request);
    }
}