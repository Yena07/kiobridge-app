package com.kiobridge.kiobridge.contracts;

import java.util.List;
import java.util.Map;

public record Recommendation(
        String recommendedCandidateId,          // null 가능
        List<String> alternativeCandidateIds, //대안도 hardConstraints 를 지켜야함.
        List<ExcludedCandidate> excludedCandidates, //왜 뺐는가. 화면에서 "이건 왜 없나요?" 에 답할 수 있게 함.
        Map<String, Double> scoreBreakdown, //점수 내역. 설계는 전적으로 여러분의 몫이며 심사 대상
        List<String> recommendationReasons,      // 최소 1개, 사용자가 읽을 문장으로
        List<String> unmetConditions,            //만족시키지 못한 조건
        Double confidence,                       // 0~1
            Boolean requiresReconfirmation  //확신이 낮으면 true. 사용자에게 다시 물어봐야함.
        //모두 [필수]

        //recommendation.schema.json의 required 배열엔 scoreBreakdown,unmetConditions 는 선택 취급이지만 TS 타입과 예제에는
        //필수라고 적혀있어 필수 필드로 가겠습니다.
) {}
