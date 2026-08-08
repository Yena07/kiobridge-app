package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;

/**
 * CompatibilityRule 하나를 sessionContext/candidate 조합에 대해 판정한다.
 * (environments/chicken-store/compatibility-rules.json 의 DISJOINT/MAX/IN/EQUALS_SELECTED 등)
 *
 * 담당2(recommendation)가 candidate 필터링(STEP4)·추천(STEP5) 로직에서 후보별로 이 메서드를
 * 반복 호출해 제외(excludedCandidates) 여부와 사유(errorCode)를 판단하는 데 쓴다.
 *
 * evaluationScope==EXECUTION_CHOICE 인 규칙(예: EQUALS_SELECTED)은 Kit의 validate()가 서버에서
 * 자체적으로 재검증하므로, 이 인터페이스는 evaluationScope==CANDIDATE 규칙 판정을 우선 대상으로 한다.
 */
public interface RuleEvaluator {

    /**
     * @param rule           판정할 호환성 규칙 (예: allergens DISJOINT/BLOCK, price MAX/BLOCK)
     * @param candidate      판정 대상 후보
     * @param sessionContext 담당1이 만든 세션 컨텍스트 (facts/preferences/hardConstraints/fieldMetadata 조회용)
     * @return 판정 결과 (PASS/FAIL/RECONFIRM/SKIPPED + severity/errorCode)
     */
    RuleEvaluationResult evaluate(CompatibilityRule rule, Candidate candidate,
                                   SessionContextBase<?, ?, ?, ?> sessionContext);
}
