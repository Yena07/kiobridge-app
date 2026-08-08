package com.kiobridge.kiobridge.modules.recommendation.engine;

import java.util.List;

/**
 * RuleEvaluatorImpl / RuleOperatorComparator가 공통으로 쓰는 값 정규화 유틸.
 * Kit 원본(packages/evaluator/src/compatibility.ts)의 asArray()/String() 캐스팅에 대응한다.
 */
final class RuleValueSupport {

    private RuleValueSupport() {
    }

    /** 단일 값은 원소 1개짜리 리스트로, null은 빈 리스트로, 리스트는 그대로 감싼다. */
    static List<Object> asList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return List.copyOf(list);
        }
        return List.of(value);
    }

    /**
     * 값 비교·매칭에 쓸 문자열 표현. enum은 name()을 쓴다 — sessionContext 쪽 값이
     * 문자열 "UNKNOWN"이 아니라 enum 상수(예: AllergenId.UNKNOWN)로 들어오기 때문에,
     * 여기서 String.valueOf() 대신 .name()을 명시적으로 써야 "UNKNOWN" 비교가 제대로 맞는다.
     */
    static String stringOf(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Enum<?> enumValue) {
            return enumValue.name();
        }
        return String.valueOf(value);
    }
}
