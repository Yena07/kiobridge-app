package com.kiobridge.kiobridge.contracts.input.profile;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CanonicalProfile(
        String profileId,
        String displayName,
        DataClassification dataClassification,
        ProfileSource source,
        Accessibility accessibility,
        Interaction interaction,
        Consent consent
) {
}