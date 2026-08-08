package com.kiobridge.kiobridge.contracts.input.profile;

public record Interaction(
        PreferredInput preferredInput,
        String language,
        boolean confirmationRequired
) {
}