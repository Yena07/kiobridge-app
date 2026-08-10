package com.kiobridge.kiobridge.modules.stateevidence.service;

import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;
import java.util.List;

public record ApprovalResult(
    boolean valid,
    EvidenceSummary summary,            // 성공 시에만 채워짐
    List<String> validationMessages,    // 실패 시 사용자용 메시지 목록
    List<RunStep> runSteps,             // 화면 재생용 단계 목록
    ExecuteResult raw                   // 원본 그대로 (프론트가 상세 필요하면 사용)
) {}