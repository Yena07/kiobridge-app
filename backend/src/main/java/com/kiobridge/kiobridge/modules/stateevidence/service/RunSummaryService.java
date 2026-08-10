package com.kiobridge.kiobridge.modules.stateevidence.service;

import com.kiobridge.kiobridge.contracts.ExecutedAction;
import com.kiobridge.kiobridge.contracts.RunResult;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * RunResult.executedActions()를 화면 재생용으로 가벼운 형태로 가공한다.
 * 원본 RunResult는 uiState 등 프론트가 실제로 필요하지 않은 정보를 다량 포함하고 있어,
 * actionIndex 순서와 성공/실패, 사람이 읽을 라벨만 남긴다.
 */
@Service
public class RunSummaryService {

    public List<RunStep> summarize(RunResult run) {
        if (run == null || run.executedActions() == null) {
            return List.of();
        }

        return run.executedActions().stream()
            .sorted((a, b) -> Integer.compare(a.actionIndex(), b.actionIndex()))
            .map(this::toStep)
            .toList();
    }

    private RunStep toStep(ExecutedAction action) {
        return new RunStep(
            action.actionIndex(),
            action.action(),
            action.resolvedLabel(),
            action.ok()
        );
    }
}