package com.kiobridge.kiobridge.contracts.input.context;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChickenStorePreferences(
        ServiceType serviceType,
        SpicyLevel spicyLevel,
        BoneType boneType,
        CupOption cupOption,
        Integer quantity
) {
}