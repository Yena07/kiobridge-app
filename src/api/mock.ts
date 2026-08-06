import type { CartResult, MappedOption, MappingResponse, MappingState, PlaceType, ProfileData, RecommendationReason } from "@/domain/types";

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
  음료?: string;
  온도?: string;
  알레르기?: string[];
  품절?: boolean;
}

// 장소마다 키오스크가 다르다. 한 카탈로그만 두면 아이스 아메리카노를 저장한
// 사람이 '간장 순살 닭강정' 을 승인하라는 화면을 받는다. 실제로 그랬다.
//
// chicken-store 는 공식 fixture(CHICKEN-001~008)와 같은 값이다.
// 카페는 대응하는 공식 fixture 가 없다. 백엔드의 input-options 가 카페를
// 다루게 되면 이 블록은 그 응답으로 교체된다. 그때까지 화면을 보여 주기 위한
// 시연용 값이며, 제출물에는 들어가지 않는다.
const 카페후보: 후보[] = [
  { name: "아이스 아메리카노", price: 4500, 음료: "아메리카노", 온도: "ICE" },
  { name: "따뜻한 아메리카노", price: 4500, 음료: "아메리카노", 온도: "HOT" },
  { name: "아이스 카페라떼", price: 5000, 음료: "카페라떼", 온도: "ICE" },
  { name: "따뜻한 카페라떼", price: 5000, 음료: "카페라떼", 온도: "HOT" },
  { name: "콜드브루", price: 5500, 음료: "콜드브루", 온도: "ICE" },
  { name: "품절 바닐라라떼", price: 5500, 음료: "바닐라라떼", 품절: true },
];

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

// 이유 문장은 사용자에게 그대로 읽히는 글이다. "뼈을 고르셨는데" 처럼 조사가 틀리면
// 기계가 찍어 낸 티가 나고, 사용자의 말로 설명한다는 이 화면의 전제가 무너진다.
// 마지막 글자에 받침이 있으면 앞의 조사를, 없으면 뒤의 조사를 쓴다.
// 한글이 아닌 값(Tall, ICE 같은 카페 선택지)은 받침을 판별할 방법이 없어서
// 받침 없는 쪽으로 둔다. 지금 이 함수를 타는 값은 전부 한글이라 문제가 없지만,
// 다른 환경을 붙일 때는 이 한계를 알고 써야 한다.
const 조사 = (w: string, 받침있음: string, 받침없음: string) => {
  if (!w) return 받침없음;   // 빈 값이면 조사를 붙일 대상이 없다
  const c = w.charCodeAt(w.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return 받침없음;
  return (c - 0xac00) % 28 === 0 ? 받침없음 : 받침있음;
};
const 을를 = (w: string) => w + 조사(w, "을", "를");
const 은는 = (w: string) => w + 조사(w, "은", "는");
const 이가 = (w: string) => w + 조사(w, "이", "가");
const 고른값 = (p: ProfileData | undefined, 축: string) => p?.selections?.[축]?.[0];
const 고른값들 = (p: ProfileData | undefined, 축: string) => p?.selections?.[축] ?? [];

const 알레르기축 = "알레르기 (꼭 빼주세요)";

/**
 * 이 프로필이 보는 키오스크의 오늘 메뉴.
 *
 * 목록이 없는 장소는 빈 배열을 준다. 지어내지 않는다.
 * 병원에서 '매운 순살 닭강정' 을 승인하라는 화면이 뜨는 것보다
 * "이 키오스크는 아직 지원하지 않아요" 가 낫다.
 * 병원·관공서는 백엔드가 fixture 를 내려 주면 그때 채운다.
 *
 * 장소를 안 고른 프로필도 빈 배열이다. 예전에는 닭강정집으로 떨어뜨렸는데,
 * 그러면 장소를 안 고른 사람에게 닭강정을 승인하라고 하게 된다.
 * 방금 병원·관공서에서 막은 그 경로가 여기로 남아 있었다.
 *
 * 연동 메모: 실제로는 프로필이 아니라 QR 로 연결한 키오스크(environmentId)가
 * 카탈로그를 정한다. 목은 붙일 서버가 없어서 프로필의 place 로 대신 고른다.
 * 이 역전은 docs/BACKEND_INTEGRATION.md 에 적어 두었다.
 */
const 장소별카탈로그: Partial<Record<NonNullable<PlaceType>, 후보[]>> = {
  음식점: 오늘의후보,
  카페: 카페후보,
};
const 카탈로그 = (p: ProfileData | undefined) => (p?.place ? (장소별카탈로그[p.place] ?? []) : []);

/**
 * 절대 조건으로 후보를 거른다. 점수를 깎는 게 아니라 목록에서 아예 뺀다.
 * 알레르기·품절·이용 불가가 여기 해당한다.
 */
function 절대조건으로거르기(p: ProfileData | undefined) {
  const 알레르기 = 고른값들(p, 알레르기축);
  const 이용방식 = 고른값(p, "이용 방식");
  const 남은: 후보[] = [];
  const 뺀이유: RecommendationReason[] = [];

  for (const c of 카탈로그(p)) {
    if (c.품절) {
      뺀이유.push({ kind: "excluded", text: `${은는(c.name)} 지금 팔지 않아서 뺐어요` });
      continue;
    }
    const 걸린알레르기 = (c.알레르기 ?? []).filter((a) => 알레르기.includes(a));
    if (걸린알레르기.length > 0) {
      뺀이유.push({
        kind: "excluded",
        text: `${걸린알레르기.join("·")} 알레르기를 알려주셔서 ${은는(c.name)} 뺐어요`,
      });
      continue;
    }
    // 전용 메뉴는 그 이용 방식이 아니면 담을 수 없다.
    // 사용자가 이용 방식을 안 골랐으면 담을 수 있다고 장담할 수 없으므로 이때도 뺀다.
    // 남겨 두면 아무 조건도 안 맞는 전용 메뉴가 1순위로 올라올 수 있다.
    if (c.이용방식 && c.이용방식 !== 이용방식) {
      뺀이유.push({
        kind: "excluded",
        text: 이용방식
          ? `${은는(c.name)} ${c.이용방식}만 돼서 뺐어요`
          : `${은는(c.name)} ${c.이용방식}일 때만 돼서, 이용 방식을 아직 안 정하셔서 뺐어요`,
      });
      continue;
    }
    남은.push(c);
  }
  return { 남은, 뺀이유 };
}

/**
 * 프로필의 질문과 후보가 들고 있는 값을 잇는 표.
 * 순위·불일치 판정·확인 카드가 전부 이것 하나를 본다.
 * 축을 늘릴 때 세 군데를 따로 고치면 언젠가 한 곳이 빠지고, 그때 화면이 거짓말한다.
 *
 * 무게는 순위를 가를 때만 쓴다 — 무엇을 마시느냐가 뜨거우냐 차가우냐보다 앞선다.
 */
const 비교축: { label: string; 값: (c: 후보) => string | undefined; 무게: number; 어긋날때: string }[] = [
  { label: "맵기", 값: (c) => c.맵기, 무게: 2, 어긋날때: "오늘은 이 조합이 없어요" },
  { label: "형태", 값: (c) => c.형태, 무게: 1, 어긋날때: "오늘은 이 조합이 없어요" },
  { label: "음료", 값: (c) => c.음료, 무게: 2, 어긋날때: "오늘은 이 메뉴가 없어요" },
  { label: "온도", 값: (c) => c.온도, 무게: 1, 어긋날때: "오늘은 이 온도가 없어요" },
];

/**
 * 이 후보를 고르면 어긋나는 축.
 *
 * 후보가 실제로 들고 있는 값을 본다. 이름 문자열로 짐작하지 않는다 —
 * '아이스 아메리카노' 는 온도가 ICE 인데 이름 어디에도 'ICE' 가 없어서,
 * 이름으로 판단하면 정확히 맞는 후보를 "고르신 메뉴와 달라요" 라고 말하게 된다.
 *
 * 고르지 않은 축은 넣지 않는다. 안 고른 것은 어긋날 수도 없다.
 */
function 안맞는축(c: 후보, p: ProfileData | undefined): string[] {
  return 비교축
    .filter(({ label, 값 }) => {
      const 고른 = 고른값(p, label);
      return Boolean(고른) && 값(c) !== 고른;
    })
    .map(({ label }) => label);
}

/** 남은 후보를 사용자가 고른 축과 얼마나 맞는지로 정렬한다. */
function 점수순(남은: 후보[], p: ProfileData | undefined) {
  // 사용자가 고르지 않은 축은 점수에 넣지 않는다. 안 고른 것을 맞혔다고
  // 계산하면 아무 조건도 안 맞는 후보가 1순위가 될 수 있다.
  const 점수 = (c: 후보) =>
    비교축.reduce((합, { label, 값, 무게 }) => {
      const 고른 = 고른값(p, label);
      return 합 + (고른 && 값(c) === 고른 ? 무게 : 0);
    }, 0);
  return [...남은].sort((a, b) => 점수(b) - 점수(a));
}

/** 무엇을 써서 골랐는지 사용자의 말로 적는다. 고른 적 없는 축은 말하지 않는다. */
function 반영한이유(p: ProfileData | undefined, 고름: 후보 | undefined): RecommendationReason[] {
  const out: RecommendationReason[] = [];
  const 이용방식 = 고른값(p, "이용 방식");
  const 맵기 = 고른값(p, "맵기");
  const 형태 = 고른값(p, "형태");

  if (이용방식) out.push({ kind: "used", text: `${을를(이용방식)} 고르셔서 ${이가(이용방식)} 되는 메뉴만 남겼어요` });
  if (맵기) {
    out.push(고름?.맵기 === 맵기
      ? { kind: "used", text: `맵기를 ${맵기}으로 저장해 두셔서 ${맵기} 메뉴로 맞췄어요` }
      : { kind: "used", text: `맵기를 ${맵기}으로 저장해 두셨는데 오늘은 그 조합이 없어서 가장 가까운 걸로 골랐어요` });
  }
  if (형태) {
    out.push(고름?.형태 === 형태
      ? { kind: "used", text: `${을를(형태)} 고르셔서 ${형태} 메뉴로 맞췄어요` }
      : { kind: "used", text: `${을를(형태)} 고르셨는데 오늘은 그 조합이 없어서 가장 가까운 걸로 골랐어요` });
  }
  return out;
}

/**
 * 확인 카드에 그대로 올라가는 표. 사용자가 고른 값만 넣는다.
 *
 * 고름 이 undefined 면 '아직 어느 후보인지 정해지지 않았다' 는 뜻이라
 * 어긋남을 판단하지 않고 저장한 값만 보여 준다. clarification 이 그 경우다.
 */
function 확인표(p: ProfileData | undefined, 고름: 후보 | undefined): MappedOption[] {
  const 행: MappedOption[] = [];
  const 어긋남 = new Set(고름 ? 안맞는축(고름, p) : []);
  const 문구 = new Map(비교축.map(({ label, 어긋날때 }) => [label, 어긋날때]));
  // 다중 선택 축(시럽 등)은 첫 값만 보여 주면 나머지가 조용히 사라진다.
  // 확인 화면이 사용자가 고른 것보다 적게 말하는 것도 거짓말이다.
  const 넣기 = (label: string) => {
    const vs = 고른값들(p, label);
    if (vs.length === 0) return;
    const matched = !어긋남.has(label);
    행.push({ label, value: vs.join(", "), matched, ...(matched ? {} : { note: 문구.get(label) }) });
  };
  // 사용자가 고른 축만 넣는다. 장소마다 축이 다르므로 없는 항목은 자동으로 빠진다.
  넣기("이용 방식");
  // 닭강정집
  넣기("맵기");
  넣기("형태");
  넣기("컵");
  // 카페
  넣기("음료");
  넣기("온도");
  넣기("사이즈");
  넣기("샷 추가");
  넣기("시럽");
  넣기("우유 변경");
  넣기("수량");
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

  // 절대 조건에 다 걸려서 담을 수 있는 게 하나도 안 남을 수 있다.
  // 그때 item 없이 exact/changed/low_confidence 를 돌려주면 화면이 item 을 있다고 믿고
  // 그리다가 터진다. 담을 게 없다는 건 그 자체로 not_found 이므로 그렇게 답한다.
  if (!고름 && state !== "not_found") {
    // 세 경우를 구분한다. 사용자가 다음에 할 일이 서로 다르기 때문이다.
    //   장소를 안 골랐다     → 프로필에 장소를 정하면 된다 (사용자가 고칠 수 있다)
    //   그 장소를 모른다     → 직원에게 도움을 청한다 (사용자가 고칠 수 없다)
    //   조건에 걸려 다 빠졌다 → 조건을 손보면 된다
    const 장소미정 = !profile?.place;
    const 목록없음 = 카탈로그(profile).length === 0;
    return {
      result: "not_found",
      message: 장소미정
        ? "어디에서 쓰실 건지 프로필에 정해 두시면 오늘의 메뉴에서 찾아드릴 수 있어요."
        : 목록없음
        ? "이 종류의 키오스크는 아직 도와드리지 못해요. 직원에게 이 화면을 보여 주세요."
        : "조건에 맞는 메뉴가 오늘은 없어요. 알레르기나 이용 방식 때문에 모두 빠졌어요.",
      reasons: 목록없음 ? [] : 이유,
    };
  }

  switch (state) {
    case "exact":
      return { result: "exact", reasons: 이유, item };

    case "clarification":
      return {
        result: "clarification",
        // 후보 이름·가격만 보내면 사용자는 포장인지 종이컵인지 몇 개인지
        // 한 번도 못 보고 승인을 누르게 된다. 저장해 둔 조건을 함께 보낸다.
        //
        // 여기서는 '맞았는지' 를 판단하지 않는다. 어느 후보를 고르느냐에 따라
        // 답이 달라지기 때문이다. 1순위 기준으로 계산해 두면 c2(뼈)를 고른
        // 사용자에게 "형태: 순살, 그대로예요" 라고 말하게 된다.
        // 고름 을 넘기지 않으면 확인표가 판단을 미룬다.
        profileOptions: 확인표(profile, undefined),
        reason: `저장하신 '${profile?.menuName || MOCK_MENU_NAME}'과 비슷한 메뉴가 여러 개예요`,
        reasons: 이유,
        // candidateId 는 이번 매핑 응답에서만 쓰는 임시 표식이다.
        // 키오스크 상품 ID 를 앱이 들고 있지 않도록 의도적으로 불투명한 값을 쓴다.
        candidates: 순위.slice(0, 3).map((c, i) => ({
          candidateId: `c${i + 1}`,
          displayName: c.name,
          priceText: 원(c.price),
          imageUrl: KIOSK_MENU_PHOTOS[c.name],
          // 이 후보를 고르면 어떤 조건이 어긋나는지 응답이 알려 준다.
          // 화면이 이름을 뜯어보고 짐작하지 않아도 되게.
          unmatchedLabels: 안맞는축(c, profile),
        })),
      };

    case "not_found":
      return {
        result: "not_found",
        message: `저장하신 '${profile?.menuName || MOCK_MENU_NAME}'이 오늘의 메뉴에 없어요. 메뉴가 바뀌었을 수 있어요.`,
      };

    case "changed": {
      // 달라진 점은 지어내지 않는다. 사용자가 고른 값 중 하나를 실제로 못 맞췄다고 표시한다.
      // '컵'을 고정으로 짚으면 컵을 안 고른 프로필에서는 달라진 행이 하나도 안 생긴다.
      // 그러면 화면은 "달라진 내용을 확인했어요" 체크를 요구하면서 무엇이 달라졌는지
      // 한 줄도 못 보여 준다. 컵이 있으면 컵을, 없으면 첫 번째 행을 짚는다.
      const 표 = 확인표(profile, 고름);
      const 짚을행 = 표.find((o) => o.label === "컵") ?? 표[0];
      const options = 표.map((o) =>
        o === 짚을행 ? { ...o, matched: false, note: "오늘은 제공되지 않아요" } : o,
      );
      return {
        result: "changed",
        diffNote: 짚을행
          ? `저장하신 주문과 달라진 점이 있어요 — ${짚을행.value} 옵션이 빠졌어요. 이대로 진행할까요?`
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
/**
 * 사용자가 실제로 승인한 것으로 장바구니 결과를 만든다.
 * 고정값을 쓰면 확인 화면에서 6,500원을 보고 승인했는데 결과 화면은
 * 6,000원이라고 말하게 된다. 대신 눌러 주는 앱에서 그 불일치는
 * 승인이라는 절차 자체를 무의미하게 만든다.
 */
export function buildCart(승인한: { displayName: string; priceText: string; 수량?: string }): CartResult {
  const 개수 = Number((승인한.수량 ?? "1개").replace(/[^0-9]/g, "")) || 1;
  const 단가 = Number(승인한.priceText.replace(/[^0-9]/g, "")) || 0;
  return {
    itemCountText: `${개수}개`,
    totalText: 원(단가 * 개수),
    evidenceLabel: "화면 인식으로 확인됨",
    handoff: "키오스크 화면에서 장바구니를 확인해 주세요. 결제는 키오스크에서 직접 진행하시면 돼요.",
  };
}

// P0-7 검사용 기준값. 실제 결과는 buildCart 가 만든다.
export const MOCK_CART: CartResult = {
  itemCountText: "1개",
  totalText: "6,000원",
  evidenceLabel: "화면 인식으로 확인됨",
  handoff: "키오스크 화면에서 장바구니를 확인해 주세요. 결제는 키오스크에서 직접 진행하시면 돼요.",
};
