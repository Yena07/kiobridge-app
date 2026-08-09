package com.kiobridge.kiobridge.modules.recommendation.controller;

import com.kiobridge.kiobridge.contracts.Candidate;
import com.kiobridge.kiobridge.contracts.CompatibilityRule;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.client.SimulationApiClient;
import com.kiobridge.kiobridge.contracts.input.context.ChickenStoreSessionContext;
import com.kiobridge.kiobridge.modules.recommendation.RecommendationEngineService;
import com.kiobridge.kiobridge.modules.recommendation.RecommendationValidator;
import com.kiobridge.kiobridge.modules.recommendation.ValidationOutcome;
import com.kiobridge.kiobridge.modules.recommendation.controller.dto.CandidateFilterRequest;
import com.kiobridge.kiobridge.modules.recommendation.controller.dto.RecommendationRequest;
import com.kiobridge.kiobridge.modules.recommendation.controller.dto.RecommendationValidationRequest;
import com.kiobridge.kiobridge.modules.recommendation.controller.dto.RecommendationValidationResponse;
import com.kiobridge.kiobridge.modules.recommendation.engine.CandidateFilterResult;
import com.kiobridge.kiobridge.modules.recommendation.engine.CandidateFilterService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;

/**
 * 담당2(추천 엔진) STEP4~7을 프론트/오케스트레이터에 노출하는 내부 API.
 * environmentId 기준 candidates/compatibility-rules는 SimulationApiClient로 Kit fixture에서
 * 직접 가져오고, 판정·점수·검증 로직은 각 서비스에 위임한다 — 이 클래스는 변환/오케스트레이션만 한다.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class RecommendationController {

    private final SimulationApiClient simulationApiClient;
    private final CandidateFilterService candidateFilterService;
    private final RecommendationEngineService recommendationEngineService;
    private final RecommendationValidator recommendationValidator;

    /** POST /api/v1/candidate-filters — STEP4. BLOCK 규칙 위반 후보를 걸러낸다. */
    @PostMapping("/candidate-filters")
    public CandidateFilterResult filterCandidates(@RequestBody CandidateFilterRequest request) {
        Objects.requireNonNull(request, "request는 null일 수 없습니다.");
        return computeCandidateFilterResult(request.environmentId(), request.sessionContext());
    }

    /**
     * POST /api/v1/recommendations — STEP5~7.
     * candidateFilterResult를 클라이언트에게서 받지 않고 매번 서버에서 environmentId/sessionContext로
     * 직접 다시 계산한다 — 클라이언트가 필터 결과를 조작해 안전 필터링(알레르기·가격 등)을 우회하는 것을 막기 위함.
     */
    @PostMapping("/recommendations")
    public Recommendation recommend(@RequestBody RecommendationRequest request) {
        Objects.requireNonNull(request, "request는 null일 수 없습니다.");

        CandidateFilterResult filterResult = computeCandidateFilterResult(request.environmentId(), request.sessionContext());
        return recommendationEngineService.recommend(filterResult, request.sessionContext(), request.profile());
    }

    private CandidateFilterResult computeCandidateFilterResult(String environmentId, ChickenStoreSessionContext sessionContext) {
        List<Candidate> candidates = simulationApiClient.getFixture(environmentId).candidates();
        List<CompatibilityRule> rules = simulationApiClient.getCompatibilityRules(environmentId).rules();
        return candidateFilterService.filter(candidates, rules, sessionContext);
    }

    /** POST /api/v1/recommendation-output-validations — recommend() 결과를 제출 전 자체 검증한다. */
    @PostMapping("/recommendation-output-validations")
    public RecommendationValidationResponse validateRecommendation(@RequestBody RecommendationValidationRequest request) {
        Objects.requireNonNull(request, "request는 null일 수 없습니다.");

        List<Candidate> allCandidates = simulationApiClient.getFixture(request.environmentId()).candidates();
        ValidationOutcome outcome = recommendationValidator.validate(request.recommendation(), allCandidates);

        return RecommendationValidationResponse.from(outcome);
    }
}
