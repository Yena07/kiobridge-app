package com.kiobridge.kiobridge.modules.stateevidence.service;

import com.kiobridge.kiobridge.contracts.Evidence;
import com.kiobridge.kiobridge.contracts.Recommendation;
import com.kiobridge.kiobridge.contracts.SimulationValidation;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EvidenceSummaryServiceTest {

    private final EvidenceSummaryService service = new EvidenceSummaryService();

    @Test
    void PASS면_정상완료_문구와_추천이유가_채워진다() {
        Recommendation recommendation = new Recommendation(
            "CHICKEN-001", List.of(), List.of(), Map.of(),
            List.of("매운맛 닭강정을 추천해 드립니다."), List.of(), 0.95, false
        );
        Evidence evidence = evidenceWith("PASS", "NORMAL_BOUNDARY_STOP", "VERIFY_CART_VERIFIED", 0, recommendation);

        EvidenceSummary summary = service.summarize(evidence);

        assertThat(summary.status()).isEqualTo("정상적으로 장바구니에 추가되었습니다.");
        assertThat(summary.recommendation()).isEqualTo("매운맛 닭강정을 추천해 드립니다.");
        assertThat(summary.stopReason()).isNull();
    }

    @Test
    void 결제_액션이_계획에_포함되면_PASS여도_실행불가로_요약된다() {
        Evidence evidence = evidenceWith("PASS", "NONE", null, 1, null);

        EvidenceSummary summary = service.summarize(evidence);

        assertThat(summary.status()).isEqualTo("실행할 수 없습니다.");
    }

    @Test
    void SAFETY_STOP이면_안전중단_문구와_중단사유가_채워진다() {
        Evidence evidence = evidenceWith("FAIL", "SAFETY_STOP", "UNKNOWN_STATE", 0, null);

        EvidenceSummary summary = service.summarize(evidence);

        assertThat(summary.status()).isEqualTo("안전하게 중단되었습니다.");
        assertThat(summary.stopReason()).isEqualTo("UNKNOWN_STATE");
    }

    @Test
    void 그외_실패면_처리중_문제_문구가_나온다() {
        Evidence evidence = evidenceWith("FAIL", "NONE", "SOME_ERROR", 0, null);

        EvidenceSummary summary = service.summarize(evidence);

        assertThat(summary.status()).isEqualTo("처리 중 문제가 발생했습니다.");
    }

    @Test
    void recommendationReasons가_빈문자열만_있으면_null로_처리된다() {
        Recommendation recommendation = new Recommendation(
            "CHICKEN-001", List.of(), List.of(), Map.of(),
            List.of("", "  "), List.of(), 0.5, false
        );
        Evidence evidence = evidenceWith("PASS", "NONE", null, 0, recommendation);

        EvidenceSummary summary = service.summarize(evidence);

        assertThat(summary.recommendation()).isNull();
    }

    @Test
    void evidence가_null이면_안전한_기본값을_반환한다() {
        EvidenceSummary summary = service.summarize(null);

        assertThat(summary.status()).isEqualTo("처리 중 문제가 발생했습니다.");
        assertThat(summary.recommendation()).isNull();
    }

    private Evidence evidenceWith(
        String result, String stopType, String stopReason,
        int plannedPaymentActionCount, Recommendation recommendation
    ) {
        return new Evidence(
            "1.2", "RUN-1", "SESS-1", "chicken-store", "chicken-store@0.2.0", "hash",
            "2026-08-10T00:00:00Z", "SIMULATION_ONLY", "DIGITAL_TWIN",
            false, true, false,
            Map.of(), recommendation, null, List.of(), List.of(), List.of(), List.of(), List.of(),
            plannedPaymentActionCount, 0, 0,
            "CART_REVIEW", "STOP", stopType, stopReason,
            true, true, true,
            result, "SIMULATION", "READY",
            Map.of(), Map.of(), "SIMULATION_VALIDATION_ONLY",
            new SimulationValidation(result, true, true, true, true, true),
            null
        );
    }
}