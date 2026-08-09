package com.kiobridge.kiobridge.modules.recommendation;

import java.util.Objects;

/**
 * RecommendationValidator가 찾아낸 정합성 문제 하나.
 * code는 가능한 한 ERROR_CATALOG 코드를 그대로 쓰고, Kit에 없는 팀 내부 전용 검증은 그 사실을 message에 명시한다.
 * path는 공식 ValidationError와 같은 JSON Pointer 형식(예: "/recommendation/recommendedCandidateId")으로,
 * 프론트가 어느 필드가 문제인지 바로 짚을 수 있게 한다.
 */
public record ValidationIssue(String code, String message, String path) {
    public ValidationIssue {
        Objects.requireNonNull(code, "code는 null일 수 없습니다.");
        Objects.requireNonNull(message, "message는 null일 수 없습니다.");
        Objects.requireNonNull(path, "path는 null일 수 없습니다.");
    }
}
