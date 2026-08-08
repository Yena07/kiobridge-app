package com.kiobridge.kiobridge.modules.executionplan.controller.dto;

import com.kiobridge.kiobridge.contracts.ParticipantSubmission;

import java.util.Objects;

/** POST /internal/simulation/submit-and-run 요청. */
public record SubmitAndRunRequest(String sessionId, ParticipantSubmission submission) {
    public SubmitAndRunRequest {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("sessionId는 비어있을 수 없습니다.");
        }
        Objects.requireNonNull(submission, "submission은 null일 수 없습니다.");
    }
}
