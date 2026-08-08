package com.kiobridge.kiobridge.modules.recommendation.engine;

/**
 * RuleEvaluator가 규칙 하나를 판정한 결과의 종류.
 *
 * PASS      — 규칙 조건을 만족함
 * FAIL      — 규칙 조건을 위반함 (제외/감점 여부는 rule.severity()로 호출자가 판단)
 * RECONFIRM — 필요한 값이 UNKNOWN이고 rule.unknownPolicy()==RECONFIRM이라 임의 추론 불가.
 *             사용자 재확인이 필요함 (docs/UNKNOWN_POLICY.md)
 * SKIPPED   — 규칙 자체가 이번 판정에 해당하지 않음 (예: unknownPolicy==IGNORE, neutralValues 매칭 등)
 */
public enum RuleResult {
    PASS,
    FAIL,
    RECONFIRM,
    SKIPPED
}
