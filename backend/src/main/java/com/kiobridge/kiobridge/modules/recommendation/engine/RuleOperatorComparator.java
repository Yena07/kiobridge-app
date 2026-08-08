package com.kiobridge.kiobridge.modules.recommendation.engine;

import java.util.List;
import java.util.Objects;

/**
 * CompatibilityRule.operator() 비교 로직.
 * Kit 원본(packages/evaluator/src/compatibility.ts의 compare())을 그대로 포팅했다 — 우리가 새로
 * 설계한 게 아니라 Kit이 자기 환경 전체(chicken-store 외 hospital/public-office/sandbox 포함)에
 * 대해 검증에 쓰는 바로 그 비교 규칙이다.
 */
final class RuleOperatorComparator {

    private RuleOperatorComparator() {
    }

    static boolean compare(String operator, Object sourceValue, Object candidateValue) {
        List<Object> sourceValues = RuleValueSupport.asList(sourceValue);
        List<Object> candidateValues = RuleValueSupport.asList(candidateValue);

        return switch (operator) {
            case "IN" -> containsEqual(candidateValues, sourceValue);
            case "EQUALS" -> equalsValue(candidateValue, sourceValue);
            case "INTERSECTS" -> sourceValues.stream().anyMatch(u -> containsEqual(candidateValues, u));
            case "CONTAINS" -> sourceValues.stream().allMatch(u -> containsEqual(candidateValues, u));
            case "DISJOINT" -> sourceValues.stream().noneMatch(u -> containsEqual(candidateValues, u));
            case "CONTAINS_SELECTED" -> {
                // 아직 아무것도 선택 안 된 상태는 구조적 문제라 여기서 판단하지 않는다 (Kit 원본 주석과 동일).
                if (candidateValue == null) {
                    yield true;
                }
                yield candidateValues.stream().allMatch(c -> containsEqual(sourceValues, c));
            }
            case "EQUALS_SELECTED" -> candidateValue == null || equalsValue(candidateValue, sourceValue);
            case "MAX" -> {
                Double limit = toNumber(sourceValue);
                Double actual = toNumber(candidateValue);
                if (limit == null || actual == null) {
                    yield true; // 숫자로 못 바꾸면 판단 불가 -> 통과 (Kit 원본과 동일한 방어적 기본값)
                }
                yield actual <= limit;
            }
            default -> true;
        };
    }

    private static boolean containsEqual(List<Object> values, Object target) {
        return values.stream().anyMatch(v -> equalsValue(v, target));
    }

    private static boolean equalsValue(Object a, Object b) {
        return Objects.equals(RuleValueSupport.stringOf(a), RuleValueSupport.stringOf(b));
    }

    private static Double toNumber(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String str) {
            try {
                return Double.parseDouble(str);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
