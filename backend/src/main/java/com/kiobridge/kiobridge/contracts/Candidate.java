package com.kiobridge.kiobridge.contracts;

import java.util.List;
import java.util.Map;

public record Candidate(
        String candidateId,
        String name,
        String domain,
        Boolean available,
        String dataClassification,
        Double price,                           // null 가능
        String description,                     // null 가능
        Map<String, List<String>> supportedOptions, // null 가능
        Map<String, Object> attributes,         // null 가능
        Map<String, Object> requirements,       // null 가능 (관공서 authenticationMethods)
        Map<String, Object> supports            // null 가능 (largeText 등, 규칙엔 안 쓰이고 점수용)
) {
}
