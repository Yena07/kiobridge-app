package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.ExcludedCandidate;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;
import com.kiobridge.kiobridge.modules.recommendation.ChickenStoreExclusionMessages;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * STEP4 filterCandidates 오케스트레이션 (1층).
 *
 * 전체 후보 목록 + 환경의 CompatibilityRule 목록 + sessionContext를 받아, evaluationScope==CANDIDATE
 * 규칙만으로 후보마다 RuleEvaluator.evaluate()를 호출하고 결과를 집계한다.
 * evaluationScope==EXECUTION_CHOICE 규칙(사용자가 실제 선택한 옵션 검증, environments 폴더의 각 환경별
 * compatibility-rules.json의 CHICKEN_SELECTED_ 류)은 Kit의 validate()가 서버에서 재검증하므로 여기서는 다루지 않는다.
 *
 * 실제 operator(DISJOINT/MAX/IN/...)·unknownPolicy 판정 로직은 RuleEvaluator(RuleEvaluatorImpl)에 위임한다.
 * RuleEvaluatorImpl이 아직 스텁(UnsupportedOperationException)이어도 이 클래스는 그 자체로 컴파일되고,
 * RuleEvaluator를 mock으로 대체하면 단위 테스트도 가능하다 (인터페이스 우선 병렬 개발).
 */
@Service
public class CandidateFilterService {

    private static final String BLOCK = "BLOCK";

    private final RuleEvaluator ruleEvaluator;
    private final ChickenStoreExclusionMessages exclusionMessages;

    public CandidateFilterService(RuleEvaluator ruleEvaluator, ChickenStoreExclusionMessages exclusionMessages) {
        this.ruleEvaluator = ruleEvaluator;
        this.exclusionMessages = exclusionMessages;
    }

    public CandidateFilterResult filter(List<Candidate> candidates, List<CompatibilityRule> rules,
                                         SessionContextBase<?, ?, ?, ?> sessionContext) {
        Objects.requireNonNull(candidates, "candidates는 null일 수 없습니다.");
        Objects.requireNonNull(rules, "rules는 null일 수 없습니다.");
        Objects.requireNonNull(sessionContext, "sessionContext는 null일 수 없습니다.");

        List<CompatibilityRule> candidateScopeRules = rules.stream()
            .filter(CandidateFilterService::isCandidateScope)
            .toList();

        List<Candidate> eligible = new ArrayList<>();
        List<ExcludedCandidate> excluded = new ArrayList<>();
        Map<String, List<RuleEvaluationResult>> warningsByCandidateId = new LinkedHashMap<>();
        Map<String, List<RuleEvaluationResult>> reconfirmationsByCandidateId = new LinkedHashMap<>();

        for (Candidate candidate : candidates) {
            boolean blocked = false;
            List<RuleEvaluationResult> warnings = new ArrayList<>();
            List<RuleEvaluationResult> reconfirmations = new ArrayList<>();

            // RECONFIRM은 후보 제외 여부와 무관한 세션 단위 신호이므로, 이미 BLOCK이 확정된 후보라도
            // 나머지 규칙을 계속 평가해서 놓치지 않는다 (중간에 break하지 않음).
            for (CompatibilityRule rule : candidateScopeRules) {
                RuleEvaluationResult result = ruleEvaluator.evaluate(rule, candidate, sessionContext);

                switch (result.result()) {
                    case FAIL -> {
                        if (BLOCK.equals(result.severity())) {
                            if (!blocked) {
                                // 여러 BLOCK 규칙을 위반해도 대표 사유 하나만 기록한다 (ExcludedCandidate는 1건).
                                excluded.add(new ExcludedCandidate(
                                    candidate.candidateId(),
                                    result.errorCode(),
                                    "ruleId=" + rule.ruleId()
                                        + ", sourceValue=" + result.sourceValue()
                                        + ", candidateValue=" + result.candidateValue(),
                                    exclusionMessages.resolve(result.errorCode(), result.sourceValue())
                                ));
                            }
                            blocked = true;
                        } else {
                            warnings.add(result);
                        }
                    }
                    case RECONFIRM -> reconfirmations.add(result);
                    case PASS, SKIPPED -> {
                        // no-op
                    }
                }
            }

            if (!blocked) {
                eligible.add(candidate);
                if (!warnings.isEmpty()) {
                    warningsByCandidateId.put(candidate.candidateId(), warnings);
                }
                if (!reconfirmations.isEmpty()) {
                    reconfirmationsByCandidateId.put(candidate.candidateId(), reconfirmations);
                }
            }
        }

        return new CandidateFilterResult(eligible, excluded, warningsByCandidateId, reconfirmationsByCandidateId);
    }

    /**
     * evaluationScope가 명시적으로 "CANDIDATE"거나, evaluationScope가 없고(null) target도 없는(=candidate
     * 필드를 쓰는 구버전 규칙) 경우를 CANDIDATE scope로 본다.
     * (CompatibilityRule 주석: "evaluationScope, null이면 target 유무로 판별")
     */
    private static boolean isCandidateScope(CompatibilityRule rule) {
        if ("CANDIDATE".equals(rule.evaluationScope())) {
            return true;
        }
        return rule.evaluationScope() == null && rule.target() == null;
    }
}
