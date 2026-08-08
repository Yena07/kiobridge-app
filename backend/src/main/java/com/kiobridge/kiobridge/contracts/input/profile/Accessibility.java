package com.kiobridge.kiobridge.contracts.input.profile;

public record Accessibility(
        boolean largeText,
        boolean simpleSteps,
        boolean visualGuidance,
        boolean hearingSupport,
        boolean mobilitySupport,
        boolean highContrast,
        boolean staffAssistancePreferred
) {
}