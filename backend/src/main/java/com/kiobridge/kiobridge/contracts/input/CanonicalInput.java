package com.kiobridge.kiobridge.contracts.input;

import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;

import java.util.Objects;

public record CanonicalInput<
        S extends SessionContextBase<?, ?, ?, ?>
        >(
        String inputContractVersion,
        String environmentId,
        String teamId,
        CanonicalProfile profile,
        S sessionContext
) {

    public CanonicalInput {
        requireNonBlank(
                inputContractVersion,
                "inputContractVersion"
        );
        requireNonBlank(
                environmentId,
                "environmentId"
        );
        requireNonBlank(
                teamId,
                "teamId"
        );

        Objects.requireNonNull(
                profile,
                "profile은 null일 수 없습니다."
        );
        Objects.requireNonNull(
                sessionContext,
                "sessionContext는 null일 수 없습니다."
        );
    }

    private static void requireNonBlank(
            String value,
            String fieldName
    ) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    fieldName + "은 비어 있을 수 없습니다."
            );
        }
    }
}