package com.kiobridge.kiobridge.contracts;


/**
 * 의미 기반 실행 Action 1건.
 * action 값은 환경 manifest 의 allowedActions 중 하나여야 한다
 * (예: select_service, select_menu, select_option, confirm_option, open_cart_review, verify_cart).
 * select_payment 등 forbiddenActions 에 해당하는 값은 절대 넣지 않는다.
 */
public record Action(
    int actionIndex,
    String action,
    Target target,
    State expectedBeforeState,
    State expectedAfterState
) {}
