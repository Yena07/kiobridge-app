package com.kiobridge.kiobridge.modules.inputnormalization.controller;

import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.context.SessionContextNormalizationResponse;
import com.kiobridge.kiobridge.modules.inputnormalization.service.SessionContextNormalizationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/session-context-normalizations")
public class SessionContextNormalizationController {

    private final SessionContextNormalizationService service;

    public SessionContextNormalizationController(
            SessionContextNormalizationService service
    ) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.OK)
    public SessionContextNormalizationResponse normalize(
            @Valid
            @RequestBody
            SessionContextNormalizationRequest request
    ) {
        return service.normalize(request);
    }
}