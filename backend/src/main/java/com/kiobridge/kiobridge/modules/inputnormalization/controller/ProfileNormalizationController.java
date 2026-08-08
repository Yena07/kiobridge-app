package com.kiobridge.kiobridge.modules.inputnormalization.controller;

import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.profile.ProfileNormalizationResponse;
import com.kiobridge.kiobridge.modules.inputnormalization.service.ProfileNormalizationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile-normalizations")
public class ProfileNormalizationController {

    private final ProfileNormalizationService service;

    public ProfileNormalizationController(
            ProfileNormalizationService service
    ) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public ProfileNormalizationResponse normalize(
            @Valid @RequestBody ProfileNormalizationRequest request
    ) {
        return service.normalize(request);
    }
}