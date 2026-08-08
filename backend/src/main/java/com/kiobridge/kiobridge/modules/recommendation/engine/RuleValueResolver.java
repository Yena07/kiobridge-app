package com.kiobridge.kiobridge.modules.recommendation.engine;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.input.context.FieldMetadata;
import com.kiobridge.kiobridge.contracts.input.context.SessionContextBase;

import java.lang.reflect.Method;
import java.util.Map;

/**
 * RuleEvaluatorImpl 판정의 1단계(값 추출).
 * CompatibilityRule이 가리키는 실제 값을 sessionContext / candidate에서 그대로 꺼내온다.
 * 값이 UNKNOWN/NO_PREFERENCE/NOT_APPLICABLE/누락 중 무엇을 의미하는지는 해석하지 않는다 —
 * 그 해석(2단계, unknownPolicy 처리)과 operator 비교(3단계)는 이 클래스의 책임이 아니다.
 *
 * 패키지 전용(default 접근)으로 두어 RuleEvaluatorImpl 외부에서 직접 쓰지 않도록 한다.
 * 두 메서드 모두 순수 함수라 RuleEvaluator/RuleEvaluatorImpl 없이 단독으로 단위 테스트 가능하다.
 */
final class RuleValueResolver {

    private RuleValueResolver() {
    }

    /**
     * sessionContext 쪽 값을 읽는다.
     * source.section()으로 facts/preferences/hardConstraints/capabilities 중 하나를 고른 뒤,
     * 그 객체에서 source.path()와 이름이 같은 접근자를 리플렉션으로 호출한다.
     *
     * SessionContextBase&lt;?,?,?,?&gt;는 환경마다 F/P/H/C 실제 타입이 달라 컴파일 타임에 알 수 없으므로,
     * path 이름만으로 값을 꺼내려면 리플렉션 외에 다른 방법이 없다.
     *
     * 반환값이 null이면 "그 필드가 실제로 비어있다"는 뜻이다. UNKNOWN 판정은 여기서 하지 않는다.
     */
    static Object resolveSourceValue(CompatibilityRule.RuleSource source, SessionContextBase<?, ?, ?, ?> sessionContext) {
        Object sectionValue = switch (source.section()) {
            case "facts" -> sessionContext.facts();
            case "preferences" -> sessionContext.preferences();
            case "hardConstraints" -> sessionContext.hardConstraints();
            case "capabilities" -> sessionContext.capabilities();
            default -> throw new IllegalStateException(
                "CompatibilityRule.source.section=\"" + source.section() + "\"은 지원하지 않는 section입니다. "
                    + "facts/preferences/hardConstraints/capabilities 중 하나여야 합니다."
            );
        };

        if (sectionValue == null) {
            return null;
        }

        return invokeAccessor(sectionValue, source.path());
    }

    /**
     * source가 가리키는 필드의 FieldMetadata(confidence/confirmedByUser 등)를 읽는다.
     *
     * 담당1의 ChickenStoreSessionContextMapper.buildFieldMetadata()가 실제로 채우는 키 형식은
     * "path"가 아니라 "/section/path"(예: "/hardConstraints/allergenIds") 이므로 그 형식 그대로 조립해서 찾는다.
     * 해당 경로에 담당1이 메타데이터를 안 채웠으면(예: 값 자체가 없어 putIfProvided가 스킵된 경우) null을 반환한다 —
     * 이 경우도 2단계(unknownPolicy 처리)에서 "메타데이터 없음"으로 다뤄야 한다.
     */
    static FieldMetadata resolveFieldMetadata(CompatibilityRule.RuleSource source, SessionContextBase<?, ?, ?, ?> sessionContext) {
        String key = "/" + source.section() + "/" + source.path();
        return sessionContext.fieldMetadata().get(key);
    }

    /**
     * candidate 쪽 값을 읽는다. 호출자는 evaluationScope==CANDIDATE 규칙의 rule.candidate()(RuleTarget)를
     * 넘겨야 한다 (evaluationScope==EXECUTION_CHOICE 규칙의 rule.target()이 아님).
     *
     * Candidate는 환경에 상관없이 고정된 구체 타입이라 리플렉션 없이 source 종류별로 명시적으로 분기한다.
     */
    static Object resolveCandidateValue(CompatibilityRule.RuleTarget target, Candidate candidate) {
        return switch (target.source()) {
            case "field" -> resolveCandidateField(target.key(), candidate);
            case "attributes" -> mapGet(candidate.attributes(), target.key());
            case "supportedOptions" -> mapGet(candidate.supportedOptions(), target.key());
            case "requirements" -> mapGet(candidate.requirements(), target.key());
            case "supports" -> mapGet(candidate.supports(), target.key());
            default -> throw new IllegalStateException(
                "CompatibilityRule.candidate.source=\"" + target.source() + "\"은 지원하지 않는 source입니다. "
                    + "field/attributes/supportedOptions/requirements/supports 중 하나여야 합니다."
            );
        };
    }

    private static Object resolveCandidateField(String key, Candidate candidate) {
        return switch (key) {
            case "candidateId" -> candidate.candidateId();
            case "name" -> candidate.name();
            case "domain" -> candidate.domain();
            case "available" -> candidate.available();
            case "dataClassification" -> candidate.dataClassification();
            case "price" -> candidate.price();
            case "description" -> candidate.description();
            default -> throw new IllegalStateException(
                "Candidate에 \"" + key + "\"라는 field가 없습니다. CompatibilityRule 정의를 확인하세요."
            );
        };
    }

    private static Object mapGet(Map<String, ?> map, String key) {
        return map == null ? null : map.get(key);
    }

    private static Object invokeAccessor(Object target, String path) {
        try {
            Method accessor = target.getClass().getMethod(path);
            return accessor.invoke(target);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(
                "CompatibilityRule.source.path=\"" + path + "\"에 대응하는 접근자가 "
                    + target.getClass().getSimpleName() + "에 없습니다. "
                    + "규칙 정의와 세션 컨텍스트 타입이 어긋났을 수 있습니다.",
                e
            );
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(
                "path=\"" + path + "\" 값을 읽는 중 오류가 발생했습니다 (target=" + target.getClass().getSimpleName() + ")",
                e
            );
        }
    }
}
