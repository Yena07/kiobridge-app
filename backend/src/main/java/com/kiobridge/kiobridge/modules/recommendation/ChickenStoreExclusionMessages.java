package com.kiobridge.kiobridge.modules.recommendation;

import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * chicken-store 환경의 CompatibilityRule errorCode를 사용자에게 보여줄 친절한 한 문장으로 바꾼다.
 *
 * environments/chicken-store/compatibility-rules.json에 정의된 errorCode 값에 직접 결합돼 있다.
 * RuleEvaluator / RuleValueResolver / CandidateFilterService(modules.recommendation.engine)는
 * 어떤 환경의 규칙이 와도 동작하는 범용 엔진이지만, 이 클래스는 그렇지 않다 — errorCode 자체가
 * 이미 chicken-store라는 특정 환경의 데이터이므로, "errorCode → 사용자 문장" 매핑은 태생적으로
 * 환경 전용일 수밖에 없다. 다른 환경이 추가되면 이 클래스도 통째로 교체/추가되어야 한다.
 */
@Component
public class ChickenStoreExclusionMessages {

    private static final Map<String, String> TEMPLATES = Map.of(
        "ALLERGEN_CONFLICT", "%s 알레르기와 겹쳐서 제외됐어요.",
        "PRICE_LIMIT_EXCEEDED", "설정하신 가격 한도를 넘어서 제외됐어요."
    );

    private static final String DEFAULT_MESSAGE = "선택하신 조건과 맞지 않아 제외됐어요.";

    /**
     * @param errorCode   CompatibilityRule.errorCode() (예: "ALLERGEN_CONFLICT")
     * @param sourceValue RuleEvaluationResult.sourceValue() — 템플릿에 "%s"가 있으면 그 자리에 그대로 채운다.
     *                    (예: sourceValue=[PEANUT] → "[PEANUT] 알레르기와 겹쳐서 제외됐어요.")
     *                    TODO: 코드값을 사람이 읽는 이름으로 바꾸려면 Kit의 getVocabulary() 매핑이 추가로 필요하다.
     */
    public String resolve(String errorCode, Object sourceValue) {
        String template = TEMPLATES.get(errorCode);
        if (template == null) {
            return DEFAULT_MESSAGE;
        }
        return template.contains("%s") ? String.format(template, sourceValue) : template;
    }
}
