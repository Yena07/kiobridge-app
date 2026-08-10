package com.kiobridge.kiobridge.common.web;

import com.kiobridge.kiobridge.modules.member.exception.DuplicateLoginIdException;
import com.kiobridge.kiobridge.modules.member.exception.InvalidCredentialsException;
import com.kiobridge.kiobridge.modules.member.exception.UserNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

/**
 * 도메인 예외를 구분되는 HTTP 상태 코드로 변환한다 (CodeRabbit 지적 사항).
 *
 * 지금까지 어떤 컨트롤러도 예외 처리를 하지 않아서, IllegalStateException/IllegalArgumentException
 * 같은 요청 검증 실패나 Simulation API 통신 실패가 전부 구분 안 되는 500으로 나가고 있었다.
 * @RestControllerAdvice는 애플리케이션 전역에 적용되므로 이 프로젝트의 모든 컨트롤러(다른 STEP
 * 컨트롤러 포함)에 동일하게 적용된다 — 의도한 범위 확장이니 참고.
 *
 * IllegalArgumentException/NullPointerException/IllegalStateException 메시지는 우리가 직접
 * 호출자에게 보여주려고 작성한 문장들이라(예: "추천된 candidateId(...)가 fixture 후보 목록에
 * 없습니다") 그대로 노출한다. Simulation API 쪽 예외(RestClientException 계열)는 원본 응답 본문을
 * 그대로 흘려보내지 않고 일반화된 메시지로 감싼다 — 내부 통신 세부사항을 호출자에게 노출하지
 * 않기 위함이다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        return badRequest(e.getMessage());
    }

    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<ApiErrorResponse> handleNullPointer(NullPointerException e) {
        return badRequest(e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiErrorResponse> handleIllegalState(IllegalStateException e) {
        return badRequest(e.getMessage());
    }

    /** 연결/응답 타임아웃 등 Simulation API에 아예 닿지 못한 경우. */
    @ExceptionHandler(ResourceAccessException.class)
    public ResponseEntity<ApiErrorResponse> handleResourceAccess(ResourceAccessException e) {
        return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(
            new ApiErrorResponse(
                "SIMULATION_API_TIMEOUT",
                "Simulation API 응답이 너무 늦어요. 잠시 후 다시 시도해 주세요."
            )
        );
    }

    /** Simulation API가 오류 상태로 응답한 경우 등 그 외 통신 실패 전반. */
    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<ApiErrorResponse> handleRestClient(RestClientException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
            new ApiErrorResponse(
                "SIMULATION_API_ERROR",
                "Simulation API와 통신하는 데 실패했어요."
            )
        );
    }

    private ResponseEntity<ApiErrorResponse> badRequest(String message) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse("INVALID_REQUEST", message));
    }

    @ExceptionHandler(DuplicateLoginIdException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateLoginId(
            DuplicateLoginIdException e
    ) {
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(
                        new ApiErrorResponse(
                                "LOGIN_ID_DUPLICATED",
                                e.getMessage()
                        )
                );
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException e
    ) {
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(
                        new ApiErrorResponse(
                                "INVALID_CREDENTIALS",
                                e.getMessage()
                        )
                );
    }
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleUserNotFound(
            UserNotFoundException e
    ) {
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(
                        new ApiErrorResponse(
                                "USER_NOT_FOUND",
                                e.getMessage()
                        )
                );
    }
}
