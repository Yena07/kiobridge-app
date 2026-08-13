import type { ReactNode } from "react";
import type { DetailOption, PlaceType } from "@/domain/types";
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
  // 메뉴 이름은 여기 두지 않는다. 주문표 화면 맨 위의 자유 입력(menuName)으로 받는다.
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
    /*
     * 알레르기는 여기서 묻지 않는다. 가입 직후에 한 번 묻고 모든 주문에 쓴다
     * (api/allergy.ts).
     *
     * 주문표마다 물으면 새 주문표를 만들 때마다 다시 골라야 하고, 한 번 빠뜨리면
     * 그 주문표로 주문할 때 안 걸러진다. 빠뜨려도 되는 값이 아니다.
     *
     * 예전에 저장한 주문표에는 이 축이 남아 있을 수 있다. canonical.ts 는 그것도
     * 계속 읽어서 합친다 - 화면이 안 묻게 됐다고 이미 적어 둔 알레르기를 조용히
     * 버리면, 그 사람은 걸러질 줄 알고 승인한다.
     */
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
/**
 * 화면이 고르게 하는 장소.
 *
 * 이번 시나리오는 닭강정집 하나만 쓴다. 카페·병원·관공서를 뺐다 — 백엔드가
 * 다루는 것은 닭강정집뿐이라, 다른 장소로 주문표를 만들면 서버가 축을 못 찾아
 * UNKNOWN 으로 채우고 확인 카드가 텅 빈 채로 승인 화면이 뜬다.
 *
 * 타입(PlaceType)과 축 표(DETAIL_OPTIONS)는 그대로 둔다. 목이 카페 후보를 들고
 * 있고, 저장된 옛 주문표도 읽을 수 있어야 한다 — 고르는 자리만 좁힌다.
 */
export const PLACE_LIST: { label: PlaceType; icon: ReactNode }[] = [
  { label: "음식점", icon: <Pictogram name="forkKnife" size={22} /> },
];

export const PLACE_ICONS: Record<NonNullable<PlaceType>, ReactNode> = {
  카페: <Pictogram name="coffee" size={19} />,
  음식점: <Pictogram name="forkKnife" size={19} />,
  병원: <Pictogram name="hospital" size={19} />,
  관공서: <Pictogram name="bank" size={19} />,
};

// 메뉴 사진은 여기 두지 않는다. 저장된 주문표는 의미값(텍스트)만 갖고,
// 사진은 키오스크 카탈로그가 매핑 응답으로 내려 준 것만 쓴다. (src/api/mock.ts)

/*
 * 미리 넣어 두던 주문표 세 장(MOCK_SHEETS)은 없앴다.
 *
 * 처음 연 사람에게 자기가 만든 적 없는 주문표가 세 장 놓여 있었다. 화면은
 * '저장된 주문표' 라고 부르는데 저장한 적이 없으니, 이걸 지워도 되는지 남의
 * 것인지 알 수가 없다. 개인정보 화면이 "적어 두신 내용만 저장해요" 라고
 * 말하는 것과도 어긋난다 — 적은 적이 없는데 있다.
 *
 * 이제 빈 목록으로 시작한다. 그 화면은 이미 있다(SavedScreen 의 '저장된
 * 주문표가 없어요'). 시연에서 주문표를 만드는 것부터 보여 주면 된다.
 */

export const STEPS = ["포장/매장 선택", "메뉴 선택", "옵션 선택", "옵션 확정·담기", "장바구니 확인"] as const;
