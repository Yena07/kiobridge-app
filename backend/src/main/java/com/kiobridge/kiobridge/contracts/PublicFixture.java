package com.kiobridge.kiobridge.contracts;

import java.util.List;
import java.util.Map;

public record PublicFixture(
        Map<String, Object> manifest,   // 필드 다양하게 필요해지면 record로 바꾸기
        List<Candidate> candidates,
        List<Map<String, Object>> optionGroups,
        CompatibilityRuleSet compatibilityRules // fixture에 임베드돼서 올 수도 있음
) {}
