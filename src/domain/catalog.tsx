import type { ReactNode } from "react";
import type { DetailOption, PlaceType, ProfileData } from "@/domain/types";
import { Pictogram } from "@/design/Pictogram";

export const DETAIL_OPTIONS: Record<string, DetailOption[]> = {
  카페: [
    { label: "이용 방식", multi: false, choices: ["매장컵", "테이크아웃"] },
    { label: "음료", multi: false, choices: ["아메리카노", "카페라떼", "카푸치노", "콜드브루", "바닐라라떼"] },
    { label: "온도", multi: false, choices: ["HOT", "ICE"] },
    { label: "사이즈", multi: false, choices: ["Short", "Tall", "Grande", "Venti"] },
    { label: "샷 추가", multi: false, choices: ["1샷 추가", "2샷 추가"] },
    { label: "시럽", multi: true, choices: ["바닐라", "헤이즐넛", "카라멜", "시럽 없음"] },
    { label: "우유 변경", multi: false, choices: ["일반 우유", "오트밀크", "두유", "저지방"] },
  ],
  음식점: [
    { label: "서비스 모드", multi: false, choices: ["매장", "포장", "드라이브스루"] },
    { label: "메뉴", multi: false, choices: ["닭강정", "불고기버거 세트", "치즈버거 세트", "치킨버거 세트"] },
    { label: "맵기", multi: false, choices: ["순한맛", "보통", "매운맛"] },
    { label: "형태", multi: false, choices: ["순살", "뼈"] },
    { label: "수량", multi: false, choices: ["1개", "2개", "3개"] },
    { label: "사이드 변경", multi: false, choices: ["기본 후렌치후라이", "어니언링으로 변경", "샐러드로 변경"] },
    { label: "음료 변경", multi: false, choices: ["콜라", "사이다로 변경", "제로콜라로 변경"] },
    { label: "추가 옵션", multi: true, choices: ["종이컵", "피클 빼기", "양파 빼기", "소스 추가"] },
    // 알레르기는 선호가 아니라 절대 조건이다. 겹치는 메뉴는 순위를 낮추는 게 아니라 아예 뺀다.
    { label: "알레르기 (꼭 빼주세요)", multi: true, choices: ["땅콩", "대두", "우유", "계란", "밀", "새우"] },
  ],
  // 접수·안내 범위만 허용. 증상·진단·치료 관련 항목은 두지 않는다.
  병원: [
    { label: "접수 유형", multi: false, choices: ["초진", "재진"] },
    { label: "예약 여부", multi: false, choices: ["예약", "당일"] },
    { label: "진료과", multi: false, choices: ["내과", "정형외과", "피부과", "안과", "이비인후과"] },
    { label: "인증 수단", multi: false, choices: ["신분증", "건강보험증", "모바일 인증", "예약 바코드"] },
  ],
  관공서: [
    { label: "발급 방식", multi: true, choices: ["본인 수령", "대리 수령", "즉시 발급", "우편 발송"] },
    { label: "민원 종류", multi: false, choices: ["주민등록등본", "주민등록초본", "가족관계증명서", "인감증명서"] },
    { label: "발급 부수", multi: false, choices: ["1부", "2부", "3부", "5부"] },
    { label: "주민번호 뒷자리", multi: false, choices: ["표시", "미표시"] },
    { label: "언어", multi: false, choices: ["국문", "영문"] },
  ],
};

// 장소 픽토그램. 관공서는 기둥이 선 관청 형태(bank)가 가장 알아보기 쉽다.
export const PLACE_LIST: { label: PlaceType; icon: ReactNode }[] = [
  { label: "카페", icon: <Pictogram name="coffee" size={22} /> },
  { label: "음식점", icon: <Pictogram name="forkKnife" size={22} /> },
  { label: "병원", icon: <Pictogram name="hospital" size={22} /> },
  { label: "관공서", icon: <Pictogram name="bank" size={22} /> },
];

export const PLACE_ICONS: Record<string, ReactNode> = {
  카페: <Pictogram name="coffee" size={19} />,
  음식점: <Pictogram name="forkKnife" size={19} />,
  병원: <Pictogram name="hospital" size={19} />,
  관공서: <Pictogram name="bank" size={19} />,
};

// 메뉴 사진은 여기 두지 않는다. 저장된 프로필은 의미값(텍스트)만 갖고,
// 사진은 키오스크 카탈로그가 매핑 응답으로 내려 준 것만 쓴다. (src/api/mock.ts)

export const MOCK_PROFILES: ProfileData[] = [
  {
    id: "1",
    menuName: "닭강정",
    place: "음식점",
    selections: {
      "서비스 모드": ["포장"], "메뉴": ["닭강정"], "맵기": ["매운맛"],
      "형태": ["순살"], "수량": ["1개"], "추가 옵션": ["종이컵"],
      "알레르기 (꼭 빼주세요)": ["땅콩"],
    },
    memo: "",
  },
  {
    id: "2",
    menuName: "아이스 아메리카노 둘",
    place: "카페",
    selections: { "이용 방식": ["테이크아웃"], "음료": ["아메리카노"], "온도": ["ICE"], "사이즈": ["Tall"], "시럽": ["바닐라"] },
    memo: "얼음 적게 부탁드려요",
  },
  {
    id: "3",
    menuName: "불고기버거 세트",
    place: "음식점",
    selections: { "서비스 모드": ["포장"], "메뉴": ["불고기버거 세트"], "추가 옵션": ["피클 빼기", "양파 빼기"] },
    memo: "",
  },
];

export const STEPS = ["포장/매장 선택", "메뉴 선택", "옵션 선택", "옵션 확정·담기", "장바구니 확인"] as const;
