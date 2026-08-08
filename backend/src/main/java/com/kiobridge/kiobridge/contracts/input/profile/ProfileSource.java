package com.kiobridge.kiobridge.contracts.input.profile;

import java.time.Instant;

public record ProfileSource(
        CollectionChannel collectionChannel,
        String providerId,
        Instant collectedAt
) {
}