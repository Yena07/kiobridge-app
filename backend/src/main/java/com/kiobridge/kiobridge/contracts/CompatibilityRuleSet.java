package com.kiobridge.kiobridge.contracts;

import java.util.List;

public record CompatibilityRuleSet(
        String version,
        String environmentId,
        List<CompatibilityRule> rules
) {
}
