import type { CartResult, MappingResponse, MappingState } from "@/domain/types";

import dakgangjeongImg from "@/assets/images/dakgangjeong.jpg";
import icedAmericanoImg from "@/assets/images/iced-americano.jpg";
import bulgogiBurgerImg from "@/assets/images/bulgogi-burger.jpg";

// 백엔드 합의 전까지 화면을 구동하는 목 데이터.
// 스키마는 키오브릿지_API_계약_초안_v0.1.md 의 POST /mapping · GET /plan/{id}/status 와 동일하다.
// 백엔드가 붙으면 이 파일 대신 client.ts 를 주입하고 화면 코드는 건드리지 않는다.

// 키오스크가 오늘 걸어 둔 메뉴판 사진. 실제로는 매장 카탈로그에서 내려오는 값이라
// 앱이 아니라 이 목 API 쪽에 둔다. 앱은 매핑 응답에 실려 온 것만 그려야 한다.
// 실서비스에서는 여기가 카탈로그의 이미지 URL로 바뀐다.
const KIOSK_MENU_PHOTOS: Record<string, string> = {
  "매운 순살 닭강정": dakgangjeongImg,
  "순한 순살 닭강정": dakgangjeongImg,
  "매운 뼈 닭강정": dakgangjeongImg,
  "아이스 아메리카노": icedAmericanoImg,
  "불고기버거 세트": bulgogiBurgerImg,
};

// 요건서 대표 주문: '매운맛 닭강정 · 포장 · 종이컵'.
// 저장 프로필(MOCK_PROFILES[0])과 아래 매핑 결과가 같은 주문을 가리켜야 한다.
//
// 메뉴명·가격은 공식 시뮬레이션 킷의 chicken-store fixture(CHICKEN-001~008)와 같은 값을
// 쓴다. 심사에서 실제로 돌아가는 환경이 그것이라, 화면에만 있는 가짜 메뉴를 보여 주면
// 시연과 제출물이 서로 다른 이야기를 하게 된다.
export const MOCK_MENU_NAME = "닭강정";

// 사용자가 저장해 둔 조건. 아래 이유 문장들이 이 값에서 나온다.
const 저장한조건 = { 이용방식: "포장하기", 맵기: "매운맛", 형태: "순살", 컵: "종이컵", 알레르기: "땅콩" };

// 이 주문에서 실제로 쓴 사용자 정보와, 무엇을 왜 뺐는지.
// "AI가 골랐습니다" 같은 문장은 설명이 아니므로 쓰지 않는다.
const 기본이유: MappingResponse["reasons"] = [
  { kind: "used", text: `${저장한조건.이용방식}를 고르셔서 포장이 되는 메뉴만 남겼어요` },
  { kind: "used", text: `맵기를 ${저장한조건.맵기}으로 저장해 두셔서 ${저장한조건.맵기} 메뉴를 먼저 보여드려요` },
  { kind: "used", text: `${저장한조건.형태}을 고르셔서 뼈 없는 메뉴로 맞췄어요` },
  { kind: "excluded", text: `${저장한조건.알레르기} 알레르기를 알려주셔서 땅콩 토핑 닭강정은 뺐어요` },
  { kind: "excluded", text: "품절 닭강정은 지금 팔지 않아서 뺐어요" },
];

export const MOCK_MAPPING: Record<MappingState, MappingResponse> = {
  exact: {
    result: "exact",
    reasons: 기본이유,
    item: {
      displayName: "매운 순살 닭강정",
      priceText: "6,000원",
      imageUrl: KIOSK_MENU_PHOTOS["매운 순살 닭강정"],
      options: [
        { label: "이용 방식", value: "포장하기", matched: true },
        { label: "맵기", value: "매운맛", matched: true },
        { label: "형태", value: "순살", matched: true },
        { label: "컵", value: "종이컵", matched: true },
        { label: "수량", value: "1개", matched: true },
      ],
    },
  },
  clarification: {
    result: "clarification",
    reason: `저장하신 '${MOCK_MENU_NAME}'과 비슷한 메뉴가 여러 개예요`,
    reasons: 기본이유,
    // candidateId 는 이번 매핑 응답에서만 쓰는 임시 표식이다.
    // 키오스크 상품 ID 를 앱이 들고 있지 않도록 의도적으로 불투명한 값을 쓴다.
    candidates: [
      { candidateId: "c1", displayName: "매운 순살 닭강정", priceText: "6,000원", imageUrl: KIOSK_MENU_PHOTOS["매운 순살 닭강정"] },
      { candidateId: "c2", displayName: "매운 뼈 닭강정", priceText: "5,500원", imageUrl: KIOSK_MENU_PHOTOS["매운 뼈 닭강정"] },
      { candidateId: "c3", displayName: "순한 순살 닭강정", priceText: "6,000원", imageUrl: KIOSK_MENU_PHOTOS["순한 순살 닭강정"] },
    ],
  },
  not_found: {
    result: "not_found",
    message: `저장하신 '${MOCK_MENU_NAME}'이 오늘의 메뉴에 없어요. 메뉴가 바뀌었을 수 있어요.`,
  },
  changed: {
    result: "changed",
    diffNote: "저장하신 주문과 달라진 점이 있어요 — 종이컵 옵션이 빠졌어요. 이대로 진행할까요?",
    reasons: 기본이유,
    item: {
      displayName: "매운 순살 닭강정",
      priceText: "6,000원",
      imageUrl: KIOSK_MENU_PHOTOS["매운 순살 닭강정"],
      options: [
        { label: "이용 방식", value: "포장하기", matched: true },
        { label: "맵기", value: "매운맛", matched: true },
        { label: "형태", value: "순살", matched: true },
        { label: "컵", value: "종이컵", matched: false, note: "오늘은 제공되지 않아요" },
        { label: "수량", value: "1개", matched: true },
      ],
    },
  },
  low_confidence: {
    result: "low_confidence",
    reasons: 기본이유,
    item: {
      displayName: "매운 순살 닭강정",
      priceText: "6,000원",
      imageUrl: KIOSK_MENU_PHOTOS["매운 순살 닭강정"],
      options: [
        { label: "이용 방식", value: "포장하기", matched: true },
        { label: "맵기", value: "매운맛", matched: true },
        { label: "형태", value: "순살", matched: true },
        { label: "컵", value: "종이컵", matched: true },
        { label: "수량", value: "1개", matched: true },
      ],
    },
  },
};

// P0-7: 결제 경계. 종료 상태는 장바구니까지이며 결제 관련 필드는 두지 않는다.
export const MOCK_CART: CartResult = {
  itemCountText: "1개",
  totalText: "6,000원",
  evidenceLabel: "화면 인식으로 확인됨",
  handoff: "키오스크 화면에서 장바구니를 확인해 주세요. 결제는 키오스크에서 직접 진행하시면 돼요.",
};
