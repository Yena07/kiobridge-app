package com.kiobridge.kiobridge.contracts;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/**
 * STEP 8 collectUserDecision 의 결과.
 * 스키마 원본: schemas/core/user-decision.schema.json (Kit 제공)
 * required 2개 필드: approved, decision(APPROVE/REJECT/MODIFY). additionalProperties:false라
 * 스키마에 없는 필드를 넣으면 Kit이 그대로 거부한다 (예전 rejectedReason/modifiedFields가 그랬음).
 *
 * approved=false 인 경우 ExecutionPlan.actions() 는 반드시 빈 리스트여야 한다 (Kit 검증 규칙).
 *
 * confirmedAt/note는 optional이지만 스키마 타입이 순수 "string"이라 null을 허용하지 않는다.
 * @JsonInclude(NON_NULL) 없이 note=null을 직렬화하면 Kit이 "note must be string"으로 거부한다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record UserDecision(
    boolean approved,
    String decision,     // "APPROVE" | "REJECT" | "MODIFY"
    String confirmedAt,  // ISO-8601 UTC, 선택
    String note          // 선택 (거절/수정 사유 등 자유 텍스트)
) {
    private static final Set<String> VALID_DECISIONS = Set.of("APPROVE", "REJECT", "MODIFY");

    public UserDecision {
        if (decision == null || !VALID_DECISIONS.contains(decision)) {
            throw new IllegalArgumentException("decision은 APPROVE/REJECT/MODIFY 중 하나여야 합니다.");
        }
        if (confirmedAt != null) {
            // schemas/core/iso-8601-utc.schema.json: 로컬시각·숫자 오프셋 금지, 반드시 대문자 Z로 끝나야 함
            if (!confirmedAt.endsWith("Z")) {
                throw new IllegalArgumentException(
                    "confirmedAt은 UTC(Z로 끝나는 ISO-8601) 형식이어야 합니다: " + confirmedAt
                );
            }
            try {
                Instant.parse(confirmedAt);
            } catch (DateTimeParseException e) {
                throw new IllegalArgumentException(
                    "confirmedAt이 유효한 ISO-8601 UTC 시각이 아닙니다: " + confirmedAt, e
                );
            }
        }
    }

    public static UserDecision approve() {
        return new UserDecision(true, "APPROVE", nowUtc(), null);
    }

    public static UserDecision reject(String reason) {
        return new UserDecision(false, "REJECT", nowUtc(), reason);
    }

    /** 사용자가 조건을 다시 입력하고 싶어하는 경우. 실행 전 재확인이 필요하므로 approved=false로 둔다. */
    public static UserDecision modify(String note) {
        return new UserDecision(false, "MODIFY", nowUtc(), note);
    }

    private static String nowUtc() {
        return Instant.now().truncatedTo(ChronoUnit.MILLIS).toString();
    }
}
