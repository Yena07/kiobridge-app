package com.kiobridge.kiobridge.modules.inputnormalization.controller;

import com.kiobridge.kiobridge.modules.inputnormalization.dto.input.CanonicalInputValidationRequest;
import com.kiobridge.kiobridge.modules.inputnormalization.dto.input.CanonicalInputValidationResponse;
import com.kiobridge.kiobridge.modules.inputnormalization.service.CanonicalInputValidationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/canonical-inputs")
public class CanonicalInputValidationController {

    private final CanonicalInputValidationService service;

    public CanonicalInputValidationController(
            CanonicalInputValidationService service
    ) {
        this.service = service;
    }

    @PostMapping("/validate")
    @ResponseStatus(HttpStatus.OK)
    public CanonicalInputValidationResponse validate(
            @Valid
            @RequestBody
            CanonicalInputValidationRequest request
    ) {
        return service.validate(request);
    }
}