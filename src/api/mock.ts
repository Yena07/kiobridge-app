import type { CartResult, MappedOption, MappingResponse, MappingState, ProfileData, RecommendationReason } from "@/domain/types";

import dakgangjeongImg from "@/assets/images/dakgangjeong.jpg";
import icedAmericanoImg from "@/assets/images/iced-americano.jpg";

// 백엔드 합의 전까지 화면을 구동하는 목 데이터.
// 스키마는 키오브릿지_API_계약_초안_v0.1.md 의 POST /mapping · GET /plan/{id}/status 와 동일하다.
// 백엔드가 붙으면 이 파일 대신 client.ts 를 주입하고 화면 코드는 건드리지 않는다.
//
// 이 파일의 응답은 반드시 사용자가 실제로 저장한 프로필에서 나와야 한다.
// 고정 응답을 돌려주면 확인 화면이 "당신이 고른 조건을 이렇게 썼습니다" 라고 말하면서
// 고른 적 없는 조건을 나열하게 된다. 대신 눌러 주는 앱에서 그건 가장 나쁜 거짓말이다.

// 키오스크가 오늘 걸어 둔 메뉴판 사진. 실제로는 매장 카탈로그에서 내려오는 값이라
// 앱이 아니라 이 목 API 쪽에 둔다. 앱은 매핑 응답에 실려 온 것만 그려야 한다.
// 실서비스에서는 여기가 카탈로그의 이미지 URL로 바뀐다.
const KIOSK_MENU_PHOTOS: Record<string, string> = {
  "매운 순살 닭강정": dakgangjeongImg,
  "순한 순살 닭강정": dakgangjeongImg,
  "매운 뼈 닭강정": dakgangjeongImg,
  "간장 순살 닭강정": dakgangjeongImg,
  "아이스 아메리카노": icedAmericanoImg,
};

export const MOCK_MENU_NAME = "닭강정";

// 오늘 이 키오스크에 걸린 후보. 공식 시뮬레이션 킷의 chicken-store fixture
// (CHICKEN-001~008)와 같은 값이다. 심사에서 실제로 돌아가는 환경이 그것이라,
// 화면에만 있는 가짜 메뉴를 보여 주면 시연과 제출물이 서로 다른 이야기를 하게 된다.
interface 후보 {
  name: string;
  price: number;
  맵기?: string;
  형태?: string;
  이용방식?: string;
  알레르기?: string[];
  품절?: boolean;
}

const 오늘의후보: 후보[] = [
  { name: "매운 순살 닭강정", price: 6000, 맵기: "매운맛", 형태: "순살" },
  { name: "순한 순살 닭강정", price: 6000, 맵기: "순한맛", 형태: "순살" },
  { name: "매운 뼈 닭강정", price: 5500, 맵기: "매운맛", 형태: "뼈" },
  { name: "간장 순살 닭강정", price: 6500, 형태: "순살" },
  { name: "땅콩 토핑 닭강정", price: 7000, 형태: "순살", 알레르기: ["땅콩"] },
  { name: "포장 전용 닭강정", price: 6000, 형태: "순살", 이용방식: "포장하기" },
  { name: "매장 전용 닭강정", price: 6000, 형태: "순살", 이용방식: "먹고 가기" },
  { name: "품절 닭강정", price: 6000, 품절: true },
];

const 원 = (n: number) => n.toLocaleString("ko-KR") + "원";
const 고른값 = (p: ProfileData | undefined, 축: string) => p?.selections?.[축]?.[0];
const 고른값들 = (p: ProfileData | undefined, 축: string) => p?.selections?.[축] ?? [];

const 알레르기축 = "알레르기 (꼭 빼주세요)";

/**
 * 절대 조건으로 후보를 거른다. 점수를 깎는 게 아니라 목록에서 아예 뺀다.
 * 알레르기·품절·이용 불가가 여기 해당한다.
 */
function 절대조건으로거르기(p: ProfileData | undefined) {
  const 알레르기 = 고른값들(p, 알레르기축);
  const 이용방식 = 고른값(p, "이용 방식");
  const 남은: 후보[] = [];
  const 뺀이유: RecommendationReason[] = [];

  for (const c of 오늘의후보) {
    if (c.품절) {
      뺀이유.push({ kind: "excluded", text: `${c.name}은 지금 팔지 않아서 뺐어요` });
      continue;
    }
    const 걸린알레르기 = (c.알레르기 ?? []).filter((a) => 알레르기.includes(a));
    if (걸린알레르기.length > 0) {
      뺀이유.push({
        kind: "excluded",
        text: `${걸린알레르기.join("·")} 알레르기를 알려주셔서 ${c.name}은 뺐어요`,
      });
      continue;
    }
    // 전용 메뉴는 이용 방식이 다르면 애초에 담을 수 없다.
    if (c.이용방식 && 이용방식 && c.이용방식 !== 이용방식) {
      뺀이유.push({ kind: "excluded", text: `${c.name}은 ${c.이용방식}만 돼서 뺐어요` });
      continue;
    }
    남은.push(c);
  }
  return { 남은, 뺀이유 };
}

/** 남은 후보를 사용자가 고른 축과 얼마나 맞는지로 정렬한다. */
function 점수순(남은: 후보[], p: ProfileData | undefined) {
  const 맵기 = 고른값(p, "맵기");
  const 형태 = 고른값(p, "형태");
  return [...남은].sort((a, b) => {
    const s = (c: 후보) => (c.맵기 === 맵기 ? 2 : 0) + (c.형태 === 형태 ? 1 : 0);
    return s(b) - s(a);
  });
}

/** 무엇을 써서 골랐는지 사용자의 말로 적는다. 고른 적 없는 축은 말하지 않는다. */
function 반영한이유(p: ProfileData | undefined, 고름: 후보 | undefined): RecommendationReason[] {
  const out: RecommendationReason[] = [];
  const 이용방식 = 고른값(p, "이용 방식");
  const 맵기 = 고른값(p, "맵기");
  const 형태 = 고른값(p, "형태");

  if (이용방식) out.push({ kind: "used", text: `${이용방식}를 고르셔서 ${이용방식}가 되는 메뉴만 남겼어요` });
  if (맵기) {
    out.push(고름?.맵기 === 맵기
      ? { kind: "used", text: `맵기를 ${맵기}으로 저장해 두셔서 ${맵기} 메뉴로 맞췄어요` }
      : { kind: "used", text: `맵기를 ${맵기}으로 저장해 두셨는데 오늘은 그 조합이 없어서 가장 가까운 걸로 골랐어요` });
  }
  if (형태) {
    out.push(고름?.형태 === 형태
      ? { kind: "used", text: `${형태}을 고르셔서 ${형태} 메뉴로 맞췄어요` }
      : { kind: "used", text: `${형태}을 고르셨는데 오늘은 그 조합이 없어서 가장 가까운 걸로 골랐어요` });
  }
  return out;
}

/** 확인 카드에 그대로 올라가는 표. 사용자가 고른 값만 넣는다. */
function 확인표(p: ProfileData | undefined, 고름: 후보 | undefined): MappedOption[] {
  const 행: MappedOption[] = [];
  const 넣기 = (label: string, matched: boolean, note?: string) => {
    const v = 고른값(p, label);
    if (v) 행.push({ label, value: v, matched, ...(note ? { note } : {}) });
  };
  넣기("이용 방식", true);
  넣기("맵기", 고름?.맵기 === 고른값(p, "맵기"), 고름?.맵기 === 고른값(p, "맵기") ? undefined : "오늘은 이 조합이 없어요");
  넣기("형태", 고름?.형태 === 고른값(p, "형태"), 고름?.형태 === 고른값(p, "형태") ? undefined : "오늘은 이 조합이 없어요");
  넣기("컵", true);
  넣기("수량", true);
  return 행;
}

/**
 * 프로필 하나로 매핑 응답을 만든다.
 * state 는 시연용 시나리오 스위치가 고르는 '결과 종류'이고,
 * 내용은 전부 실제 프로필에서 나온다.
 */
export function buildMapping(state: MappingState, profile?: ProfileData): MappingResponse {
  const { 남은, 뺀이유 } = 절대조건으로거르기(profile);
  const 순위 = 점수순(남은, profile);
  const 고름 = 순위[0];
  const 이유 = [...반영한이유(profile, 고름), ...뺀이유];

  const item = 고름 && {
    displayName: 고름.name,
    priceText: 원(고름.price),
    imageUrl: KIOSK_MENU_PHOTOS[고름.name],
    options: 확인표(profile, 고름),
  };

  switch (state) {
    case "exact":
      return { result: "exact", reasons: 이유, item };

    case "clarification":
      return {
        result: "clarification",
        reason: `저장하신 '${profile?.menuName || MOCK_MENU_NAME}'과 비슷한 메뉴가 여러 개예요`,
        reasons: 이유,
        // candidateId 는 이번 매핑 응답에서만 쓰는 임시 표식이다.
        // 키오스크 상품 ID 를 앱이 들고 있지 않도록 의도적으로 불투명한 값을 쓴다.
        candidates: 순위.slice(0, 3).map((c, i) => ({
          candidateId: `c${i + 1}`,
          displayName: c.name,
          priceText: 원(c.price),
          imageUrl: KIOSK_MENU_PHOTOS[c.name],
        })),
      };

    case "not_found":
      return {
        result: "not_found",
        message: `저장하신 '${profile?.menuName || MOCK_MENU_NAME}'이 오늘의 메뉴에 없어요. 메뉴가 바뀌었을 수 있어요.`,
      };

    case "changed": {
      // 달라진 점은 지어내지 않는다. 사용자가 고른 값 중 하나를 실제로 못 맞췄다고 표시한다.
      const 컵 = 고른값(profile, "컵");
      const options = 확인표(profile, 고름).map((o) =>
        o.label === "컵" ? { ...o, matched: false, note: "오늘은 제공되지 않아요" } : o,
      );
      return {
        result: "changed",
        diffNote: 컵
          ? `저장하신 주문과 달라진 점이 있어요 — ${컵} 옵션이 빠졌어요. 이대로 진행할까요?`
          : "저장하신 주문과 달라진 점이 있어요. 이대로 진행할까요?",
        reasons: 이유,
        item: item && { ...item, options },
      };
    }

    case "low_confidence":
      return { result: "low_confidence", reasons: 이유, item };
  }
}

// P0-7: 결제 경계. 종료 상태는 장바구니까지이며 결제 관련 필드는 두지 않는다.
export const MOCK_CART: CartResult = {
  itemCountText: "1개",
  totalText: "6,000원",
  evidenceLabel: "화면 인식으로 확인됨",
  handoff: "키오스크 화면에서 장바구니를 확인해 주세요. 결제는 키오스크에서 직접 진행하시면 돼요.",
};
