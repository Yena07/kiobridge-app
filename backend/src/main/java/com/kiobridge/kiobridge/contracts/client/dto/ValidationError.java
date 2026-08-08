package com.kiobridge.kiobridge.contracts.client.dto;

/** validate 응답의 개별 오류 항목. */
public record ValidationError(
    String path,
    String code,
    String message
) {}
