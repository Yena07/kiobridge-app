package com.kiobridge.kiobridge.common.web;

/** GlobalExceptionHandler가 만드는 오류 응답 공통 형태. */
public record ApiErrorResponse(String code, String message) {}
