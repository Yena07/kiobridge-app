package com.kiobridge.kiobridge.modules.stateevidence.service;

import com.kiobridge.kiobridge.contracts.client.dto.ExecuteResult;

public record ApprovalResult(
    boolean valid,
    EvidenceSummary summary,   // 성공 시에만 채워짐
    ExecuteResult raw          // 원본 그대로 (프론트가 상세 필요하면 사용)
) {}