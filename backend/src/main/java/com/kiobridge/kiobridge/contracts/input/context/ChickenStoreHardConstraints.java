package com.kiobridge.kiobridge.contracts.input.context;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChickenStoreHardConstraints(
        List<AllergenId> allergenIds,
        BigDecimal maxPriceKrw
) {
    public ChickenStoreHardConstraints {
        allergenIds = allergenIds == null
                ? null
                : List.copyOf(allergenIds);
    }
}