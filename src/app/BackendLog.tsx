/**
 * 백엔드가 준 것을 그대로 보여 주는 화면.  주소 뒤에 ?log=1
 *
 * 왜 필요한가 — 화면만 봐서는 이 문장이 서버에서 온 것인지, 앱이 지어낸 것인지
 * 구분할 방법이 없다. 목도 그럴듯하게 답한다. 그래서 오간 요청을 본문까지
 * 펼쳐 놓고, **화면의 어느 문장이 어느 응답의 어느 칸에서 왔는지** 짚어 준다.
 *
 * 이 화면은 아무것도 지어내지 않는다. 서버가 준 값만 보여 주고, 없으면 없다고
 * 적는다 — 그걸 확인하려고 만든 화면이 스스로 지어내면 아무 소용이 없다.
 *
 * 계정 경로(auth/*)의 본문은 남기지 않는다. 비밀번호가 실리기 때문이고,
 * 안 남겼다는 사실은 '가림' 으로 표시해서 '비어 있는 것' 과 구분한다.
 */

import { useEffect, useRef, useState } from "react";
import { 연동기록, 팀백엔드모드, type 오간것 } from "@/api/devlog";

// ─── 경로마다 누가 만들었고 무엇을 하는지 ─────────────────────────────────────
//
// 담당은 팀 저장소(watTHEBUG/kioBridge)의 커밋 기록에서 가져왔다. 짐작하지 않는다.
//   git log --format='%an' -- <컨트롤러 파일>

interface 경로설명 {
  경로: string;
  이름: string;
  담당: string;
  컨트롤러: string;
  역할: string;
  화면: string;
}

const 경로표: 경로설명[] = [
  {
    경로: "/internal/simulation/session",
    이름: "세션 생성",
    담당: "ParkSeYoung128",
    컨트롤러: "ExecutionPlanController",
    역할: "QR 로 읽은 키오스크에 세션을 연다. 시뮬레이션 킷(:4000)에 세션을 만들고 sessionId 와 만료 시각을 돌려준다.",
    화면: "QR 을 찍은 뒤 '연결됐어요' 와 남은 시간. 여기서 받은 sessionId 를 승인까지 들고 간다.",
  },
  {
    경로: "/api/v1/profile-normalizations",
    이름: "주문표 정규화",
    담당: "cha-hyunwoo",
    컨트롤러: "ProfileNormalizationController",
    역할: "화면이 모은 값(장소·맵기·형태·컵·수량·알레르기)을 킷 계약의 표준형(CanonicalProfile)으로 바꾼다. 프론트가 직접 만들지 않는 이유는 providerId 같은 값이 서버 설정에 있어서다.",
    화면: "직접 보이지는 않는다. 이 결과가 후보 필터·추천·승인의 재료가 된다.",
  },
  {
    경로: "/api/v1/session-context-normalizations",
    이름: "세션 맥락 정규화",
    담당: "cha-hyunwoo",
    컨트롤러: "SessionContextNormalizationController",
    역할: "이번 주문의 조건을 표준형(ChickenStoreSessionContext)으로 바꾼다. 한글 '포장하기' 가 TAKE_OUT 이 되는 자리다.",
    화면: "직접 보이지는 않는다. reconfirmationFields 가 오면 화면이 되묻는다.",
  },
  {
    경로: "/api/v1/canonical-inputs/validate",
    이름: "통합 검증",
    담당: "cha-hyunwoo",
    컨트롤러: "CanonicalInputValidationController",
    역할: "정규화한 둘을 합쳐 추천을 돌려도 되는 상태인지 본다. recommendationReady 가 false 면 무엇이 모자란지 알려 준다.",
    화면: "false 면 추천으로 넘어가지 않고, 무엇을 더 정해야 하는지 그 자리에서 말한다.",
  },
  {
    경로: "/api/v1/candidate-filters",
    이름: "후보 필터",
    담당: "Gganii",
    컨트롤러: "RecommendationController",
    역할: "오늘 담을 수 있는 후보만 남긴다. 알레르기·품절·이용 불가는 점수를 깎는 게 아니라 후보에서 뺀다. 뺀 것마다 사유가 붙는다.",
    화면: "메뉴 이름과 가격이 여기서 온다. 뺀 사유는 확인 화면의 '이건 뺐어요' 줄이 된다.",
  },
  {
    경로: "/api/v1/recommendations",
    이름: "추천",
    담당: "Gganii",
    컨트롤러: "RecommendationController",
    역할: "남은 후보의 순위를 매긴다. 왜 이걸 골랐는지(recommendationReasons), 무엇을 왜 뺐는지(excludedCandidates), 조건이 맞았는지(matchedOptions), 확신도(confidence)를 함께 준다.",
    화면: "확인 화면 전부 — 고른 메뉴, '이래서 골랐어요' 줄, 조건표의 O/X, 확신도가 낮으면 되묻는 화면.",
  },
  {
    경로: "/internal/orchestrator/approve",
    이름: "승인 (조립·제출·검증·실행)",
    담당: "kjp0411",
    컨트롤러: "OrchestratorController",
    역할: "'승인하고 담기' 한 번으로 실행계획 조립 → 킷 제출 → 계약 검증 → 가상 키오스크 실행까지 한다. 결과로 evidence 와 요약(#48)을 준다. 거절(approved:false)이면 빈 실행계획이라 키오스크를 건드리지 않는다.",
    화면: "마지막 결과 화면 — 담긴 개수·금액, '이래서 골랐어요' 한 줄, 중단됐으면 그 제목과 이유.",
  },
  {
    경로: "/api/v1/auth/signup",
    이름: "회원가입",
    담당: "cha-hyunwoo",
    컨트롤러: "AuthController",
    역할: "직접 지은 아이디와 비밀번호로 계정을 만든다. 실명·전화번호는 받지 않는다.",
    화면: "가입 화면. 로그인은 이 앱에서 끝까지 선택이다.",
  },
  {
    경로: "/api/v1/auth/login",
    이름: "로그인",
    담당: "cha-hyunwoo",
    컨트롤러: "AuthController",
    역할: "아이디·비밀번호를 확인하고 { userId, loginId } 를 준다. 토큰은 아직 없다.",
    화면: "로그인 화면.",
  },
  {
    경로: "/api/v1/users/",
    이름: "주문표 조회·저장",
    담당: "cha-hyunwoo",
    컨트롤러: "UserProfileController",
    역할: "저장해 둔 주문표를 불러오고 올린다. (userId, profileId) 로 덮어쓴다.",
    화면: "로그인하면 저장해 둔 주문표가 목록 앞에 붙는다.",
  },
];

const 설명찾기 = (경로: string) => 경로표.find((x) => 경로.startsWith(x.경로));

// ─── 응답에서 화면으로 가는 값만 뽑아 보여 준다 ───────────────────────────────
//
// 전체 JSON 은 아래에 그대로 있다. 여기는 "이 칸이 화면의 저 문장이 된다" 를
// 짚어 주는 자리다. 없는 것은 없다고 적는다 — 지어내면 이 화면의 쓸모가 없다.

interface 짚기 { 어디: string; 값: string }

function 짚어내기(경로: string, 응답: unknown): 짚기[] {
  const r = 응답 as Record<string, any> | null;
  if (!r || typeof r !== "object") return [];
  const 표: 짚기[] = [];
  const 넣기 = (어디: string, 값: unknown) => {
    if (값 === undefined || 값 === null || 값 === "") return;
    표.push({ 어디, 값: typeof 값 === "string" ? 값 : JSON.stringify(값) });
  };

  if (경로.startsWith("/api/v1/recommendations")) {
    for (const t of r.recommendationReasons ?? []) 넣기("확인 화면 · 이래서 골랐어요", t);
    for (const e of r.excludedCandidates ?? []) 넣기("확인 화면 · 이건 뺐어요", e?.reasonText);
    const 고름 = r.recommendedCandidateId;
    넣기("확신도 (낮으면 되묻는 화면)", r.confidence);
    넣기("서버가 재확인을 요구했나", r.requiresReconfirmation);
    if (고름) 넣기("1순위 후보 (화면에는 c1 로 나감)", 고름);
  }

  if (경로.startsWith("/api/v1/candidate-filters")) {
    for (const c of r.eligibleCandidates ?? []) {
      넣기("메뉴 이름 · 가격", `${c?.name ?? "(이름 없음)"} ${c?.price ?? "?"}원`);
    }
    for (const e of r.excludedCandidates ?? []) 넣기("확인 화면 · 이건 뺐어요", e?.reasonText);
  }

  if (경로.startsWith("/internal/orchestrator/approve")) {
    const raw = r.raw ?? r;
    const e = raw?.evidence;
    넣기("결과 화면 · 한 줄 요약(#48)", r.summary?.recommendation);
    넣기("서버가 매긴 상태(#48)", r.summary?.status);
    넣기("실행 결과", e?.result);
    넣기("실행한 단계 수", e?.executedActions?.length);
    /*
     * stopReason 은 성공했을 때도 온다 — PASS 인데 "VERIFY_CART_VERIFIED" 다.
     * 마지막으로 닿은 상태 이름이지 중단 사유가 아니다. 성공한 줄에 '중단 사유' 라고
     * 적으면 보는 사람이 무언가 잘못된 줄 안다. 끝난 상태로 이름을 바꾸고,
     * 진짜 중단 사유는 실패했을 때만 그렇게 부른다.
     */
    if (e?.result === "PASS") 넣기("마지막으로 닿은 상태", e?.stopReason);
    else 넣기("중단 사유", r.summary?.stopReason ?? e?.stopReason);
    넣기("멈춘 방식", e?.stopType);

    /*
     * 개수는 서버가 따로 주지 않는다. reviewSnapshot 에는 한글 키(메뉴명·총액)와
     * cartItems·total 이 들어 있고 itemCount 는 없다. 예전에는 없는 칸을 읽어
     * "?개" 라고 적었다 — 서버가 준 것만 보여 주겠다는 이 화면의 전제를 스스로
     * 어긴 셈이다. 담긴 것에서 세고, 셀 수 없으면 그 줄을 아예 안 쓴다.
     */
    const cart = e?.reviewSnapshot;
    if (cart) {
      const 개수 = (cart.cartItems ?? []).reduce((n: number, c: any) => n + (Number(c?.quantity) || 0), 0);
      if (개수 > 0) 넣기("장바구니 · 개수", `${개수}개`);
      넣기("장바구니 · 금액", cart["총액"] ?? (typeof cart.total === "number" ? `${cart.total.toLocaleString("ko-KR")}원` : undefined));
      넣기("장바구니 · 담긴 메뉴", cart["메뉴명"] ?? (cart.cartItems ?? [])[0]?.name);
    }
  }

  if (경로.startsWith("/internal/simulation/session")) {
    넣기("이 세션으로 승인까지 간다", r.sessionId);
    넣기("연결 만료 시각", r.expiresAt);
    넣기("키오스크 이름", r.kioskName);
  }

  if (경로.startsWith("/api/v1/canonical-inputs/validate")) {
    넣기("추천을 돌려도 되나", r.recommendationReady);
    넣기("상태", r.status);
  }

  return 표;
}

// ─── 화면 ─────────────────────────────────────────────────────────────────────

const 색 = {
  바탕: "#0b0b0c", 글: "#e8e8ea", 흐림: "#9a9aa2",
  선: "#232326", 면: "#141416",
  좋음: "#37d67a", 나쁨: "#ff6b6b", 짚음: "#7cc4ff",
};

const 예쁘게 = (s: string | undefined) => {
  if (!s) return "";
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
};

function 한줄({ x, 방금 = false }: { x: 오간것; 방금?: boolean }) {
  const [펼침, 펼치기] = useState(false);
  const 설명 = 설명찾기(x.경로);
  const 성공 = typeof x.상태 === "number" && x.상태 < 400;
  /*
   * 방금 들어온 줄에 잠깐 표를 남긴다.
   *
   * 나란히 놓고 보면 누를 때마다 목록이 위로 자라는데, 줄이 다 비슷하게 생겨서
   * 무엇이 새로 온 것인지 눈으로 잡기 어렵다. 2초 뒤 스스로 사라진다 —
   * 계속 남겨 두면 다음에 새로 온 것과 구분이 안 된다.
   */
  const [새것, 새것으로] = useState(방금);
  useEffect(() => {
    // 방금 이 참에서 거짓으로 바뀌면 앞 이펙트의 정리 함수가 타이머를 이미 껐다.
    // 그때 그냥 반환하면 새것 이 참으로 남아 밝은 채로 굳는다 — 2초 안에 다음
    // 요청이 나가면 앞 줄이 계속 밝아서, 무엇이 새로 온 것인지 구분이 안 된다.
    if (!방금) { 새것으로(false); return; }
    새것으로(true);
    const t = setTimeout(() => 새것으로(false), 2000);
    return () => clearTimeout(t);
  }, [방금, x.시각]);
  const 짚은것 = 펼침 && x.응답 ? (() => {
    try { return 짚어내기(x.경로, JSON.parse(x.응답)); } catch { return []; }
  })() : [];

  return (
    <div style={{
      borderTop: `1px solid ${색.선}`,
      background: 새것 ? "rgba(124,196,255,.10)" : undefined,
      transition: "background 400ms",
    }}>
      <button
        type="button"
        onClick={() => 펼치기((v) => !v)}
        aria-expanded={펼침}
        style={{
          display: "flex", gap: 10, alignItems: "baseline", width: "100%", textAlign: "left",
          background: "none", border: "none", color: "inherit", font: "inherit",
          padding: "8px 0", cursor: "pointer",
          minHeight: 44,
        }}
      >
        <span style={{ color: 성공 ? 색.좋음 : 색.나쁨, width: 34, flexShrink: 0 }}>{String(x.상태)}</span>
        <span style={{ color: 색.흐림, width: 34, flexShrink: 0 }}>{x.방법}</span>
        <span style={{ flex: 1, wordBreak: "break-all" }}>
          {x.경로}
          {설명 && <span style={{ color: 색.흐림 }}> — {설명.이름}</span>}
        </span>
        <span style={{ color: 색.흐림, flexShrink: 0 }}>{x.걸린시간}ms {펼침 ? "▾" : "▸"}</span>
      </button>

      {펼침 && (
        <div style={{ padding: "0 0 12px" }}>
          {설명 && (
            <div style={{ background: 색.면, borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ color: 색.흐림, marginBottom: 4 }}>
                담당 <strong style={{ color: 색.글 }}>{설명.담당}</strong> · {설명.컨트롤러}
              </div>
              <div style={{ marginBottom: 6 }}>{설명.역할}</div>
              <div style={{ color: 색.짚음 }}>화면에서 — {설명.화면}</div>
            </div>
          )}

          {짚은것.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: 색.흐림, marginBottom: 4 }}>이 응답이 화면에서 이렇게 쓰입니다</div>
              {짚은것.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
                  <span style={{ color: 색.짚음, minWidth: 200, flexShrink: 0 }}>{t.어디}</span>
                  <span style={{ wordBreak: "break-all" }}>{t.값}</span>
                </div>
              ))}
            </div>
          )}

          {x.가림 ? (
            <div style={{ color: 색.흐림 }}>
              이 경로의 본문은 일부러 남기지 않습니다 — 비밀번호가 실립니다.
              (비어 있는 게 아니라 안 남긴 것입니다)
            </div>
          ) : (
            <>
              <div style={{ color: 색.흐림, marginBottom: 4 }}>보낸 것</div>
              <pre style={{ background: 색.면, borderRadius: 8, padding: 10, margin: "0 0 10px", overflowX: "auto", maxHeight: 260 }}>
                {예쁘게(x.요청) || "(본문 없음 — GET)"}
              </pre>
              <div style={{ color: 색.흐림, marginBottom: 4 }}>받은 것</div>
              <pre style={{ background: 색.면, borderRadius: 8, padding: 10, margin: 0, overflowX: "auto", maxHeight: 360 }}>
                {예쁘게(x.응답) || "(본문 없음)"}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param onClose 있으면 '앱으로 돌아가기' 를 보여 준다.
 *
 * 이 화면은 앱을 덮는 겹으로 뜬다. 다른 주소로 옮겨 가면 페이지가 새로 뜨고,
 * 기록은 메모리에만 있어서 그때 전부 사라진다 — 주문을 마치고 보러 가면 늘
 * 0건이 된다. 확인하려고 만든 화면이 확인할 것을 지우면 안 된다.
 *
 * localStorage 에 담지 않는다. 이 앱은 저장을 안 한다고 화면에서 약속했고,
 * 그 약속을 확인하려고 만든 화면이 먼저 어기면 앞뒤가 안 맞는다.
 */
export default function BackendLog({ onClose, 나란히 = false }: { onClose?: () => void; 나란히?: boolean }) {
  const [, 다시그리기] = useState(0);
  // 나란히 볼 때는 오간 것이 주인공이라 설명표를 접어 둔다. 겹으로 볼 때는 펼친다.
  const [설명펼침, 설명펼치기] = useState(!나란히);
  useEffect(() => 연동기록.구독(() => 다시그리기((n) => n + 1)), []);

  /*
   * 겹 모드는 앱 전체를 덮는다. 그런데 Esc 도 안 먹고 포커스도 안 옮기면,
   * 키보드만 쓰는 사람은 덮인 화면 뒤쪽 버튼들로 Tab 이 돌아다니게 된다.
   * 자기가 어디에 있는지도, 어떻게 닫는지도 알 수 없다.
   *
   * 나란히 모드는 덮지 않으므로 그대로 둔다 — 앱을 쓰면서 보라고 만든 것이라
   * 포커스를 뺏으면 오히려 방해가 된다.
   */
  const 뿌리 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (나란히 || !onClose) return;
    /*
     * aria-modal 은 포커스를 가두지 않는다. 그 속성은 스크린리더에게 "뒤쪽은
     * 없는 셈 쳐라" 고 말할 뿐이고, Tab 은 그대로 뒤쪽 앱 버튼으로 넘어간다.
     * 화면은 덮여 있는데 포커스만 보이지 않는 곳으로 가 버리므로, 키보드만
     * 쓰는 사람은 자기가 어디에 있는지 알 수 없다.
     *
     * 그래서 Tab 을 직접 잡아 이 겹 안에서만 돌게 한다. 닫을 때는 열기 전에
     * 있던 자리로 포커스를 돌려준다 - 안 그러면 닫고 나서 문서 처음부터
     * 다시 Tab 을 눌러야 한다.
     */
    const 열기전 = document.activeElement as HTMLElement | null;
    뿌리.current?.focus({ preventScroll: true });

    const 잡을것 = () => {
      const 안 = 뿌리.current;
      if (!안) return [] as HTMLElement[];
      return [...안.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
        .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
    };

    const 키 = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const 것들 = 잡을것();
      if (것들.length === 0) { e.preventDefault(); 뿌리.current?.focus(); return; }
      const 처음 = 것들[0];
      const 마지막 = 것들[것들.length - 1];
      const 지금 = document.activeElement;
      // 겹 밖에 있으면 무조건 안으로 데려온다.
      if (!뿌리.current?.contains(지금)) { e.preventDefault(); 처음.focus(); return; }
      if (e.shiftKey && 지금 === 처음) { e.preventDefault(); 마지막.focus(); }
      else if (!e.shiftKey && 지금 === 마지막) { e.preventDefault(); 처음.focus(); }
    };

    window.addEventListener("keydown", 키);
    return () => {
      window.removeEventListener("keydown", 키);
      열기전?.focus?.({ preventScroll: true });
    };
  }, [나란히, onClose]);
  const 목록 = 연동기록.읽기();
  const 성공 = 목록.filter((x) => typeof x.상태 === "number" && x.상태 < 400).length;
  // 방금 들어온 줄을 잠깐 밝게 둔다. 눌렀을 때 무언가 나갔다는 걸 눈으로 잡으라고.
  const 최신 = 목록[0]?.시각;

  return (
    <div
      ref={뿌리}
      {...(나란히 ? {} : { tabIndex: -1, role: "dialog" as const, "aria-modal": true, "aria-label": "백엔드에서 온 것" })}
      style={나란히 ? {
      // 앱 옆에 세워 둔다. 겹치지 않으므로 앱을 쓰면서 그대로 볼 수 있다.
      width: "min(460px, 40vw)", alignSelf: "stretch", maxHeight: "calc(100vh - 48px)",
      overflowY: "auto", borderRadius: 12,
      background: 색.바탕, color: 색.글,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12, lineHeight: 1.6, padding: "16px 14px 28px",
      boxShadow: "0 8px 28px rgba(0,0,0,.35)",
    } : {
      position: "fixed", inset: 0, zIndex: 90, overflowY: "auto",
      background: 색.바탕, color: 색.글,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 13, lineHeight: 1.6, padding: "24px 20px 60px",
    }}>
      <div style={{ maxWidth: 나란히 ? undefined : 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 나란히 ? 15 : 20, margin: 0 }}>백엔드에서 온 것</h1>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                marginLeft: "auto", background: "none", border: `1px solid ${색.선}`,
                borderRadius: 6, color: 색.글, font: "inherit", padding: "4px 12px", cursor: "pointer",
                minHeight: 44, minWidth: 44,
              }}
            >
              {나란히 ? "닫기" : "앱으로 돌아가기"}
            </button>
          )}
        </div>
        <p style={{ color: 색.흐림, margin: `0 0 ${나란히 ? 12 : 20}px` }}>
          {나란히
            ? "앱을 누를 때마다 여기에 한 줄씩 쌓입니다. 줄을 누르면 보낸 것·받은 것이 그대로 펼쳐집니다."
            : "화면의 문장이 서버에서 온 것인지 확인하는 자리입니다. 아무것도 지어내지 않고, 오간 요청과 응답을 그대로 보여 줍니다."}
        </p>

        <div style={{
          display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
          background: 색.면, borderRadius: 8, padding: "10px 12px", marginBottom: 20,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: 팀백엔드모드 ? 색.좋음 : 색.흐림,
          }} />
          <strong>{팀백엔드모드 ? "실서버 모드" : "목 모드"}</strong>
          <span style={{ color: 색.흐림 }}>
            {팀백엔드모드
              ? "/api/bff → KIOBRIDGE_API_BASE 로 나갑니다"
              : "목(src/api/mock.ts)으로 돕니다 — 서버로 나가는 요청이 없습니다"}
          </span>
          <span style={{ marginLeft: "auto", color: 색.흐림 }}>{성공}/{목록.length} 성공</span>
          {목록.length > 0 && (
            <button
              type="button"
              onClick={() => 연동기록.비우기()}
              style={{
                background: "none", border: `1px solid ${색.선}`, borderRadius: 6,
                color: 색.흐림, font: "inherit", padding: "2px 10px", cursor: "pointer",
                minHeight: 44, minWidth: 44,
              }}
            >
              비우기
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => 설명펼치기((v) => !v)}
          aria-expanded={설명펼침}
          style={{
            display: "block", width: "100%", textAlign: "left", background: "none",
            border: "none", color: "inherit", font: "inherit", padding: 0, cursor: "pointer",
            fontSize: 15, fontWeight: 700, margin: "0 0 8px",
            minHeight: 44,
          }}
        >
          어느 API 가 무엇을 하는지 {설명펼침 ? "▾" : "▸"}
        </button>
        {설명펼침 && (
        <>
        <p style={{ color: 색.흐림, margin: "0 0 10px" }}>
          담당은 팀 저장소의 커밋 기록에서 가져왔습니다(<code>git log -- 컨트롤러 파일</code>).
        </p>
        <div style={{ marginBottom: 28 }}>
          {경로표.map((x) => (
            <div key={x.경로} style={{ borderTop: `1px solid ${색.선}`, padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <strong>{x.이름}</strong>
                <span style={{ color: 색.흐림, wordBreak: "break-all" }}>{x.경로}</span>
                <span style={{ marginLeft: "auto", color: 색.짚음 }}>{x.담당}</span>
              </div>
              <div style={{ color: 색.흐림, fontSize: 12 }}>{x.컨트롤러}</div>
              <div style={{ marginTop: 4 }}>{x.역할}</div>
              <div style={{ marginTop: 4, color: 색.짚음 }}>화면에서 — {x.화면}</div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${색.선}`, padding: "10px 0" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
              <strong>화면 · BFF</strong>
              <span style={{ color: 색.흐림 }}>/api/bff</span>
              <span style={{ marginLeft: "auto", color: 색.짚음 }}>Yena07</span>
            </div>
            <div style={{ color: 색.흐림, fontSize: 12 }}>api/bff.ts</div>
            <div style={{ marginTop: 4 }}>
              브라우저가 백엔드를 직접 부르지 않고 이 서버 함수를 거칩니다. 그래서 같은 출처로만
              요청하게 되어 CORS 가 없고, 백엔드 주소가 번들에 박히지 않습니다. 허용한 경로만
              통과시키고 클라이언트 헤더(origin·referer·cookie)는 떼고 보냅니다.
            </div>
          </div>
        </div>
        </>
        )}

        <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>오간 것 {목록.length}건</h2>
        {목록.length === 0 ? (
          <p style={{ color: 색.흐림 }}>
            {팀백엔드모드
              ? "아직 오간 게 없습니다. 앱에서 QR 을 찍고 메뉴를 골라 보세요."
              : "목 모드라 서버로 나가는 요청이 없습니다. npm run dev:team 으로 띄우거나 배포본(build:team)에서 보세요."}
          </p>
        ) : (
          <>
            {!나란히 && (
              <p style={{ color: 색.흐림, margin: "0 0 4px" }}>
                줄을 누르면 담당·역할과 함께 보낸 것·받은 것이 그대로 펼쳐집니다.
              </p>
            )}
            {/*
              key 에 순번을 넣는다. Date.now() 는 밀리초라 같은 밀리초에 같은 경로로
              두 번 나가면 key 가 겹치고, React 가 두 줄을 같은 것으로 보아 상태를
              엉뚱하게 물려준다. 목록은 새것이 앞에 붙는 구조라 순번도 밀리지만,
              겹치는 것보다는 낫다.
            */}
            {목록.map((x, i) => <한줄 key={`${x.시각}-${x.경로}-${i}`} x={x} 방금={x.시각 === 최신} />)}
          </>
        )}
      </div>
    </div>
  );
}
