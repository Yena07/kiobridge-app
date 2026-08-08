package com.kiobridge.kiobridge.modules.inputnormalization.dto.profile;

import com.kiobridge.kiobridge.contracts.input.profile.CollectionChannel;
import com.kiobridge.kiobridge.contracts.input.profile.PreferredInput;
import com.kiobridge.kiobridge.contracts.input.profile.RetentionPolicy;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;

public record ProfileNormalizationRequest(
        @NotBlank
        @Pattern(regexp = "^chicken-store$")
        String environmentId,

        @Valid
        @NotNull
        ProfileInput profileInput
) {

    public record ProfileInput(
            @NotBlank
            String profileId,

            String displayName,

            @NotNull
            CollectionChannel collectionChannel,

            @NotNull
            Instant collectedAt,

            @Valid
            @NotNull
            AccessibilityInput accessibility,

            @Valid
            @NotNull
            InteractionInput interaction,

            @Valid
            @NotNull
            ConsentInput consent
    ) {
    }

    public record AccessibilityInput(
            @NotNull Boolean largeText,
            @NotNull Boolean simpleSteps,
            @NotNull Boolean visualGuidance,
            @NotNull Boolean hearingSupport,
            @NotNull Boolean mobilitySupport,
            @NotNull Boolean highContrast,
            @NotNull Boolean staffAssistancePreferred
    ) {
    }

    public record InteractionInput(
            @NotNull
            PreferredInput preferredInput,

            @NotBlank
            @Pattern(
                    regexp = "^[a-z]{2,3}(-[A-Z][a-z]{3})?-([A-Z]{2}|[0-9]{3})$"
            )
            String language,

            @NotNull
            Boolean confirmationRequired
    ) {
    }

    public record ConsentInput(
            @NotNull Boolean personalization,
            @NotNull RetentionPolicy retentionPolicy
    ) {
    }
}