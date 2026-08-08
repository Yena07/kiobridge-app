package com.kiobridge.kiobridge.contracts;

/**
 * KioBridge Simulation Kit이 정의한 공통 상태 값.
 * environments/&lt;id&gt;/manifest.json 의 "states" 와 1:1로 대응한다.
 * 참가팀이 임의로 상태를 추가하거나 변경할 수 없다 (state-engine이 서버에서 강제 검증).
 */
public enum State {
    SERVICE_TYPE,
    MENU_SELECTION,
    OPTION_SELECTION,
    OPTION_CONFIRM,
    MENU_SELECTION_WITH_CART,
    CART_REVIEW,
    STOP
}
