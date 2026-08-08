package com.kiobridge.kiobridge.contracts.input.profile;

public record Consent(
        boolean personalization,
        RetentionPolicy retentionPolicy
) {
}