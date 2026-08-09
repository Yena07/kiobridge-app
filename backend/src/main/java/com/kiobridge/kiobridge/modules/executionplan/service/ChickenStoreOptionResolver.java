package com.kiobridge.kiobridge.modules.executionplan.service;

import com.kiobridge.kiobridge.contracts.Candidate;

import java.util.List;
import java.util.Map;

/**
 * environments/chicken-store/option-groups.json + 후보(candidate)의 supportedOptions 기반으로
 * 그룹별 실제 option id를 고른다.
 * (STEP4의 RuleValueResolver/RuleOperatorComparator와 같은 위치의 "환경 데이터 해석" 계층)
 *
 * candidates.json 실제 데이터를 보면 후보마다 그룹별 지원값이 좁게 제한돼 있다
 * (예: CHICKEN-002는 SPICY_LEVEL을 MILD로만 지원). 그래서 preferredId가 option-groups.json
 * 상 유효한 값이라는 것만으로는 안 되고, "이 후보가 실제로 그 값을 지원하는지"까지 확인해야
 * 한다 — 안 그러면 후보가 지원하지 않는 옵션을 선택하는 실행계획이 만들어진다.
 *
 * 우선순위 (candidate가 그 groupId에 대해 supportedOptions를 선언한 경우):
 *  1) preferredId가 후보의 지원값이면서 그룹에도 실존하면 그대로 사용
 *  2) 후보가 지원하는 값 중 그룹에 실존하는 첫 값으로 대체
 *  3) 후보 지원값이 전부 그룹 정의와 어긋나면(데이터 불일치) 그룹의 첫 번째 option id로 폴백
 *
 * candidate가 그 groupId에 대해 supportedOptions를 아예 선언하지 않은 경우 (해당 후보에겐
 * 그룹 제약이 없다는 뜻) — preferredId가 그룹에 실존하면 그대로 쓰고, 없으면 그룹 첫 옵션.
 */
final class ChickenStoreOptionResolver {

    private ChickenStoreOptionResolver() {
    }

    static String resolveOptionId(
        List<Map<String, Object>> optionGroups,
        String groupId,
        String preferredId,
        Candidate candidate
    ) {
        Map<String, Object> group = findGroup(optionGroups, groupId);
        if (group == null) {
            throw new IllegalStateException("optionGroups에 " + groupId + " 그룹이 없습니다.");
        }
        List<String> validIds = optionIds(group);
        if (validIds.isEmpty()) {
            throw new IllegalStateException(groupId + " 그룹에 옵션이 없습니다.");
        }

        List<String> supportedIds = supportedOptionIds(candidate, groupId);
        if (!supportedIds.isEmpty()) {
            if (preferredId != null && supportedIds.contains(preferredId) && validIds.contains(preferredId)) {
                return preferredId;
            }
            for (String supportedId : supportedIds) {
                if (validIds.contains(supportedId)) {
                    return supportedId;
                }
            }
            return validIds.get(0);
        }

        if (preferredId != null && validIds.contains(preferredId)) {
            return preferredId;
        }
        return validIds.get(0);
    }

    /** QUANTITY처럼 그룹 option에 "value"(숫자)가 별도로 붙어 있을 때 그 값으로 id를 찾는다. */
    static String resolveOptionIdByValue(List<Map<String, Object>> optionGroups, String groupId, Integer value) {
        if (value == null) {
            return null;
        }
        Map<String, Object> group = findGroup(optionGroups, groupId);
        if (group == null) {
            return null;
        }
        for (Map<String, Object> option : optionsOf(group)) {
            Object rawValue = option.get("value");
            if (rawValue instanceof Number number && number.intValue() == value) {
                return (String) option.get("id");
            }
        }
        return null;
    }

    private static Map<String, Object> findGroup(List<Map<String, Object>> optionGroups, String groupId) {
        for (Map<String, Object> group : optionGroups) {
            if (groupId.equals(group.get("groupId"))) {
                return group;
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> optionsOf(Map<String, Object> group) {
        Object options = group.get("options");
        return options instanceof List<?> list ? (List<Map<String, Object>>) list : List.of();
    }

    private static List<String> optionIds(Map<String, Object> group) {
        return optionsOf(group).stream()
            .map(option -> (String) option.get("id"))
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    private static List<String> supportedOptionIds(Candidate candidate, String groupId) {
        if (candidate.supportedOptions() == null) {
            return List.of();
        }
        return candidate.supportedOptions().getOrDefault(groupId, List.of());
    }
}
