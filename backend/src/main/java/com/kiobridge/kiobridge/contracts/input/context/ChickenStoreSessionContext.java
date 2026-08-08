package com.kiobridge.kiobridge.contracts.input.context;

import java.util.Map;
import java.util.Objects;

public record ChickenStoreSessionContext(
        SessionIntent intent,
        ChickenStoreFacts facts,
        ChickenStorePreferences preferences,
        ChickenStoreHardConstraints hardConstraints,
        ChickenStoreCapabilities capabilities,
        Map<String, FieldMetadata> fieldMetadata
) implements SessionContextBase<
        ChickenStoreFacts,
        ChickenStorePreferences,
        ChickenStoreHardConstraints,
        ChickenStoreCapabilities
        > {
    public ChickenStoreSessionContext {
        Objects.requireNonNull(
                intent,
                "intent는 null일 수 없습니다."
        );
        Objects.requireNonNull(
                facts,
                "facts는 null일 수 없습니다."
        );
        Objects.requireNonNull(
                preferences,
                "preferences는 null일 수 없습니다."
        );
        Objects.requireNonNull(
                hardConstraints,
                "hardConstraints는 null일 수 없습니다."
        );
        Objects.requireNonNull(
                capabilities,
                "capabilities는 null일 수 없습니다."
        );

        fieldMetadata = fieldMetadata == null
                ? Map.of()
                : Map.copyOf(fieldMetadata);
    }
}