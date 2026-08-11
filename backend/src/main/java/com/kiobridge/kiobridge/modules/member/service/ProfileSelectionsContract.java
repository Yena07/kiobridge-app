package com.kiobridge.kiobridge.modules.member.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 화면 복원용 selections의 저장 계약.
 *
 * P0 공식 환경인 음식점(chicken-store)은
 * 프론트 화면의 한글 축 이름과 표시값만 허용한다.
 */
final class ProfileSelectionsContract {

    private static final String CHICKEN_STORE_PLACE =
            "음식점";

    private static final Map<String, Set<String>>
            CHICKEN_STORE_OPTIONS = Map.of(
            "이용 방식",
            Set.of("먹고 가기", "포장하기"),

            "맵기",
            Set.of("순한맛", "보통맛", "매운맛"),

            "형태",
            Set.of("뼈", "순살"),

            "컵",
            Set.of("종이컵", "일반컵"),

            "수량",
            Set.of("1개", "2개", "3개"),

            "알레르기 (꼭 빼주세요)",
            Set.of(
                    "땅콩",
                    "대두",
                    "우유",
                    "계란",
                    "밀",
                    "새우"
            )
    );

    private ProfileSelectionsContract() {
    }

    static void validate(
            String place,
            Map<String, List<String>> selections
    ) {
        if (!CHICKEN_STORE_PLACE.equals(place)) {
            return;
        }

        for (Map.Entry<String, List<String>> entry
                : selections.entrySet()) {

            String axis = entry.getKey();

            Set<String> allowedValues =
                    CHICKEN_STORE_OPTIONS.get(axis);

            if (allowedValues == null) {
                throw new IllegalArgumentException(
                        "지원하지 않는 음식점 선택 항목입니다: "
                                + axis
                );
            }

            List<String> unsupportedValues =
                    entry.getValue()
                            .stream()
                            .filter(value ->
                                    !allowedValues.contains(value)
                            )
                            .toList();

            if (!unsupportedValues.isEmpty()) {
                throw new IllegalArgumentException(
                        axis
                                + " 항목에 지원하지 않는 값이 있습니다: "
                                + unsupportedValues
                );
            }
        }
    }
}