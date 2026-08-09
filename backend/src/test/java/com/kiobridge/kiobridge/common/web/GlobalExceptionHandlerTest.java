package com.kiobridge.kiobridge.common.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void IllegalArgumentException은_400과_원본_메시지를_그대로_돌려준다() {
        ResponseEntity<ApiErrorResponse> response =
            handler.handleIllegalArgument(new IllegalArgumentException("environmentId는 비어있을 수 없습니다."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().code()).isEqualTo("INVALID_REQUEST");
        assertThat(response.getBody().message()).isEqualTo("environmentId는 비어있을 수 없습니다.");
    }

    @Test
    void NullPointerException은_400을_돌려준다() {
        ResponseEntity<ApiErrorResponse> response =
            handler.handleNullPointer(new NullPointerException("sessionId는 null일 수 없습니다."));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().code()).isEqualTo("INVALID_REQUEST");
    }

    @Test
    void IllegalStateException은_400을_돌려준다() {
        ResponseEntity<ApiErrorResponse> response = handler.handleIllegalState(
            new IllegalStateException("추천된 candidateId(CHICKEN-999)가 fixture 후보 목록에 없습니다.")
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().message()).contains("CHICKEN-999");
    }

    @Test
    void ResourceAccessException은_504를_돌려주고_원본_메시지를_노출하지_않는다() {
        ResponseEntity<ApiErrorResponse> response = handler.handleResourceAccess(
            new ResourceAccessException("Connection timed out to internal-host:4000")
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GATEWAY_TIMEOUT);
        assertThat(response.getBody().code()).isEqualTo("SIMULATION_API_TIMEOUT");
        assertThat(response.getBody().message()).doesNotContain("internal-host");
    }

    @Test
    void 그_외_RestClientException은_502를_돌려주고_원본_메시지를_노출하지_않는다() {
        ResponseEntity<ApiErrorResponse> response = handler.handleRestClient(
            new RestClientException("500 Internal Server Error from Simulation API: {\"secret\":\"leak\"}")
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(response.getBody().code()).isEqualTo("SIMULATION_API_ERROR");
        assertThat(response.getBody().message()).doesNotContain("secret");
    }
}
