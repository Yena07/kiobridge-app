package com.kiobridge.kiobridge.modules.recommendation.controller.dto;

import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.contracts.input.profile.CanonicalProfile;

import java.util.Objects;

/**
 * POST /api/v1/recommendations 요청.
 * candidateFilterResult는 클라이언트로부터 받지 않는다 — 서버가 environmentId/sessionContext로
 * 직접 다시 계산한다. 클라이언트가 보낸 필터 결과를 그대로 신뢰하면 안전 필터링(알레르기 등)을
 * 우회할 수 있는 취약점이 생기기 때문이다.
 */
public record RecommendationRequest(
    String environmentId,
    CanonicalProfile profile,
    ChickenStoreSessionContext sessionContext
) {
    public RecommendationRequest {
        Objects.requireNonNull(environmentId, "environmentId는 null일 수 없습니다.");
        Objects.requireNonNull(profile, "profile은 null일 수 없습니다.");
        Objects.requireNonNull(sessionContext, "sessionContext는 null일 수 없습니다.");
    }
}
