package com.kiobridge.kiobridge.modules.stateevidence.service;

import com.kiobridge.kiobridge.contracts.Evidence;
import com.kiobridge.kiobridge.contracts.Recommendation;
import org.springframework.stereotype.Service;

@Service
public class EvidenceSummaryService {

    public EvidenceSummary summarize(Evidence evidence) {
        if (evidence == null || evidence.result() == null) {
            return new EvidenceSummary("처리 중 문제가 발생했습니다.", null, null);
        }

        String status;
        if (evidence.plannedPaymentActionCount() > 0) {
            status = "실행할 수 없습니다.";
        } else if ("PASS".equals(evidence.result())) {
            status = "정상적으로 장바구니에 추가되었습니다.";
        } else if ("SAFETY_STOP".equals(evidence.stopType())) {
            status = "안전하게 중단되었습니다.";
        } else {
            status = "처리 중 문제가 발생했습니다.";
        }

        String reason = !"PASS".equals(evidence.result())
            ? evidence.stopReason()
            : null;

        Recommendation rec = evidence.recommendation();
        String recommendationSummary = null;
        if (rec != null && rec.recommendationReasons() != null) {
            recommendationSummary = rec.recommendationReasons().stream()
                .filter(r -> r != null && !r.isBlank())
                .findFirst()
                .orElse(null);
        }

        return new EvidenceSummary(status, recommendationSummary, reason);
    }
}