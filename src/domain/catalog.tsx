import type { ReactNode } from "react";
import type { DetailOption, PlaceType, ProfileData } from "@/domain/types";
import { Pictogram } from "@/design/Pictogram";

// 키를 PlaceType 으로 좁혀 둔다. string 이면 장소를 새로 넣을 때 한쪽만 채워도
// 컴파일러가 아무 말을 안 하고, 그 장소는 화면에서 조용히 빈칸이 된다.
export const DETAIL_OPTIONS: Record<NonNullable<PlaceType>, DetailOption[]> = {
  카페: [
    { label: "이용 방식", multi: false, choices: ["매장컵", "테이크아웃"] },
    { label: "음료", multi: false, choices: ["아메리카노", "카페라떼", "카푸치노", "콜드브루", "바닐라라떼"] },
    { label: "온도", multi: false, choices: ["HOT", "ICE"] },
    { label: "사이즈", multi: false, choices: ["Short", "Tall", "Grande", "Venti"] },
    { label: "샷 추가", multi: false, choices: ["1샷 추가", "2샷 추가"] },
    // '시럽 없음' 은 다른 시럽과 같이 고를 수 없다.
    { label: "시럽", multi: true, choices: ["바닐라", "헤이즐넛", "카라멜", "시럽 없음"], exclusive: ["시럽 없음"] },
    { label: "우유 변경", multi: false, choices: ["일반 우유", "오트밀크", "두유", "저지방"] },
  ],
  // 아래 세 곳의 질문과 선택지는 공식 시뮬레이션 킷의 option-groups.json 을 그대로 따른다.
  // 사용자가 고른 조건이 실제로 후보를 가르는 축이어야 하기 때문이다.
  // fixture 에 없는 축(드라이브스루·버거 세트·사이드 변경 등)을 화면에만 두면
  // 어르신은 골랐는데 결과는 아무것도 달라지지 않는, 물어만 보고 버리는 질문이 된다.
  //
  // 메뉴 이름은 여기 두지 않는다. 프로필 화면 맨 위의 자유 입력(menuName)으로 받는다.
  // 사용자가 부르는 이름("닭강정")과 오늘 화면의 이름("매운 순살 닭강정")을 맞추는 건
  // 매핑의 일이지 앱이 목록에서 고르게 할 일이 아니다.
  음식점: [
    // chicken-store: SERVICE_TYPE / SPICY_LEVEL / BONE_TYPE / CUP / QUANTITY
    { label: "이용 방식", multi: false, choices: ["먹고 가기", "포장하기"] },
    { label: "맵기", multi: false, choices: ["순한맛", "보통맛", "매운맛"] },
    { label: "형태", multi: false, choices: ["뼈", "순살"] },
    // 컵은 '추가 옵션' 다중선택 안에 묻어 두지 않는다. fixture 에서 독립된 축이고,
    // 확인 카드에 반드시 보여야 하는 다섯 항목 중 하나라 따로 묻는다.
    { label: "컵", multi: false, choices: ["종이컵", "일반컵"] },
    { label: "수량", multi: false, choices: ["1개", "2개", "3개"] },
    // 알레르기는 option-group 이 아니라 사람에 대한 절대 조건이라 fixture 축과 맞추지 않는다.
    // 겹치는 메뉴는 순위를 낮추는 게 아니라 후보에서 아예 뺀다.
    // 오늘 이 가게에서 실제로 걸리는 건 땅콩뿐이지만, 나머지를 지우면
    // 새우 알레르기가 있는 사람이 그 사실을 말할 방법이 사라진다.
    { label: "알레르기 (꼭 빼주세요)", multi: true, choices: ["땅콩", "대두", "우유", "계란", "밀", "새우"] },
  ],
  // 접수·안내 범위만 허용. 증상·진단·치료 관련 항목은 두지 않는다.
  // hospital: VISIT_TYPE / APPOINTMENT / DEPARTMENT / SUPPORT
  병원: [
    { label: "방문 유형", multi: false, choices: ["초진", "재진", "건강검진", "검사"] },
    { label: "예약 여부", multi: false, choices: ["예약 있음", "예약 없음"] },
    // '미정'을 선택지로 남겨 둔다. 어느 과인지 모르는 사람에게 앱이 대신 정해 주지 않고,
    // 진료과가 정해지지 않은 채로도 받아 주는 안내 경로로 보낸다.
    { label: "진료과", multi: false, choices: ["내과", "정형외과", "영상의학과", "건강검진센터", "미정 (안내 필요)"] },
    // 이 축이 없으면 접근성 지원이 필요한 사람과 아닌 사람의 결과가 같아진다.
    { label: "접근성 지원", multi: false, choices: ["지원 없음", "큰 글씨", "청각 지원", "직원 도움"] },
  ],
  // 이용자격·법적 수급 가능성은 판단하지 않는다. 업무 선택과 절차 안내만 한다.
  // public-office: CATEGORY / AUTH_METHOD
  관공서: [
    { label: "민원 분야", multi: false, choices: ["주민등록", "가족관계", "건강보험", "지방세", "직원 상담"] },
    // 지금 가진 인증수단으로 이 기계에서 진행이 되는지만 본다. 자격 판단이 아니다.
    // 안 되는 후보는 점수를 깎는 게 아니라 후보에서 뺀다(AUTH_METHOD_UNAVAILABLE).
    { label: "인증 방식", multi: false, choices: ["모바일 인증", "신분증 인증", "직원 확인"] },
  ],
};

// 장소 픽토그램. 관공서는 기둥이 선 관청 형태(bank)가 가장 알아보기 쉽다.
export const PLACE_LIST: { label: PlaceType; icon: ReactNode }[] = [
  { label: "카페", icon: <Pictogram name="coffee" size={22} /> },
  { label: "음식점", icon: <Pictogram name="forkKnife" size={22} /> },
  { label: "병원", icon: <Pictogram name="hospital" size={22} /> },
  { label: "관공서", icon: <Pictogram name="bank" size={22} /> },
];

export const PLACE_ICONS: Record<NonNullable<PlaceType>, ReactNode> = {
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
      "이용 방식": ["포장하기"], "맵기": ["매운맛"], "형태": ["순살"],
      "컵": ["종이컵"], "수량": ["1개"],
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
    menuName: "닭강정",
    place: "음식점",
    // 같은 가게, 다른 사람의 조건. 첫 번째 프로필과 모든 축이 반대라
    // 저장한 조건이 결과를 실제로 바꾼다는 걸 목록에서 바로 보여 준다.
    selections: {
      "이용 방식": ["먹고 가기"], "맵기": ["순한맛"], "형태": ["뼈"],
      "컵": ["일반컵"], "수량": ["2개"],
    },
    memo: "매운 건 못 드세요",
  },
];

export const STEPS = ["포장/매장 선택", "메뉴 선택", "옵션 선택", "옵션 확정·담기", "장바구니 확인"] as const;
