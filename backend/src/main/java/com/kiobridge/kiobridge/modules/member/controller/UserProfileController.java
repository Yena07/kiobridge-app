package com.kiobridge.kiobridge.modules.member.controller;

import com.kiobridge.kiobridge.modules.member.controller.dto.SaveProfileRequest;
import com.kiobridge.kiobridge.modules.member.controller.dto.UserProfileResponse;
import com.kiobridge.kiobridge.modules.member.service.UserProfileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users/{userId}/profiles")
public class UserProfileController {

    private final UserProfileService userProfileService;

    public UserProfileController(
            UserProfileService userProfileService
    ) {
        this.userProfileService = userProfileService;
    }

    @GetMapping
    public List<UserProfileResponse> findAll(
            @PathVariable Long userId
    ) {
        return userProfileService.findAll(userId);
    }

    @PostMapping
    public UserProfileResponse save(
            @PathVariable Long userId,
            @Valid @RequestBody SaveProfileRequest request
    ) {
        return userProfileService.save(userId, request);
    }
}