package com.kiobridge.kiobridge.contracts;

public record ExcludedCandidate(
        String candidateId,
        String reasonCode,   // ERROR_CATALOG 코드
        String explanation,  //개발자용 상세 근거 "ruleId=CHICKEN_ALLERGEN_HARD_CONSTRAINT, 사용자 allergenIds=[PEANUT], 후보 attributes.allergenIds=[PEANUT], DISJOINT 위반"
        String reasonText //사용자한테 보여줄 짧고 친절한 한 문장. "땅콩 알레르기와 겹쳐서 제외됐어요."
        //explanation, reasonText 용도 확인 필요
) {
}