import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Check } from "lucide-react";

import { Pictogram } from "@/design/Pictogram";
import kioskHeroImg from "@/assets/images/kiosk-hero.jpg";
import {
  P, TEXT_1, TEXT_2, TEXT_3, BORDER, SURFACE, CANVAS, BACKDROP,
  SUCCESS, WARN, WARN_BG, FAIL, FAIL_BG, TEXT_BTN, TEXT_CHIP,
  FONT, SERIF, TYPE, NUM, GAP, RADIUS, FOCUS_STYLES, PALETTE_STYLES, PAPER, RULE, KICKER, BTN_H, TOGGLE_OFF, ON_DARK,
} from "@/design/tokens";
import type {
  Screen, MainTab, PlaceType, PairingState, StepStatus, OrderSheet, PairingResult,
  MappingResponse, MappedItem, MappedOption, MappingCandidate, ApproveInput, RecommendationReason,
  PlanStatus, CartResult, AbortInfo,
} from "@/domain/types";
import { DETAIL_OPTIONS, PLACE_LIST, PLACE_ICONS, STEPS } from "@/domain/catalog";
import { api, POLL_MS, KioBridgeError, getScenario, setScenario, registerSheet, unregisterSheet, type Scenario } from "@/api/client";
import {
  account, 아이디검사, 비밀번호검사, 못올리는이유, 개인정보같은메모,
  LOGIN_ID_MAX, PASSWORD_MIN, MENU_NAME_MAX, MEMO_MAX, type Account,
} from "@/api/account";
import { 연동기록, 팀백엔드모드 } from "@/api/devlog";
import { 접근성설정, 언어목록, type 도움설정, type 언어코드 } from "@/api/a11y";
import { 소리를낼수있나, 읽어주기, 그만읽기 } from "@/api/speech";
import { 가격한도, 한도후보 } from "@/api/budget";
import { 알레르기설정, 알레르기목록 } from "@/api/allergy";
import type { AllergenId } from "@/api/canonical";
import { 이어쓰기 } from "@/api/session";
import { 백엔드가아는장소 } from "@/api/canonical";
import BackendLog from "@/app/BackendLog";

// 휴대폰 틀 크기. 큰 글씨 모드가 이 값을 기준으로 안쪽 크기를 되계산한다.
const FRAME_W = 390;
const FRAME_H = 844;
const LARGE_TEXT_SCALE = 1.18;

// ─── Primitives ───────────────────────────────────────────────────────────────

// 워드마크는 세리프로. 정체(kio)와 이탤릭(bridge)을 섞어 에디토리얼 인상을 만든다.
function AppLogo({ light = false, size = 34 }: { light?: boolean; size?: number }) {
  // light 는 사진.카메라처럼 늘 어두운 판 위에 얹을 때 쓴다. 팔레트를 따라가면
  // 다크에서 검은 판에 검은 글자가 된다. 여기는 뒤집지 않는다.
  const color = light ? ON_DARK : TEXT_1;
  return (
    <div
      aria-label="키오브릿지"
      style={{
        fontFamily: SERIF, fontSize: size, lineHeight: 1, color,
        letterSpacing: "-0.02em", display: "inline-flex", alignItems: "baseline",
        ...(light ? { textShadow: "0 2px 12px rgba(0,0,0,0.5)" } : {}),
      }}
    >
      <span>kio</span>
      <span style={{ fontStyle: "italic" }}>bridge</span>
    </div>
  );
}

// 레퍼런스에는 진행 막대가 없다. 점 형태로 최소화해 상단 여백을 비워 둔다.
//
// 전체 3단계다 — 회원가입 → 호칭 → 도움 설정. 그다음의 '환영합니다' 는 세지 않는다.
// 읽고 넘어가는 화면이지 채울 것이 없어서, 단계로 세면 아직 할 일이 남은 것처럼 보인다.
//
// 예전에는 두 단계였다(가입 · 호칭). 도움 설정을 계정 화면에서 이 흐름으로 끌어오면서
// 하나 늘었다. 기본값만 고치고 넘어가면 화면마다 "3단계 중 2단계" 처럼 실제와 어긋난
// 값이 남으므로 부르는 쪽에서 전부 명시한다.
function ProgressBar({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className="flex justify-center gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total} aria-label={`전체 ${total}단계 중 ${step}단계`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{ width: i < step ? 16 : 5, height: 5, borderRadius: 100, backgroundColor: i < step ? RULE : BORDER, transition: "all 0.4s" }}
        />
      ))}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="뒤로 가기"
      onClick={onClick}
      className="flex items-center justify-center"
      style={{ width: 44, height: 44, marginLeft: -10, backgroundColor: "transparent", cursor: "pointer", border: "none" }}
    >
      <span
        aria-hidden="true"
        style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: SURFACE, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <ChevronLeft size={20} strokeWidth={2.2} style={{ color: TEXT_1 }} />
      </span>
    </button>
  );
}

// 화면 가운데에 세우는 헤드라인. 왼쪽 정렬 머리(SubScreenHeader)와 달리
// 문장 하나가 화면의 주인공인 자리에 쓴다.
function CenterHeadline({ title, desc, kicker, spot }: {
  title: React.ReactNode; desc?: React.ReactNode; kicker?: string; spot?: React.ReactNode;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      {spot && <div aria-hidden="true" className="flex justify-center" style={{ marginBottom: 8 }}>{spot}</div>}
      {kicker && <span aria-hidden="true" style={{ ...KICKER, color: TEXT_2, display: "block", marginBottom: 2 }}>{kicker}</span>}
      <h1 style={{ ...TYPE.display, color: TEXT_1 }}>{title}</h1>
      {desc && <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 10 }}>{desc}</p>}
    </div>
  );
}

function PrimaryBtn({
  children, onClick, disabled = false, style: extraStyle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", height: BTN_H, borderRadius: RADIUS.button,
        fontSize: 17, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.02em",
        // 종이색 바탕에서는 초록 알약이 색을 하나 더 늘린 것처럼 보인다. 검정은
        // 글자와 같은 색이라 화면이 조용해지고, 누를 곳이 대비만으로 읽힌다.
        // 초록은 성공.연결 표시 한 곳에만 남긴다.
        backgroundColor: disabled ? SURFACE : RULE,
        // 비활성 컨트롤은 WCAG 대비 규정에서 빠져 있다. 그래도 여기서는 고친다.
        // 아직 못 누르는 버튼의 글자가 "다 채우면 무슨 일이 일어나는지"를 알려 주는 유일한 문장이라
        // 1.62:1(#C4C4C8)로 지워 놓으면 무엇을 기다리는지 알 수 없다.
        // 초록 알약이 회색 알약으로 바뀌는 것만으로 못 누른다는 신호는 충분하다.
        color: disabled ? TEXT_2 : PAPER,
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 0.15s",
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

function OutlineBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", height: BTN_H, borderRadius: RADIUS.button,
        fontSize: 17, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.02em",
        backgroundColor: SURFACE,
        color: TEXT_BTN,
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 flex flex-col gap-2"
      style={{ backgroundColor: PAPER, padding: `12px ${GAP.screenX}px 24px` }}
    >
      {children}
    </div>
  );
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        minHeight: 44, padding: "10px 18px", borderRadius: RADIUS.pill,
        fontSize: 15, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.01em",
        // 고른 칩은 검은 알약. 초록은 화면당 한 곳(연결.성공)에만 남긴다.
        backgroundColor: selected ? RULE : CANVAS,
        color: selected ? PAPER : TEXT_CHIP,
        border: "none",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function SectionLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <span style={{ ...TYPE.label, color: TEXT_1 }}>{text}</span>
      <span style={{ fontSize: 12, fontWeight: 400, color: TEXT_2 }}>{required ? "필수" : "선택"}</span>
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

/**
 * 첫 화면.
 *
 * 규칙: 로그인하지 않아도 핵심 기능이 동작해야 한다.
 * 따라서 주 버튼은 "바로 시작하기"(익명)이고, 전화번호 로그인은 선택 경로다.
 * onStart  익명으로 바로 시작 — 저장은 이번 한 번만, 기기에 남기지 않는다
 * onLogin  선택적 로그인 — 다음에도 불러오고 싶은 사람만 고른다
 */
function WelcomeScreen({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  return (
    <div className="flex flex-col h-full kb-paper">
      {/* 첫 화면은 사진 한 장으로 "어디서 쓰는 앱인지"를 설명한다.
          아래쪽을 흰색으로 흘려보내 사진과 본문의 경계를 지운다. */}
      <div className="shrink-0 relative" style={{ height: "42%", minHeight: 0, overflow: "hidden" }}>
        <img
          src={kioskHeroImg}
          alt=""
          aria-hidden="true"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%" }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0"
          /*
            그라데이션 끝색을 종이색으로 맞춘다.
            사진 위에서 시작해 아래 배경으로 이어지는 띠라, 끝이 배경과 같아야
            이음매가 안 보인다. #fff 로 박아 두면 다크에서 이 띠만 하얗게 남고
            바로 아래 #0C0C0C 와 맞닿아 화면이 두 동강 난다.
          */
          style={{
            height: "58%",
            background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, color-mix(in srgb, ${PAPER} 85%, transparent) 62%, ${PAPER} 100%)`,
          }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center" style={{ minHeight: 0, padding: `0 ${GAP.screenX}px`, marginTop: -12 }}>
        <Pictogram name="handPointing" size={54} color={TEXT_1} />
        <div style={{ marginTop: 18 }}>
          <AppLogo size={40} />
        </div>
        <p style={{ ...TYPE.caption, color: TEXT_2, textAlign: "center", marginTop: 14 }}>
          키오스크 앞에서 헤매지 않도록,<br />저장해 둔 주문을 대신 담아드려요
        </p>
      </div>

      <div style={{ padding: `0 ${GAP.screenX}px 32px` }} className="flex flex-col gap-3">
        {/* 주 버튼 = 익명 시작. 가입도 로그인도 요구하지 않는다. */}
        <PrimaryBtn onClick={onStart}>
          <span className="flex items-center justify-center gap-2">
            {/* 대표 버튼 안이라 버튼 면과 함께 뒤집혀야 한다. #fff 로 박으면 다크에서
                흰 알약 위에 흰 아이콘이 된다. 코드래빗이 잡은 셋과 같은 종류다. */}
            <Pictogram name="handPointing" size={18} color={PAPER} />
            바로 시작하기
          </span>
        </PrimaryBtn>
        <p style={{ fontSize: 13, color: TEXT_2, textAlign: "center", lineHeight: 1.7 }}>
          가입 없이 바로 쓸 수 있어요.<br />입력한 내용은 이번 한 번만 쓰고 지워집니다
        </p>

        {/* 선택 경로. 다음에도 불러오고 싶은 사람만 고른다. */}
        <button
          type="button"
          onClick={onLogin}
          style={{
            marginTop: 4, minHeight: 56, borderRadius: RADIUS.button, background: SURFACE,
            border: `1px solid ${BORDER}`, color: TEXT_2, fontSize: 15, fontWeight: 600,
          }}
          className="flex items-center justify-center gap-2 w-full"
        >
          <Pictogram name="userCircle" size={18} color={TEXT_2} />
          로그인 (선택)
        </button>
      </div>
    </div>
  );
}

// ─── Account — 회원가입 · 로그인 ───────────────────────────────────────────────
//
// 로그인은 끝까지 선택이다. 이 두 화면을 한 번도 열지 않아도 QR 을 찍고 추천을 받고
// 장바구니에 담는 전 과정이 그대로 동작한다. 로그인해서 얻는 것은 하나뿐이다 —
// 저장해 둔 주문표를 다음에 열었을 때도 불러오는 것.
//
// 예전에는 이 자리에 전화번호·인증번호 화면이 있었다. 붙일 백엔드가 없어서 번호는 고칠 수
// 없는 시연값이었고 인증번호는 아무 여섯 자리나 통과했다 — 로그인한 척하는 화면이었다.
// 실제 계정 API(modules/member)가 생겨서 아이디·비밀번호로 바꿨다.
// 실명·전화번호·주민등록번호는 여전히 받지 않는다. 아이디는 사용자가 지어내는 값이다.

/**
 * 계정 화면의 입력 한 줄.
 *
 * 라벨을 진짜 <label for> 로 둔다. 자리표시자로만 두면 값을 적는 순간 무엇을 적는 칸이었는지
 * 사라지고, 스크린리더는 칸 이름을 읽을 방법이 없다.
 *
 * 비밀번호 칸에는 보기/숨기기를 붙인다. 점으로만 가려 두면 오타를 확인할 길이 없어서
 * 손이 떨리거나 화면이 잘 안 보이는 분은 "맞지 않아요" 만 반복해서 만나게 된다.
 * 기본은 가려 둔 상태다 — 어깨 너머로 보이는 것도 막아야 한다.
 */
function AccountField({
  id, label, hint, value, onChange, secret = false, autoComplete, autoFocus = false, onEnter, invalid = false,
}: {
  id: string;
  label: string;
  /** 칸 아래 한 줄. 문제가 있으면 그 이유가, 없으면 안내가 들어온다. */
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  /** 비밀번호 칸인가. 보기/숨기기 버튼이 붙는다. */
  secret?: boolean;
  autoComplete: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  invalid?: boolean;
}) {
  const [보임, 보이기] = useState(false);

  return (
    <div style={{ marginBottom: 20 }}>
      <label htmlFor={id} style={{ ...TYPE.label, color: TEXT_1, display: "block", marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          id={id}
          type={secret && !보임 ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // 칸이 둘·셋인 화면에서 Enter 로 넘어가지 못하면 키보드만 쓰는 사람은
          // 버튼까지 Tab 으로 내려가야 한다. 폼이 아니라 버튼이라 직접 잇는다.
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
          autoComplete={autoComplete}
          /*
           * 아이디만 글자 수로 자른다. 비밀번호는 서버가 UTF-8 '바이트' 로 재기 때문에
           * maxLength 로는 같은 규칙을 만들 수 없다 — 한글이면 24자에서 이미 72바이트다.
           * 비밀번호 길이는 비밀번호검사() 가 본다.
           */
          maxLength={secret ? undefined : LOGIN_ID_MAX}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-invalid={invalid || undefined}
          {...(autoFocus ? { "data-autofocus": true } : {})}
          style={{
            width: "100%", ...TYPE.body, color: TEXT_1, fontFamily: FONT,
            // 보기/숨기기 버튼이 글자를 덮지 않도록 오른쪽을 비워 둔다.
            padding: secret ? "15px 84px 15px 16px" : "15px 16px",
            borderRadius: RADIUS.input, boxSizing: "border-box",
            backgroundColor: CANVAS, outline: "none",
            // 빨간 테두리만으로 알리지 않는다. 아래 hint 가 같은 사실을 글로 말한다.
            border: invalid ? `2px solid ${FAIL}` : "none",
          }}
        />
        {secret && (
          <button
            type="button"
            onClick={() => 보이기((v) => !v)}
            aria-pressed={보임}
            aria-controls={id}
            aria-label={보임 ? "비밀번호 가리기" : "비밀번호 보기"}
            style={{
              position: "absolute", right: 6, minHeight: 44, minWidth: 44, padding: "0 12px",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: TEXT_2, fontFamily: FONT,
            }}
          >
            {보임 ? "숨기기" : "보기"}
          </button>
        )}
      </div>
      {hint && (
        <p
          id={`${id}-hint`}
          style={{ fontSize: 13, lineHeight: 1.5, marginTop: 7, color: invalid ? FAIL : TEXT_2 }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * 로그인.
 *
 * 아이디가 없는 것과 비밀번호가 틀린 것을 구분해서 알리지 않는다. 구분해 주면 어떤 아이디가
 * 이미 있는지 하나씩 확인할 수 있다. 서버도 같은 예외(InvalidCredentialsException)를 쓴다.
 */
function LoginScreen({ onDone, onBack, onGoSignup }: {
  onDone: (a: Account) => void;
  onBack: () => void;
  onGoSignup: () => void;
}) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [오류, set오류] = useState<string | null>(null);
  // 보내는 중에 또 누르면 요청이 두 번 나간다. 로그인에서는 실패 횟수를 두 배로 쌓는 셈이다.
  const [보내는중, set보내는중] = useState(false);

  const 채워짐 = loginId.trim() !== "" && password !== "";

  const 보내기 = () => {
    if (!채워짐 || 보내는중) return;
    set보내는중(true);
    set오류(null);
    account.login(loginId, password)
      .then(onDone)
      // 성공하면 이 화면은 사라지므로 보내는중 을 되돌리지 않는다.
      // 언마운트된 컴포넌트에 상태를 쓰면 React 가 경고한다.
      .catch((e: KioBridgeError) => {
        set보내는중(false);
        set오류(e?.message ?? "로그인하지 못했어요");
      });
  };

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `24px ${GAP.screenX}px 0` }}>
        <h1 style={{ ...TYPE.display, color: TEXT_1 }}>로그인</h1>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8, marginBottom: 28 }}>
          저장해 두신 주문표를 다시 불러와요
        </p>

        <AccountField
          id="login-id" label="아이디" value={loginId} onChange={setLoginId}
          autoComplete="username" autoFocus onEnter={보내기}
        />
        <AccountField
          id="login-pw" label="비밀번호" value={password} onChange={setPassword}
          secret autoComplete="current-password" onEnter={보내기}
        />

        {오류 && (
          <div role="alert" style={{ marginBottom: 12 }}>
            <InfoBox>{오류}</InfoBox>
          </div>
        )}
      </div>

      <StickyFooter>
        {!채워짐 && (
          <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2, marginBottom: 2 }}>
            아이디와 비밀번호를 적으면 로그인할 수 있어요
          </p>
        )}
        <PrimaryBtn onClick={보내기} disabled={!채워짐 || 보내는중}>
          {보내는중 ? "확인하는 중" : "로그인"}
        </PrimaryBtn>
        <button
          type="button"
          onClick={onGoSignup}
          style={{
            minHeight: 48, background: "none", border: "none", cursor: "pointer",
            fontSize: 14, color: TEXT_2, fontFamily: FONT,
            textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          아이디가 없으신가요? 회원가입
        </button>
      </StickyFooter>
    </div>
  );
}

/**
 * 회원가입.
 *
 * 받는 것은 아이디와 비밀번호 둘뿐이다. 심사 규칙이 실제 개인정보 수집을 금지하고,
 * 개인정보 안내 화면도 "실제 이름·주소·주민등록번호는 받지도 저장하지도 않아요" 라고
 * 약속하고 있다. 아이디는 사용자가 지어내는 값이라 그 약속을 어기지 않는다.
 *
 * 비밀번호를 두 번 받는다. 서버는 한 번만 받지만, 가려진 칸에 오타가 나면 사용자는
 * 다음 로그인에서야 그 사실을 알게 되고 그때는 고칠 방법이 없다.
 */
function SignupScreen({ onDone, onBack, onGoLogin }: {
  onDone: (a: Account) => void;
  onBack: () => void;
  onGoLogin: () => void;
}) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [다시, set다시] = useState("");
  const [오류, set오류] = useState<string | null>(null);
  const [보내는중, set보내는중] = useState(false);
  const [안내펼침, set안내펼침] = useState(false);

  /*
   * 적기 시작한 칸만 검사한다.
   *
   * 빈 칸까지 검사하면 화면을 열자마자 "아이디를 적어 주세요" · "비밀번호를 적어 주세요" 가
   * 빨간 글씨로 둘 뜬다. 아직 아무것도 안 했는데 혼나는 화면이 된다.
   * 무엇을 채워야 하는지는 버튼 위 한 줄이 대신 말한다.
   */
  const 아이디문제 = loginId ? 아이디검사(loginId) : null;
  const 비번문제 = password ? 비밀번호검사(password) : null;
  const 다시문제 = 다시 && 다시 !== password ? "두 번 적은 비밀번호가 서로 달라요" : null;

  const 보낼수있나 =
    loginId.trim() !== "" && password !== "" && 다시 !== "" &&
    !아이디문제 && !비번문제 && !다시문제;

  const 보내기 = () => {
    if (!보낼수있나 || 보내는중) return;
    set보내는중(true);
    set오류(null);
    account.signup(loginId, password)
      .then(onDone)
      .catch((e: KioBridgeError) => {
        set보내는중(false);
        set오류(e?.message ?? "가입하지 못했어요");
      });
  };

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0 flex items-center" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
          <ProgressBar step={1} total={3} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `24px ${GAP.screenX}px 0` }}>
        <h1 style={{ ...TYPE.display, color: TEXT_1 }}>회원가입</h1>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8, marginBottom: 28 }}>
          아이디와 비밀번호만 받아요
        </p>

        <AccountField
          id="signup-id" label="아이디" value={loginId} onChange={setLoginId}
          autoComplete="username" autoFocus onEnter={보내기}
          invalid={Boolean(아이디문제)}
          hint={아이디문제 ?? `${LOGIN_ID_MAX}자까지 쓸 수 있어요. 실제 이름이나 전화번호는 적지 마세요`}
        />
        <AccountField
          id="signup-pw" label="비밀번호" value={password} onChange={setPassword}
          secret autoComplete="new-password" onEnter={보내기}
          invalid={Boolean(비번문제)}
          hint={비번문제 ?? `${PASSWORD_MIN}자 이상 적어 주세요`}
        />
        <AccountField
          id="signup-pw2" label="비밀번호 다시 적기" value={다시} onChange={set다시}
          secret autoComplete="new-password" onEnter={보내기}
          invalid={Boolean(다시문제)}
          hint={다시문제 ?? "같은 비밀번호를 한 번 더 적어 주세요"}
        />

        {오류 && (
          <div role="alert" style={{ marginBottom: 12 }}>
            <InfoBox>{오류}</InfoBox>
          </div>
        )}

        {/*
          * 안내를 이 화면 안에서 펼친다. 다른 화면으로 보내지 않는다.
          *
          * 예전에는 개인정보 화면으로 넘어갔는데, 그 화면의 뒤로가기는 늘 홈으로
          * 간다. 가입 화면으로 돌아올 길이 없어서 적어 둔 아이디와 비밀번호가
          * 둘 다 사라졌다. 무엇을 저장하는지 확인하고 가입하려는 사람이 가장
          * 먼저 밟는 길인데, 확인하면 처음부터 다시 적어야 했다.
          */}
        <p style={{ fontSize: 13, color: TEXT_2, lineHeight: 1.7, marginBottom: 8 }}>
          실제 이름·주소·주민등록번호는 받지 않아요. 무엇을 저장하고 무엇을 저장하지 않는지는{" "}
          <button
            type="button"
            onClick={() => set안내펼침((v) => !v)}
            aria-expanded={안내펼침}
            aria-controls="signup-privacy"
            style={{
              color: TEXT_2, textDecoration: "underline", textUnderlineOffset: 3,
              background: "none", border: "none", padding: "6px 2px", minHeight: 44,
              cursor: "pointer", fontFamily: FONT, fontSize: 13,
            }}
          >
            {안내펼침 ? "개인정보 안내 접기" : "개인정보 안내"}
          </button>
          에 적어 두었어요.
        </p>

        {안내펼침 && (
          <div id="signup-privacy" style={{ marginBottom: 8 }}>
            <PrivacyRows guest />
          </div>
        )}
      </div>

      <StickyFooter>
        {!보낼수있나 && (
          <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2, marginBottom: 2 }}>
            {아이디문제 ?? 비번문제 ?? 다시문제 ?? "아이디와 비밀번호를 적으면 가입할 수 있어요"}
          </p>
        )}
        <PrimaryBtn onClick={보내기} disabled={!보낼수있나 || 보내는중}>
          {보내는중 ? "가입하는 중" : "가입하고 시작하기"}
        </PrimaryBtn>
        <button
          type="button"
          onClick={onGoLogin}
          style={{
            minHeight: 48, background: "none", border: "none", cursor: "pointer",
            fontSize: 14, color: TEXT_2, fontFamily: FONT,
            textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          이미 아이디가 있으신가요? 로그인
        </button>
      </StickyFooter>
    </div>
  );
}

// ─── Name ─────────────────────────────────────────────────────────────────────

function NameScreen({ onNext, onBack }: { onNext: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0 flex items-center" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
          <ProgressBar step={2} total={3} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `48px ${GAP.screenX}px 0` }}>
        {/*
         * 실제 이름을 받지 않는다. 화면에 부를 호칭만 받는다.
         * 심사 규칙이 실제 개인정보 수집을 금지하고, 개인정보 화면도
         * "이름은 받지도 저장하지도 않아요" 라고 약속하고 있다.
         * 예전에는 autoComplete="name" 에 '이름 입력' 이라고 적어 두어
         * 브라우저 자동완성이 진짜 이름을 채워 넣었다. 약속과 정반대였다.
         */}
        <CenterHeadline
          title={<>반갑습니다!<br />어떻게 불러드릴까요?</>}
          desc="부르는 말만 쓰여요. 실제 이름이 아니어도 괜찮아요"
        />

        <label htmlFor="name-input" className="sr-only">부를 호칭</label>
        <input
          id="name-input"
          type="text"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 할머니, 김씨"
          data-autofocus
          style={{
            width: "100%", marginTop: 36, textAlign: "center",
            fontSize: 22, fontWeight: 600, color: TEXT_1, fontFamily: FONT, letterSpacing: "-0.02em",
            border: "none", outline: "none", backgroundColor: "transparent",
            padding: "12px 0", boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ padding: `0 ${GAP.screenX}px 32px` }}>
        <PrimaryBtn onClick={() => name.trim() && onNext(name.trim())} disabled={!name.trim()}>계속하기</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function GreetingScreen({ name, onNext }: { name: string; onNext: () => void }) {
  // 자동 넘김이 없다. 사용자가 '계속하기' 를 누를 때만 넘어간다.
  //
  // 예전에는 2.6초 뒤 저절로 사라졌고, 그다음엔 8초로 늘렸다. 둘 다 부족하다 —
  // WCAG 2.2.1(Level A)은 시간 제한을 끄거나 늘리거나 넘길 수 있을 것을 요구하는데,
  // 자동으로 넘어가면 늘리는 것도 끄는 것도 안 되고 '머무를' 수가 없다.
  // 천천히 읽는 분이 주 사용자인 앱에서 읽던 화면이 사라지는 건 예외에 해당하지 않는다.

  return (
    <div
      className="flex flex-col h-full items-center justify-center text-center kb-paper"
      style={{ padding: `0 ${GAP.screenX}px` }}
      role="status"
      aria-live="polite"
    >
      <Pictogram name="handsClapping" size={72} color={TEXT_1} />
      <h1 style={{ ...TYPE.title, color: TEXT_1, marginTop: 32 }}>
        반가워요, <span style={{ color: TEXT_1 }}>{name}</span>님!
      </h1>
      <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 10 }}>
        자주 시키는 주문을 저장해 두면<br />키오스크 앞에서 바로 꺼내 쓸 수 있어요
      </p>
      <div style={{ width: "100%", marginTop: 36 }}>
        <PrimaryBtn onClick={onNext}>계속하기</PrimaryBtn>
      </div>
    </div>
  );
}

/**
 * 되돌릴 수 없는 동작 앞에서만 띄운다.
 * 장소를 바꾸는 것처럼 되돌릴 수 있는 일에는 쓰지 않는다 — 매번 물으면
 * 사람은 읽지 않고 누르게 되고, 정작 위험할 때도 그냥 누른다.
 * 지금 이걸 쓰는 곳은 주문표 삭제와 '이 기기에서 정보 지우기' 둘뿐이다.
 */
function ConfirmSheet({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  // aria-modal="true" 는 "뒤는 없는 셈 치라" 는 선언이다. 선언만 하고
  // Tab 이 뒤 화면으로 나가면 그 말이 사실이 아니게 된다.
  // 되돌릴 수 없는 동작을 지키는 자리라 더 그렇다.
  const 가두기 = 포커스가두기(ref, onCancel);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div
        ref={ref}
        tabIndex={-1}
        onKeyDown={가두기}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        style={{ backgroundColor: PAPER, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: `28px ${GAP.screenX}px 24px`, outline: "none" }}
      >
        <h2 id="confirm-title" style={{ ...TYPE.title, color: TEXT_1, margin: 0 }}>{title}</h2>
        <p id="confirm-body" style={{ ...TYPE.body, color: TEXT_2, marginTop: 10 }}>{body}</p>
        <div style={{ marginTop: 24 }}>
          {/* 지우는 쪽을 기본으로 두지 않는다. 취소가 더 누르기 쉬운 자리에 있어야 한다. */}
          <button
            type="button"
            onClick={onConfirm}
            style={{ width: "100%", minHeight: 52, borderRadius: RADIUS.button, backgroundColor: FAIL, color: PAPER, border: "none", cursor: "pointer", ...TYPE.bodyBold, fontFamily: FONT }}
          >
            {confirmLabel}
          </button>
          <div style={{ height: 10 }} />
          <OutlineBtn onClick={onCancel}>그대로 두기</OutlineBtn>
        </div>
      </div>
    </div>
  );
}

/**
 * 모달 안에 Tab 을 가둔다. aria-modal 을 선언한 곳은 전부 이걸 쓴다.
 * 선언만 하고 안 지키면 스크린리더에게 거짓말을 하는 셈이다.
 */
function 포커스가두기(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key !== "Tab") return;
    const 대상 = ref.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    if (!대상 || 대상.length === 0) return;
    const 처음 = 대상[0];
    const 마지막 = 대상[대상.length - 1];
    if (e.shiftKey && document.activeElement === 처음) { e.preventDefault(); 마지막.focus(); }
    else if (!e.shiftKey && document.activeElement === 마지막) { e.preventDefault(); 처음.focus(); }
  };
}

/**
 * 사용자가 직접 짚었다는 표시를 받는 한 줄.
 * 고르는 자리가 아니라 확인하는 자리라 카드가 아니라 체크로 둔다.
 */
function CheckRow({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 44, border: "none", backgroundColor: "transparent", cursor: "pointer", fontFamily: FONT, padding: 0, textAlign: "left" }}
    >
      <div aria-hidden="true" style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: checked ? "none" : `1.5px solid ${TEXT_2}`,
        backgroundColor: checked ? RULE : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
      }}>
        {checked && <Check size={12} strokeWidth={3} color={PAPER} />}
      </div>
      <span style={{ ...TYPE.caption, fontWeight: 600, color: TEXT_1 }}>{label}</span>
    </button>
  );
}

// ─── Profile Form ─────────────────────────────────────────────────────────────

// 주문표 id. 사람이 읽을 값이 아니고 서버로도 나가지 않는 화면 내부 표식이다.
// 시각은 사람이 만든 순서를 알아보기 쉬워서 남기고, 뒤에 카운터를 붙여 충돌을 막는다.
let 주문표일련번호 = 0;
const newSheetId = () => `p${Date.now()}_${++주문표일련번호}`;

function OrderSheetScreen({ onNext, onBack, 로그인함 = false }: {
  onNext: (p: OrderSheet) => void;
  onBack: () => void;
  /**
   * 로그인한 사람인가. 저장한 주문표가 서버에도 올라가는지가 달라지므로 화면이 말해 준다.
   * 로그인하지 않았으면 서버 이야기를 꺼내지 않는다 — 하지 않는 일을 설명할 이유가 없다.
   */
  로그인함?: boolean;
}) {
  const [menuName, setMenuName] = useState("");
  const [place, setPlace] = useState<PlaceType>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [memo, setMemo] = useState("");

  const options = place ? DETAIL_OPTIONS[place] : [];

  const toggleChip = (sectionLabel: string, choice: string, multi: boolean) => {
    const 배타 = options.find((o) => o.label === sectionLabel)?.exclusive ?? [];
    setSelections((prev) => {
      const current = prev[sectionLabel] ?? [];
      /*
       * 다 끄면 축 자체를 뺀다. 빈 배열을 남기면 안 된다.
       *
       * 빈 배열과 '축이 없는 것' 은 같은 뜻인데 모양만 다르다. 그런데 서버는
       * 그 둘을 다르게 본다 - selections 의 값에 @NotEmpty 가 걸려 있어서
       * 빈 배열이 섞이면 저장이 400 으로 막힌다(팀 #79).
       *
       * 그 400 은 스프링 기본 응답이라 code 도 message 도 없다. 화면은
       * "적어 주신 내용을 다시 확인해 주세요" 만 띄우고 **무엇이 문제인지
       * 말해 주지 못한다.** 맵기를 눌렀다 다시 눌러 끈 것뿐인데 주문표가
       * 통째로 안 올라가고, 사용자는 이유를 알 길이 없다.
       */
      const 넣기 = (값: string[]): Record<string, string[]> => {
        if (값.length > 0) return { ...prev, [sectionLabel]: 값 };
        const { [sectionLabel]: _버림, ...나머지 } = prev;
        return 나머지;
      };
      if (multi) {
        if (current.includes(choice)) {
          return 넣기(current.filter((c) => c !== choice));
        }
        // '시럽 없음' 을 고르면 다른 시럽은 내린다. 반대로 시럽을 고르면 '없음'을 내린다.
        // 둘이 같이 켜져 있으면 앱도 사용자도 무엇을 시킨 건지 알 수 없다.
        const 남길 = 배타.includes(choice)
          ? []
          : current.filter((c) => !배타.includes(c));
        return 넣기([...남길, choice]);
      } else {
        return 넣기(current[0] === choice ? [] : [choice]);
      }
    });
  };

  // 장소를 바꾼다고 고른 것을 버리지 않는다. 예전에는 setSelections({}) 라
  // 손이 미끄러져 장소를 잘못 누르면 채워 둔 답이 경고도 없이 전부 사라졌다.
  // 장소마다 따로 기억해 두면, 잘못 눌러도 도로 누르면 그대로 돌아온다.
  // 확인 창을 띄우지 않아도 되돌릴 수 있으니 되묻는 것보다 조용하고 안전하다.
  const 장소별선택 = useRef<Record<string, Record<string, string[]>>>({});
  const handlePlaceChange = (p: PlaceType) => {
    // 다시 누르면 해제한다. 아래 칩들은 재탭으로 풀리는데 장소만 안 풀리면
    // 같은 화면 안에서 상호작용 규칙이 두 개가 된다. 라벨도 '선택'이다.
    if (p === place) { if (place) 장소별선택.current[place] = selections; setSelections({}); setPlace(null); return; }
    if (place) 장소별선택.current[place] = selections;
    setSelections(p ? (장소별선택.current[p] ?? {}) : {});
    setPlace(p);
  };

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        {/*
         * 진행 표시를 두지 않는다.
         *
         * 예전에는 게스트가 아니면 "3단계 중 3단계" 를 보여 줬다. 그런데 이 화면은 가입
         * 흐름의 끝이 아니라 홈에서 '+ 새 주문표 추가' 로 들어오는 자리다. 로그인한 사람이
         * 다섯 번째 주문표를 만들 때도 "3단계 중 3단계" 가 떴고, role="progressbar" 라
         * 스크린리더는 그 틀린 단계를 그대로 읽었다.
         * 가입 흐름은 가입(1) → 호칭(2) 둘로 끝난다.
         */}
        <BackButton onClick={onBack} />
        <h1 style={{ ...TYPE.display, color: TEXT_1, marginTop: 28 }}>메뉴 주문표</h1>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8, marginBottom: 24 }}>자주 주문하는 메뉴를 저장해두세요</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-4" style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}>
        <div style={{ marginBottom: 28 }}>
          <SectionLabel text="메뉴 이름" required />
          <input
            type="text"
            aria-label="메뉴 이름 (필수)"
            value={menuName}
            onChange={(e) => setMenuName(e.target.value)}
            // 서버의 menuName 이 @Size(max = 100) 이다. 넘으면 저장은 되는데 서버에만
            // 못 올라가고, 사용자는 그 사실을 나중에 안다. 애초에 못 넘게 막는다.
            maxLength={MENU_NAME_MAX}
            placeholder="예) 아이스 아메리카노 둘"
            style={{
              width: "100%", ...TYPE.body, color: TEXT_1, fontFamily: FONT,
              padding: "15px 16px", borderRadius: RADIUS.input,
              border: "none", outline: "none", backgroundColor: CANVAS, boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <SectionLabel text="장소 유형" />
          <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="장소 유형 선택">
            {PLACE_LIST.map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                aria-pressed={place === label}
                onClick={() => handlePlaceChange(label)}
                style={{
                  minHeight: 56,
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 16px", borderRadius: RADIUS.input, cursor: "pointer",
                  fontSize: 16, fontWeight: 500, fontFamily: FONT, letterSpacing: "-0.01em",
                  border: "none",
                  backgroundColor: place === label ? RULE : CANVAS,
                  color: place === label ? PAPER : TEXT_CHIP,
                  transition: "background-color 0.15s",
                }}
              >
                <span aria-hidden="true" style={{ color: place === label ? PAPER : TEXT_1, display: "flex" }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {options.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel text="세부 옵션" />
            <div>
              {options.map((opt, oi) => {
                const selected = selections[opt.label] ?? [];
                return (
                  <div key={opt.label} style={{ marginTop: oi > 0 ? 20 : 0 }}>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_1, letterSpacing: "-0.01em" }}>{opt.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 400, color: TEXT_2 }}>
                        {opt.multi ? "복수 선택" : "1개 선택"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={`${opt.label} — ${opt.multi ? "복수 선택" : "1개 선택"}`}>
                      {opt.choices.map((choice) => (
                        <Chip key={choice} label={choice} selected={selected.includes(choice)} onClick={() => toggleChip(opt.label, choice, opt.multi)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 8 }}>
          <SectionLabel text="메모" />
          {/*
           * 메모는 자유 입력이라 사용자가 무엇이든 적을 수 있다.
           * "이 칸을 없애라" 는 지적도 있었지만, '얼음 적게 부탁드려요' 처럼
           * 자기 사정을 말하는 유일한 자리라 없애면 잃는 게 더 크다.
           * 대신 무엇을 적지 말아야 하는지 적을 자리 바로 옆에서 밝힌다.
           * placeholder 는 입력하면 사라지므로 안내는 밖에 따로 둔다.
           */}
          <textarea
            aria-label="메모 (선택). 이름·전화번호·주민등록번호 같은 개인정보는 적지 마세요"
            aria-describedby="memo-notice"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            // 서버의 memo 가 @Size(max = 500) 이다. menuName 과 같은 이유로 여기서 막는다.
            maxLength={MEMO_MAX}
            placeholder="예: 얼음 적게 주세요"
            rows={3}
            style={{
              width: "100%", ...TYPE.body, color: TEXT_1, fontFamily: FONT,
              padding: "15px 16px", borderRadius: RADIUS.input, resize: "none",
              border: "none", outline: "none", backgroundColor: CANVAS, boxSizing: "border-box",
            }}
          />
          <p id="memo-notice" style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8 }}>
            주문에 필요한 내용만 적어 주세요. <strong style={{ fontWeight: 600, color: TEXT_1 }}>이름·전화번호·주민등록번호 같은 개인정보는 적지 마세요.</strong>
          </p>
          {/*
            안내 한 줄로는 안 지켜진다. 안내를 못 보거나 습관대로 적는 사람이 있고,
            이 앱은 실제 개인정보를 받지도 저장하지도 않겠다고 약속했다.
            모양으로 걸러낸다 — 완벽하진 않지만(이름은 못 가려낸다) 저장되면 가장
            곤란한 두 가지는 여기서 막힌다. 지우지는 않는다. 사용자가 적은 것을
            앱이 말없이 고치면 화면에 보이는 것과 저장되는 것이 달라진다.
          */}
          {개인정보같은메모(memo) && (
            <p role="alert" style={{ ...TYPE.caption, color: FAIL, marginTop: 8 }}>
              전화번호·주민등록번호·주소처럼 보이는 것이 있어요. 지워 주시면 저장할 수 있어요.
            </p>
          )}
        </div>
      </div>

      <StickyFooter>
        {/*
         * 버튼이 잠긴 이유를 버튼 옆에서 밝힌다.
         * 폼이 길어 버튼까지 내려오면 '메뉴 이름' 칸은 이미 화면 위로 사라진 뒤라,
         * 이 줄이 없으면 그냥 고장 난 버튼으로 보인다. 어느 칸인지까지 짚어 준다.
         */}
        {!menuName.trim() && (
          <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2, marginBottom: 2 }}>
            맨 위 <span style={{ fontWeight: 600, color: TEXT_1 }}>메뉴 이름</span>을 적으면 저장할 수 있어요
          </p>
        )}
        {/*
          서버는 장소가 빈 주문표를 받지 않는다(place 가 @NotBlank). 올리고 나서 400 을
          받아 "못 올렸어요" 를 띄우는 대신, 저장하기 전에 무엇을 하면 되는지 말한다.
          막지는 않는다 — 장소는 선택 항목이고, 이 기기에는 그대로 저장된다.
        */}
        {로그인함 && menuName.trim() && !place && (
          <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, color: TEXT_1 }}>장소</span>를 정해 두시면 다음에 로그인해도 불러올 수 있어요
          </p>
        )}
        <PrimaryBtn
          // Date.now() 만 쓰면 같은 밀리초에 두 개를 만들 때 id 가 겹친다.
          // 겹치면 주문표 하나를 지울 때 다른 하나도 같이 사라진다.
          onClick={() => onNext({ id: newSheetId(), menuName, place, selections, memo })}
          disabled={!menuName.trim() || 개인정보같은메모(memo)}
        >
          저장하고 시작하기
        </PrimaryBtn>
      </StickyFooter>
    </div>
  );
}

// ─── Saved Profiles ───────────────────────────────────────────────────────────

/**
 * 눈에는 안 보이지만 포커스와 스크린리더에는 남아 있어야 하는 요소.
 *
 * opacity:0 이나 visibility:hidden 으로 숨기지 않는다. opacity 는 그 요소에 그린
 * 포커스 표시까지 같이 지우고, visibility:hidden 은 포커스를 아예 못 받게 만든다.
 * clip 은 오래된 방법이고 clipPath 가 그 자리를 대신하는 중이라 둘 다 둔다.
 */
const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0,0,0,0)", clipPath: "inset(50%)",
  whiteSpace: "nowrap", border: 0,
};

function OrderSheetCard({
  sheet, selected, onSelect, onDelete,
}: {
  sheet: OrderSheet; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const allTags = [...(sheet.place ? [sheet.place] : []), ...Object.values(sheet.selections).flat()];
  const visibleTags = allTags.slice(0, 4);
  // 화면은 태그를 넷까지만 보여 주지만 소리로는 전부 읽는다. 눈으로 보는 사람은
  // 잘린 뒤에도 카드 두 개가 다르게 생긴 걸 알지만, 듣는 사람은 읽어 준 만큼만 안다.
  const 듣는이름 = (p: OrderSheet) =>
    [p.menuName, p.place, ...Object.values(p.selections).flat(), p.memo].filter(Boolean).join(", ");
  const overflow = allTags.length - visibleTags.length;
  const [focused, setFocused] = useState(false);

  /*
   * 고르는 곳과 지우는 곳은 형제여야 한다.
   *
   * 예전에는 카드 전체가 role="radio" 이고 그 안에 삭제 버튼이 들어 있었다.
   * 그러면 삭제 버튼에 포커스를 두고 Enter 를 눌러도 카드만 선택되고 지워지지 않는다.
   * 부모가 그 Enter 를 가로채 preventDefault() 해 버리기 때문이다.
   * 키보드만 쓰는 사람에게는 주문표를 지울 방법이 아예 없었다.
   *
   * 고르는 일은 진짜 input[type=radio] 에 맡긴다. 화살표 키로 옮겨 다니는 것과
   * 그룹 전체에 탭이 한 번만 걸리는 것을 브라우저가 알아서 해 준다.
   */
  return (
    <div
      style={{
        position: "relative",
        borderRadius: RADIUS.card, marginBottom: 10,
        border: "none",
        // 고른 주문표는 검은 면. 초록은 담기 성공 체크에만 남긴다.
        backgroundColor: selected ? RULE : SURFACE,
        transition: "background-color 0.15s",
        outline: focused ? `3px solid ${TEXT_1}` : "none",
        outlineOffset: 2,
      }}
    >
      <label style={{ display: "block", padding: "20px 20px 0", cursor: "pointer" }}>
        <input
          type="radio"
          name="saved-sheet"
          style={SR_ONLY}
          checked={selected}
          onChange={onSelect}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // 이름과 장소만 읽으면 "닭강정, 음식점" 두 개를 소리로 구분할 수 없다.
          // 화면은 태그와 메모로 구분되는데 듣는 사람만 못 고른다.
          aria-label={듣는이름(sheet)}
        />
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* 저장된 주문표에는 사진을 붙이지 않는다. 아직 어느 키오스크에도 물어보기 전이라
                여기서 사진을 보여 주면 오늘 실제로 나올 메뉴를 앱이 장담하는 꼴이 된다. */}
            <div
              aria-hidden="true"
              style={{
                width: 40, height: 40, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: selected ? "rgba(127,127,127,0.22)" : PAPER,
                color: selected ? PAPER : TEXT_1, flexShrink: 0,
              }}
            >
              {sheet.place ? PLACE_ICONS[sheet.place] : <Pictogram name="squaresFour" size={19} />}
            </div>
            <span style={{ ...TYPE.bodyBold, color: selected ? PAPER : TEXT_1 }}>{sheet.menuName}</span>
          </div>
          <div
            aria-hidden="true"
            style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 5,
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: selected ? PAPER : "transparent",
              // 안 고른 동그라미의 테두리는 "여기 고를 수 있는 게 있다"를 알리는 유일한 표시다.
              // TEXT_3 는 옅은 면 위에서 1.62:1 이라 컨트롤 경계 기준(3:1)에 못 미쳤다.
              border: selected ? "none" : `1.5px solid ${TEXT_2}`,
            }}
          >
            {selected && <Check size={13} strokeWidth={3} color={RULE} />}
          </div>
        </div>

        {/*
         * 고른 카드 위의 태그는 초록을 어둡게 눌러서 만든다.
         * 예전에는 흰색을 14% 얹어 밝은 알약을 만들고 글자를 86% 흰색으로 썼는데,
         * 그러면 대비가 3.35:1 이라 13px 글자 기준(4.5:1)에 못 미쳤다.
         * 흰 글자를 100% 로 올려도 밝아진 바탕 때문에 3.94:1 에서 멈춘다.
         * 바탕을 어둡게 하면 같은 알약 모양 그대로 6.6:1 이 나온다.
         */}
        <div className="flex flex-wrap gap-1.5">
          {visibleTags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 13, fontWeight: 500, padding: "4px 11px", borderRadius: RADIUS.pill,
              backgroundColor: selected ? "rgba(127,127,127,0.22)" : PAPER,
              color: selected ? PAPER : TEXT_2,
            }}>
              {tag}
            </span>
          ))}
          {overflow > 0 && (
            <span style={{
              fontSize: 13, fontWeight: 500, padding: "4px 11px", borderRadius: RADIUS.pill,
              backgroundColor: selected ? "rgba(127,127,127,0.22)" : PAPER,
              color: selected ? PAPER : TEXT_2,
            }}>
              +{overflow}
            </span>
          )}
        </div>

        {/* 반투명 흰색(70%)은 초록 위에서 3.31:1 이라 읽히지 않는다. 흰색은 5.08:1 이다. */}
        {sheet.memo && (
          <p style={{ fontSize: 14, color: selected ? PAPER : TEXT_2, lineHeight: 1.5, marginTop: 12 }}>{sheet.memo}</p>
        )}
      </label>

      {/* 삭제는 라벨 바깥에 둔다. 안에 있으면 label 이 클릭을 가로채 선택으로 바꿔 버린다. */}
      <div className="flex justify-end" style={{ padding: "0 20px 20px", marginTop: 4 }}>
        <button
          type="button"
          // 삭제는 되돌릴 수 없다. 고르는 쪽보다 더 정확히 말해 줘야 한다.
          aria-label={`${듣는이름(sheet)} 주문표 삭제`}
          onClick={onDelete}
          style={{
            // 높이만 44 였고 폭이 30 이었다. 밑줄은 글자에만 걸리므로
            // 폭을 44 로 넓혀도 보이는 크기는 그대로고 누를 수 있는 데만 넓어진다.
            fontSize: 13, fontWeight: 500, minHeight: 44, minWidth: 44, padding: "6px 10px",
            background: "none", border: "none", cursor: "pointer",
            // 70% 흰색은 초록 위에서 3.31:1 이었다. 지우는 버튼은 흐릿하면 안 된다.
            color: selected ? PAPER : TEXT_2,
            textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

/**
 * 가격 한도를 고르는 줄.
 *
 * 순위를 바꾸는 값이 아니라 **후보를 빼는 값**이다. 서버에서 확인한 것:
 * 한도가 5,000원이면 5,500~7,000원짜리 후보가 전부 excludedCandidates 로 빠지고
 * reasonCode 는 PRICE_LIMIT_EXCEEDED 다. 그래서 "비싼 건 빼고 찾아요" 라고
 * 먼저 말한다 — 순위만 밀리는 줄 알고 낮게 잡으면 담을 게 없다는 답을 받는다.
 *
 * 주문표가 아니라 이번 이용에 딸린 값이라 여기(주문 직전)에 둔다. 주문표에 넣으면
 * 예산은 그날그날 다른데 저장해 둔 조건에 굳어 버린다.
 */
function 한도고르기({ 예산, on바꾸기 }: { 예산: number | null; on바꾸기: (원: number | null) => void }) {
  return (
    <div>
      <h2 style={{ ...TYPE.label, color: TEXT_2, marginBottom: 6 }}>가격 한도 (선택)</h2>
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        <Chip label="안 정함" selected={예산 === null} onClick={() => on바꾸기(null)} />
        {한도후보.map((원) => (
          <Chip
            key={원}
            label={`${원.toLocaleString("ko-KR")}원`}
            selected={예산 === 원}
            onClick={() => on바꾸기(예산 === 원 ? null : 원)}
          />
        ))}
      </div>
      {예산 !== null && (
        <p style={{ fontSize: 12, color: TEXT_2, marginTop: 6, lineHeight: 1.6 }}>
          {예산.toLocaleString("ko-KR")}원보다 비싼 메뉴는 빼고 찾아요. 남는 게 없으면 그렇다고 알려 드려요.
        </p>
      )}
    </div>
  );
}

function SavedSheetsScreen({
  sheets, onAddSheet, onDeleteSheet, onOrder, showOrder = false, 예산, on예산,
}: {
  sheets: OrderSheet[];
  onAddSheet: () => void;
  onDeleteSheet: (id: string) => void;
  onOrder: (sheet: OrderSheet) => void;
  showOrder?: boolean;
  예산: number | null;
  on예산: (원: number | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(sheets[0]?.id ?? null);

  // 목록이 바뀌면 고른 것도 따라가야 한다. 초기값에 갇혀 있으면
  // 전부 지웠다가 새로 만들었을 때 아무것도 안 골라진 채로 남고,
  // '이 주문표로 주문하기'가 계속 잠겨서 빠져나갈 방법이 없어진다.
  useEffect(() => {
    if (sheets.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    // 목록이 실제로 바뀌었을 때만 따라간다.
    // 지워진 주문표가 골라져 있었으면 첫 번째로 옮긴다. 삭제를 취소한 경우에는
    // sheets 가 그대로라 이 이펙트가 돌지 않으므로 선택도 움직이지 않는다.
    if (!sheets.some((p) => p.id === selectedId)) setSelectedId(sheets[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets]);

  const 고른것 = sheets.find((p) => p.id === selectedId) ?? null;
  const 주문가능 = 고른것 !== null && 백엔드가아는장소(고른것);

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `20px ${GAP.screenX}px 20px` }}>
        <AppLogo size={26} />
        <span aria-hidden="true" style={{ ...KICKER, color: TEXT_2, marginTop: 20, display: "block" }}>saved orders</span>
        <div className="flex items-end justify-between" style={{ gap: 12 }}>
          <h1 style={{ ...TYPE.display, color: TEXT_1, marginTop: 2, flex: 1 }}>어떤 주문표로<br />주문할까요?</h1>
          <span aria-hidden="true" style={{ flexShrink: 0, marginBottom: 4 }}><ReceiptSpot /></span>
        </div>
        <Rule style={{ marginTop: 18 }} />
      </div>

      <div className="flex-1 overflow-y-auto pb-2" style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}>
        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Pictogram name="squaresFour" size={56} color={TEXT_3} />
            <p style={{ ...TYPE.bodyBold, color: TEXT_1, marginTop: 20 }}>저장된 주문표가 없어요</p>
            <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 6 }}>새 주문표를 추가해보세요</p>
          </div>
        ) : (
          /*
           * role="radiogroup" 을 쓰지 않고 fieldset 을 쓴다.
           * radiogroup 은 라디오만 품는 게 원칙인데 여기에는 카드마다 삭제 버튼이 같이 있다.
           * fieldset/legend 는 브라우저가 원래 갖고 있는 묶음이라 버튼이 섞여 있어도 괜찮고,
           * 같은 name 을 가진 라디오끼리 화살표 키로 옮겨 다니는 것도 그대로 동작한다.
           */
          <fieldset style={{ border: 0, margin: 0, padding: 0, minInlineSize: 0 }}>
            <legend style={SR_ONLY}>저장된 주문표 목록</legend>
            {sheets.map((sheet) => (
              <OrderSheetCard
                key={sheet.id}
                sheet={sheet}
                selected={selectedId === sheet.id}
                onSelect={() => setSelectedId(sheet.id)}
                // 선택을 여기서 옮기지 않는다. onDeleteSheet 은 이제 확인창만
                // 열고 아직 지우지 않는데, 여기서 옮기면 대답도 하기 전에 선택이
                // 움직이고 '그대로 두기' 를 눌러도 돌아오지 않는다.
                // 실제로 지워진 뒤의 선택 이동은 아래 useEffect 가 맡는다.
                onDelete={() => onDeleteSheet(sheet.id)}
              />
            ))}
          </fieldset>
        )}
      </div>

      <StickyFooter>
        {/* 주문 버튼이 보일 때만 묻는다. 연결도 안 된 화면에서 예산부터 물으면 뜬금없다. */}
        {showOrder && 고른것 && 백엔드가아는장소(고른것) && (
          <한도고르기 예산={예산} on바꾸기={on예산} />
        )}
        {/*
          아직 연결되지 않은 장소는 주문으로 보내지 않는다.
          
          지금 백엔드가 다루는 것은 닭강정집뿐이다. 카페 주문표로 주문하면
          "매장컵"·"테이크아웃" 을 이용방식 표에서 못 찾아 serviceType 이
          UNKNOWN 이 되고, 음료·온도·사이즈·시럽은 축 자체가 없어 전부
          NO_PREFERENCE 가 된다. 킷 스키마가 UNKNOWN 을 허용하는 enum 이라
          **검증은 통과하고 닭강정이 추천된다.**
          
          게다가 확인표() 는 UNKNOWN·NO_PREFERENCE 축을 건너뛰므로 확인 카드가
          텅 빈 채로 승인 화면이 뜬다. 무엇을 담는지 못 보고 승인하게 된다.
          
          막을 때 이유를 말한다. 버튼만 잠그면 왜 안 되는지 알 수 없다.
        */}
        {showOrder && 고른것 && !백엔드가아는장소(고른것) && (
          <div style={{ marginBottom: 4 }} role="status">
            {/*
              장소를 안 고른 주문표와 아직 안 붙은 장소를 나눠 말한다.

              예전에는 둘 다 "이 장소는 아직 키오스크와 연결되지 않았어요" 였다.
              장소를 고른 적이 없는 사람에게 '이 장소' 가 무엇인지 알 길이 없고,
              무엇을 하면 주문할 수 있는지도 안 알려 준다.
            */}
            <InfoBox>
              {고른것.place === null
                ? "장소를 아직 안 고르셨어요. 주문표를 열어 장소를 고르시면 주문할 수 있어요."
                : `${고른것.place}는 아직 키오스크와 연결되지 않았어요. 지금은 음식점 주문표로만 주문할 수 있어요.`}
            </InfoBox>
          </div>
        )}
        {showOrder && (
          <PrimaryBtn
            onClick={() => {
              const picked = sheets.find((p) => p.id === selectedId);
              if (picked) onOrder(picked);
            }}
            disabled={!selectedId || !주문가능}
          >
            이 주문표로 주문하기
          </PrimaryBtn>
        )}
        <OutlineBtn onClick={onAddSheet}>
          + 새 주문표 추가
        </OutlineBtn>
      </StickyFooter>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav({ tab, onChange }: { tab: MainTab; onChange: (t: MainTab) => void }) {
  const items: { id: MainTab; icon: React.ReactNode; label: string }[] = [
    { id: "qr", icon: <Pictogram name="qrCode" size={25} />, label: "QR 찍기" },
    { id: "menu", icon: <Pictogram name="notePencil" size={25} />, label: "내 주문표" },
    { id: "account", icon: <Pictogram name="userCircle" size={25} />, label: "계정" },
  ];
  return (
    <nav aria-label="주요 메뉴" className="shrink-0 flex" style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: PAPER, paddingBottom: 12 }}>
      {items.map(({ id, label }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
            className="flex-1 flex flex-col items-center"
            style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", minHeight: 56, padding: "14px 0 6px" }}
          >
            {/*
              아이콘을 빼고 글자만 남겼다. 셋뿐인 탭이라 그림이 없어도 무엇인지
              알 수 있고, 그림.글자.색 셋으로 알리던 것을 글자 하나로 줄이면
              화면이 조용해진다. 대신 지금 탭에는 밑줄을 그어 색 말고도 표시가
              남게 한다 - 색을 못 보는 경우에도 어디에 있는지 알아야 한다.

              안 눌린 탭도 읽을 수 있어야 해서 TEXT_2 를 쓴다(TEXT_3 는 1.74:1).
            */}
            <span style={{
              fontSize: 15, fontWeight: active ? 800 : 500, letterSpacing: "-0.02em",
              color: active ? TEXT_1 : TEXT_2, fontFamily: FONT,
              borderBottom: active ? `2px solid ${RULE}` : "2px solid transparent",
              paddingBottom: 4,
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── QR Pairing ───────────────────────────────────────────────────────────────

// 회전은 CSS 로 돌린다. SVG SMIL(<animateTransform>)로 만들면
// prefers-reduced-motion 이 멈추지 못한다. SMIL 은 CSS 규칙의 대상이 아니라
// 축소 블록의 animation-duration·iteration-count 가 닿지 않는다.
// 어지럼을 느끼는 분에게 이 원은 계속 돌았다. 키프레임은 tokens.ts 에 한 번만 둔다.
const SPIN = (cx: number, cy: number) => ({
  transformBox: "view-box" as const,
  transformOrigin: `${cx}px ${cy}px`,
  animation: "kb-spin 0.9s linear infinite",
});

function SpinnerIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="27" stroke={BORDER} strokeWidth="4" />
      <path d="M32 5 A27 27 0 0 1 59 32" stroke={TEXT_1} strokeWidth="4" strokeLinecap="round" style={SPIN(32, 32)} />
    </svg>
  );
}

// 상태 화면 공통 골격 — 가운데 정렬 표식 + 제목 + 설명. 색이 아니라 배치로 위계를 만든다.
/**
 * 상태 화면의 머리.
 *
 * kicker 는 이탤릭 영문 한 줄이다. 뜻은 담지 않는다 - 읽어야 할 말은 전부 아래
 * 한글 제목에 있고, 영어를 못 읽어도 잃는 정보가 없다. aria-hidden 으로 두어
 * 스크린리더가 읽지 않는다.
 */
function StatusHero({ mark, kicker, title, desc }: {
  mark: React.ReactNode; kicker?: string; title: React.ReactNode; desc?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div aria-hidden="true" className="flex items-center justify-center" style={{ height: 72 }}>{mark}</div>
      {kicker && <span aria-hidden="true" style={{ ...KICKER, color: TEXT_2, marginTop: 18, display: "block" }}>{kicker}</span>}
      <h2 style={{ ...TYPE.display, color: TEXT_1, marginTop: kicker ? 4 : 20 }}>{title}</h2>
      {desc && <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 10 }}>{desc}</p>}
    </div>
  );
}

/**
 * 제목 오른쪽에 놓는 선 드로잉 한 점.
 *
 * 스트로크 5.5px, round cap, 배경 없음. 장식이라 aria-hidden 이고,
 * 이 그림이 없어도 화면의 뜻은 그대로다 - 뜻은 제목이 지고 있다.
 */
function GlassesSpot({ size = 76 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 152 76" fill="none" aria-hidden="true">
      <g stroke={TEXT_1} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="40" cy="44" rx="27" ry="22" />
        <ellipse cx="112" cy="44" rx="27" ry="22" />
        <path d="M67 40c5-4 13-4 18 0" />
        <path d="M13 40C13 20 24 12 34 12" />
        <path d="M139 40c0-20-11-28-21-28" />
      </g>
    </svg>
  );
}

/** 주문표 화면 — 영수증. */
function ReceiptSpot({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke={TEXT_1} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 12h52v76l-10-7-9 7-9-7-9 7-9-7-6 4z" />
        <path d="M38 36h24M38 52h24M38 66h14" />
      </g>
    </svg>
  );
}

/** 개인정보 화면 — 자물쇠. */
function LockSpot({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke={TEXT_1} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="22" y="44" width="56" height="44" rx="8" />
        <path d="M34 44V32a16 16 0 0 1 32 0v12" />
        <path d="M50 60v12" />
      </g>
    </svg>
  );
}

/** 이유 화면 — 돋보기. */
function LoupeSpot({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <g stroke={TEXT_1} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="44" cy="42" r="26" />
        <path d="M63 61l22 24" />
      </g>
    </svg>
  );
}

/** 섹션 머리의 굵은 줄. 이 디자인에서 화면을 자르는 유일한 선이다. */
function Rule({ style }: { style?: React.CSSProperties }) {
  return <div aria-hidden="true" style={{ height: 2, backgroundColor: RULE, ...style }} />;
}

function PairingConnecting() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center" style={{ paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}>
      <StatusHero mark={<SpinnerIcon />} title="키오스크에 연결하는 중" desc="잠시만 기다려 주세요" />
    </div>
  );
}

function PairingConnected({
  kioskName, expiresAt, onExpire, onSelectSheet,
}: {
  kioskName: string;
  expiresAt: number;
  onExpire: () => void;
  onSelectSheet: () => void;
}) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
  const expire = useRef(onExpire);
  // 렌더 본문에서 ref 를 건드리지 않는다. React 는 렌더를 버리거나 다시 돌릴 수 있어서,
  // 커밋되지 않은 렌더의 값이 ref 에 남을 수 있다.
  useEffect(() => { expire.current = onExpire; }, [onExpire]);

  // P0-2: claim 세션은 단명한다. 만료되면 화면도 같이 끊겨야 한다.
  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setSecs(left);
      if (left === 0) expire.current();
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="flex flex-col flex-1" style={{ padding: `32px ${GAP.screenX}px 24px` }}>
      <StatusHero
        mark={<Pictogram name="checkCircle" size={64} color={P} />}
        kicker="connected"
        title="연결되었습니다"
        desc={<span style={{ fontWeight: 600, color: TEXT_1 }}>{kioskName}</span>}
      />

      {/* 면 대신 줄로 가른다. 굵은 줄이 머리와 내용을 나누고, 아래 헤어라인이 끝을 맺는다. */}
      <div style={{ marginTop: 32, borderTop: `2px solid ${RULE}`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between gap-4" style={{ padding: "18px 0" }}>
          <div>
            <p style={{ ...TYPE.label, color: TEXT_1, marginBottom: 5 }}>세션 유효시간</p>
            <p style={{ fontSize: 13, color: TEXT_2, lineHeight: 1.5 }}>만료되면 QR을 다시 스캔해 주세요</p>
          </div>
          <span style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1, color: TEXT_1, ...NUM }}>{mm}:{ss}</span>
        </div>
      </div>

      <div className="mt-auto" style={{ paddingTop: 24 }}>
        <PrimaryBtn onClick={onSelectSheet}>주문표 선택하기</PrimaryBtn>
      </div>
    </div>
  );
}

function QrScanButton({ onScan }: { onScan: () => void }) {
  return (
    <PrimaryBtn onClick={onScan}>
      <span className="flex items-center justify-center gap-2">
        <Pictogram name="qrCode" size={21} color="white" />
        QR 다시 스캔하기
      </span>
    </PrimaryBtn>
  );
}

function PairingFailed({ reason = "유효하지 않은 QR입니다", onScan }: { reason?: string; onScan: () => void }) {
  return (
    <div className="flex flex-col flex-1" style={{ padding: `32px ${GAP.screenX}px 24px` }}>
      <StatusHero
        mark={<Pictogram name="xCircle" size={64} color={FAIL} />}
        title="연결할 수 없습니다"
        desc={reason}
      />

      <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, marginTop: 32 }}>
        <p style={{ ...TYPE.caption, color: TEXT_1 }}>
          키오스크에 부착된 QR 코드를 <strong style={{ fontWeight: 600 }}>다시 스캔</strong>해 주세요
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3" style={{ paddingTop: 24 }}>
        <QrScanButton onScan={onScan} />
        <p style={{ fontSize: 13, color: TEXT_2, textAlign: "center" }}>문제가 반복되면 매장 직원에게 도움을 요청하세요</p>
      </div>
    </div>
  );
}

function PairingExpired({ onScan }: { onScan: () => void }) {
  return (
    <div className="flex flex-col flex-1" style={{ padding: `32px ${GAP.screenX}px 24px` }}>
      <StatusHero
        mark={<Pictogram name="clockCountdown" size={64} color={WARN} />}
        title={<>연결 시간이<br />만료되었습니다</>}
        desc="안전을 위해 연결이 종료되었어요"
      />

      <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, marginTop: 32 }}>
        <p style={{ ...TYPE.caption, color: TEXT_1 }}>
          키오스크에 부착된 QR 코드를 <strong style={{ fontWeight: 600 }}>다시 스캔</strong>해 주세요
        </p>
      </div>

      <div className="mt-auto" style={{ paddingTop: 24 }}>
        <QrScanButton onScan={onScan} />
      </div>
    </div>
  );
}

function QrScannerModal({ onClose, onDetected }: { onClose: () => void; onDetected: () => void }) {
  const [scanning, setScanning] = useState(true);

  // 검은 화면을 덮어 놓기만 하고 role 도 포커스 가둠도 없었다.
  // 스크린리더로는 뒤에 있는 주문표 목록과 하단 탭이 그대로 읽히고,
  // Tab 을 누르면 보이지도 않는 곳으로 포커스가 나간다.
  const 모달 = useRef<HTMLDivElement>(null);
  useEffect(() => { 모달.current?.focus(); }, []);
  const 가두기 = 포커스가두기(모달, onClose);

  /*
   * 타이머가 둘이므로 둘 다 걷어야 한다.
   *
   * 스캐너가 떠 있는 동안에도 하단 탭은 눌린다 — 모달은 화면 영역만 덮고
   * 하단 탭은 그 바깥에 있다. 스캔이 끝난 뒤(2.5초) 800ms 안에 사용자가
   * 다른 탭으로 옮기면, 안쪽 타이머만 살아남아 언마운트된 뒤에 onDetected 가
   * 실행된다. 그러면 사용자가 QR 화면을 떠난 뒤에 claimPairing 이 나간다.
   * 화면에는 아무 표시도 안 되는데 키오스크에는 연결 요청이 남는다.
   */
  useEffect(() => {
    let detect: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      setScanning(false);
      detect = setTimeout(onDetected, 800);
    }, 2500);
    return () => {
      clearTimeout(t);
      if (detect) clearTimeout(detect);
    };
    // onDetected 는 인라인 화살표로 넘어와 매 렌더 새 함수가 된다.
    // 의존 항목에 두면 타이머가 계속 리셋되어 스캔이 끝나지 않을 수 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={모달}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="QR 코드 스캔"
      onKeyDown={가두기}
      className="absolute inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "#000", outline: "none" }}
    >
      <div className="flex items-center justify-between shrink-0" style={{ padding: `20px ${GAP.screenX}px 12px` }}>
        <AppLogo light size={24} />
        <button
          type="button"
          aria-label="QR 스캔 닫기"
          onClick={onClose}
          style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4L14 14M14 4L4 14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="relative w-64 h-64">
          <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backgroundColor: "#1C1C1E" }}>
            <div className="w-full h-full opacity-40" style={{ background: "repeating-linear-gradient(0deg,#141416 0px,#141416 2px,#232326 2px,#232326 8px)" }} />
          </div>

          {([
            { cls: "top-0 left-0",     bt: true,  br: false, bb: false, bl: true  },
            { cls: "top-0 right-0",    bt: true,  br: true,  bb: false, bl: false },
            { cls: "bottom-0 left-0",  bt: false, br: false, bb: true,  bl: true  },
            { cls: "bottom-0 right-0", bt: false, br: true,  bb: true,  bl: false },
          ] as const).map(({ cls, bt, br, bb, bl }, i) => {
            // 검은 배경 위라 P(#111) 는 보이지 않는다. 스캔 중엔 반투명 흰선, 인식되면 완전한 흰선.
            const c = scanning ? "rgba(255,255,255,0.55)" : "#FFFFFF";
            return (
              <div key={i} className={`absolute ${cls} w-8 h-8`} style={{
                borderTopWidth: bt ? 3 : 0, borderTopStyle: bt ? "solid" : "none", borderTopColor: c,
                borderRightWidth: br ? 3 : 0, borderRightStyle: br ? "solid" : "none", borderRightColor: c,
                borderBottomWidth: bb ? 3 : 0, borderBottomStyle: bb ? "solid" : "none", borderBottomColor: c,
                borderLeftWidth: bl ? 3 : 0, borderLeftStyle: bl ? "solid" : "none", borderLeftColor: c,
                borderRadius: i === 0 ? "8px 0 0 0" : i === 1 ? "0 8px 0 0" : i === 2 ? "0 0 0 8px" : "0 0 8px 0",
              }} />
            );
          })}

          {scanning && (
            <div className="absolute left-2 right-2 h-0.5 rounded-full"
              style={{ backgroundColor: "#FFFFFF", boxShadow: "0 0 10px rgba(255,255,255,0.8)", animation: "scanline 1.6s ease-in-out infinite" }} />
          )}

          {!scanning && (
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.10)" }}>
              {/*
                이 모달의 배경은 팔레트와 무관하게 늘 #000 이다. 여기에 PAPER.TEXT_1
                을 쓰면 다크에서 검은 배경에 검은 원(1.07:1)이 되어 묻힌다.
                고정 쌍(ON_DARK 면 + 검은 체크)을 쓴다. 로고는 고쳤는데 같은 모달
                안의 이 아이콘을 빠뜨렸다.
              */}
              <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: ON_DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M7 17L13 23L25 11" stroke="#111111" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}
        </div>

        <p style={{ color: "white", ...TYPE.body, fontWeight: 500, textAlign: "center", fontFamily: FONT, whiteSpace: "pre-line" }}>
          {scanning ? "키오스크의 QR 코드를\n카메라에 맞춰주세요" : "QR 코드를 인식했어요"}
        </p>
      </div>

      <div className="shrink-0 text-center" style={{ padding: `0 ${GAP.screenX}px 40px` }}>
        {/*
         * 42% 흰색은 검은 바탕에서 3.95:1 이라 13px 글자 기준(4.5:1)에 못 미쳤다.
         * 조명을 조절하라는 안내는 화면이 어두워서 안 보일 때 읽어야 하는 문장이라
         * 특히 흐리면 안 된다. 62% 는 7.8:1 이고, 위쪽 흰 안내문(21:1)보다는 여전히 조용하다.
         */}
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", fontFamily: FONT }}>
          QR 코드가 잘 보이지 않으면 조명을 조절해 주세요
        </p>
      </div>

      <style>{`
        @keyframes scanline {
          0% { top: 8px; }
          50% { top: calc(100% - 10px); }
          100% { top: 8px; }
        }
      `}</style>
    </div>
  );
}

// 스캔을 그만뒀을 때 돌아오는 자리. 예전에는 이 화면이 없어서 스캔 창에
// 닫기 버튼을 숨겨 두었고(hideClose), 한번 들어가면 하단 탭으로 빠져나가는 것 말고는
// 나올 방법이 없었다. 그만두는 것도 사용자가 할 수 있어야 하는 선택이다.
function PairingIdle({ onScan }: { onScan: () => void }) {
  return (
    <div className="flex flex-col flex-1" style={{ padding: `32px ${GAP.screenX}px 24px` }}>
      <StatusHero
        mark={<Pictogram name="qrCode" size={64} color={TEXT_2} />}
        title={<>QR 코드를<br />찍어 주세요</>}
        desc="키오스크 화면이나 기계에 붙어 있어요"
      />

      <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, marginTop: 32 }}>
        <p style={{ ...TYPE.caption, color: TEXT_1 }}>
          찍지 않아도 <strong style={{ fontWeight: 600 }}>내 주문표</strong>에서 저장한 조건을 먼저 확인할 수 있어요
        </p>
      </div>

      <div className="mt-auto" style={{ paddingTop: 24 }}>
        <QrScanButton onScan={onScan} />
      </div>
    </div>
  );
}

function QrScreen({ onPaired, initialPhase = "scan", connected = null }: {
  onPaired: (pairingId: string, expiresAt: number, kioskName: string) => void;
  // 연결이 만료돼서 되돌아온 경우에는 스캐너가 아니라 만료 안내부터 보여 준다.
  // 스캐너로 바로 보내면 사용자는 자기가 왜 여기 왔는지 알 수 없다.
  initialPhase?: "scan" | "expired";
  // 이미 연결돼 있으면 그 상태를 그대로 보여 준다. 다시 찍으라고 하지 않는다.
  connected?: { pairingId: string; expiresAt: number; kioskName: string } | null;
}) {
  const [phase, setPhase] = useState<"scan" | "idle" | PairingState>(connected ? "connected" : initialPhase);
  const [pairing, setPairing] = useState<PairingResult | null>(
    connected ? { pairingId: connected.pairingId, expiresAt: connected.expiresAt, kioskName: connected.kioskName } : null,
  );

  // 서버가 왜 실패했는지 알려 줬으면 그걸 그대로 보여 준다.
  // 예전에는 버리고 늘 "유효하지 않은 QR입니다" 라고 했다. 서버가 죽었을 때도 그랬다.
  const [failReason, setFailReason] = useState<string | undefined>(undefined);
  const handleScanned = () => {
    setPhase("connecting");
    setFailReason(undefined);
    api.claimPairing("kb_demo")
      .then((r) => { setPairing(r); setPhase("connected"); })
      .catch((e: KioBridgeError) => {
        if (e?.code === "CLAIM_EXPIRED") { setPhase("expired"); return; }
        setFailReason(e?.message);
        setPhase("failed");
      });
  };
  const handleRescan = () => setPhase("scan");

  if (phase === "scan") {
    return <QrScannerModal onClose={() => setPhase("idle")} onDetected={handleScanned} />;
  }

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `20px ${GAP.screenX}px 0` }}>
        <AppLogo size={26} />
      </div>

      {/*
       * overflow-hidden 이 아니라 overflow-y-auto 다.
       * 이 안의 패널들(연결중·연결됨·실패·만료)은 아래 버튼을 mt-auto 로 바닥에 붙인다.
       * 그릇이 hidden 이면 내용이 커졌을 때 그 버튼이 잘려 나가고, 스크롤도 안 되니
       * 손으로는 닿을 방법이 없어진다. 앱이 주는 큰 글씨(1.18배)까지는 넘치지 않지만
       * 사용자가 브라우저·OS 글씨 크기를 더 키우면 1.6배 근처부터 넘친다(측정값 102px).
       * auto 로 두면 넘칠 때만 스크롤이 생기고, 넘치지 않으면 지금과 똑같이 보인다.
       */}
      <div className="flex-1 flex flex-col overflow-y-auto" style={{ minHeight: 0 }} role="status" aria-live="polite">
        {phase === "idle" && <PairingIdle onScan={handleRescan} />}
        {phase === "connecting" && <PairingConnecting />}
        {phase === "connected" && pairing && (
          <PairingConnected
            kioskName={pairing.kioskName}
            expiresAt={pairing.expiresAt}
            onExpire={() => setPhase("expired")}
            onSelectSheet={() => onPaired(pairing.pairingId, pairing.expiresAt, pairing.kioskName)}
          />
        )}
        {phase === "failed" && <PairingFailed reason={failReason} onScan={handleRescan} />}
        {phase === "expired" && <PairingExpired onScan={handleRescan} />}
      </div>
    </div>
  );
}

// ─── Account ──────────────────────────────────────────────────────────────────

/**
 * 계정 화면.
 *
 * 게스트(로그인 없이 시작)일 때도 모든 기능이 그대로 열려 있어야 한다.
 * 이 화면이 하는 일은 두 가지뿐이다 — 저장된 것을 지우는 길과, 원하면 로그인하는 길.
 */
function AccountScreen({
  name, guest, onLogout, onLogin, onClearLocal, onSheets, onA11y, onPrivacy,
}: {
  name: string; guest: boolean;
  onLogout: () => void; onLogin: () => void; onClearLocal: () => void;
  onSheets: () => void; onA11y: () => void; onPrivacy: () => void;
}) {
  // 목록에 올린 항목은 전부 실제로 열린다. 눌러도 아무 일이 없는 줄은 두지 않는다.
  const items = guest
    ? [
        { label: "저장된 주문표 관리", sub: "이번 이용에만 쓰는 메뉴 주문표예요", action: onSheets, danger: false },
        { label: "접근성 설정", sub: "큰 글씨", action: onA11y, danger: false },
        { label: "개인정보 안내", sub: "무엇을 저장하고 무엇을 저장하지 않는지", action: onPrivacy, danger: false },
        { label: "이 기기에서 정보 지우기", sub: "지금까지 입력한 내용을 모두 지워요", action: onClearLocal, danger: true },
      ]
    : [
        { label: "저장된 주문표 관리", sub: "내 메뉴 주문표를 확인하고 수정해요", action: onSheets, danger: false },
        { label: "접근성 설정", sub: "큰 글씨", action: onA11y, danger: false },
        { label: "개인정보 안내", sub: "무엇을 저장하고 무엇을 저장하지 않는지", action: onPrivacy, danger: false },
        { label: "이 기기에서 정보 지우기", sub: "저장해 둔 내용을 모두 지워요", action: onClearLocal, danger: true },
        { label: "로그아웃", sub: "", action: onLogout, danger: true },
      ];
  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `20px ${GAP.screenX}px 24px` }}>
        <AppLogo size={26} />
        <div className="flex items-center gap-4" style={{ marginTop: 28 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", backgroundColor: guest ? SURFACE : RULE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {guest
              ? <Pictogram name="handPointing" size={24} color={TEXT_2} />
              : <span style={{ fontFamily: SERIF, fontSize: 24, color: PAPER }}>{name ? name[0] : "?"}</span>}
          </div>
          <div>
            <p style={{ ...TYPE.title, color: TEXT_1 }}>{guest ? "게스트로 이용 중" : `${name || "사용자"}님`}</p>
            <p style={{ fontSize: 14, color: TEXT_2, marginTop: 2 }}>
              {guest ? "로그인 없이 모든 기능을 쓰고 있어요" : "키오브릿지 회원"}
            </p>
          </div>
        </div>

        {/* 로그인은 끝까지 선택이다. 안내만 하고 막지 않는다. */}
        {guest && (
          <button
            type="button"
            onClick={onLogin}
            style={{
              marginTop: 20, width: "100%", minHeight: 52, borderRadius: RADIUS.button,
              background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT_2,
              fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
            }}
            className="flex items-center justify-center gap-2"
          >
            <Pictogram name="userCircle" size={18} color={TEXT_2} />
            다음에도 불러오려면 로그인 (선택)
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}>
        <div style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, overflow: "hidden" }}>
          {items.map(({ label, sub, action, danger }, idx) => (
            <button
              key={label}
              type="button"
              onClick={action}
              style={{
                width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "17px 20px", textAlign: "left", cursor: "pointer", fontFamily: FONT,
                backgroundColor: "transparent", border: "none",
                borderTop: idx > 0 ? `1px solid ${BORDER}` : "none",
              }}
            >
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: danger ? FAIL : TEXT_1, letterSpacing: "-0.01em" }}>{label}</p>
                {sub && <p style={{ fontSize: 13, color: TEXT_2, marginTop: 3 }}>{sub}</p>}
              </div>
              {!danger && <ChevronLeft size={16} aria-hidden="true" style={{ color: TEXT_3, transform: "rotate(180deg)" }} />}
            </button>
          ))}
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: TEXT_2, marginTop: 24, marginBottom: 16 }}>버전 1.0.0</p>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/** 계정 화면에서 여는 하위 화면들의 공통 머리. */
function SubScreenHeader({ title, kicker, spot, onBack }: {
  title: React.ReactNode; kicker?: string; spot?: React.ReactNode; onBack: () => void;
}) {
  return (
    <div className="shrink-0" style={{ padding: `14px ${GAP.screenX}px 0` }}>
      <BackButton onClick={onBack} />
      {kicker && <span aria-hidden="true" style={{ ...KICKER, color: TEXT_2, marginTop: 22, display: "block" }}>{kicker}</span>}
      <div className="flex items-end justify-between" style={{ gap: 12 }}>
        <h1 style={{ ...TYPE.display, color: TEXT_1, marginTop: kicker ? 2 : 12, flex: 1 }}>{title}</h1>
        {/* 제목 오른쪽의 선 드로잉 한 점. 장식이라 스크린리더에서 뺀다. */}
        {spot && <span aria-hidden="true" style={{ flexShrink: 0, marginBottom: 4 }}>{spot}</span>}
      </div>
      <Rule style={{ marginTop: 18 }} />
    </div>
  );
}

/** 켜고 끄는 줄 하나. 라벨을 눌러도 바뀌도록 button 하나로 감싼다. */
function ToggleRow({
  label, sub, on, onToggle,
}: {
  label: string; sub: string; on: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      style={{
        width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 16, padding: "18px 0", textAlign: "left", cursor: "pointer", fontFamily: FONT,
        backgroundColor: "transparent", border: "none",
      }}
    >
      <span>
        <span style={{ display: "block", fontSize: 17, fontWeight: 700, color: TEXT_1, letterSpacing: "-0.02em" }}>{label}</span>
        <span style={{ display: "block", fontSize: 13, color: TEXT_2, marginTop: 4 }}>{sub}</span>
      </span>
      {/* 색만으로 상태를 알리지 않는다 — 켜짐일 때는 체크 표시도 함께 둔다. */}
      <span
        aria-hidden="true"
        style={{
          width: 54, height: 32, borderRadius: 999, flexShrink: 0, position: "relative",
          backgroundColor: on ? RULE : TOGGLE_OFF, transition: "background-color 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute", top: 3, left: on ? 25 : 3, width: 26, height: 26, borderRadius: "50%",
            backgroundColor: PAPER, boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transition: "left 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {on && <Check size={14} strokeWidth={3} style={{ color: RULE }} />}
        </span>
      </span>
    </button>
  );
}

/** 도움설정 중 켜고 끄는 칸만. language 는 스위치가 아니라 고르는 값이라 뺀다. */
type 스위치칸 = { [K in keyof 도움설정]: 도움설정[K] extends boolean ? K : never }[keyof 도움설정];

interface 도움항목 {
  key: 스위치칸;
  label: string;
  sub: string;
  /** 있으면 이게 참일 때만 보여 준다. 못 하는 것을 스위치로 내밀지 않는다. */
  될때만?: () => boolean;
}

/*
 * 일곱 항목을 여기 한 곳에만 둔다.
 *
 * 두 화면이 이걸 쓴다 — 가입 직후의 설정 화면(SetupScreen)과 계정 화면에서 여는
 * 접근성 화면(AccessibilityScreen). 각자 목록을 갖고 있으면 한쪽만 고치는 날이 오고,
 * 그러면 같은 스위치가 두 자리에서 다른 말을 하게 된다.
 *
 * 킷 계약이 요구하는 일곱 가지를 다 묻는다. 예전에는 '큰 글씨' 하나만 묻고 나머지
 * 여섯을 false 로 박아 서버에 보냈다 — 백엔드는 받을 준비가 돼 있었는데 화면이 안
 * 물어서 늘 "아무 도움도 필요 없음" 으로 나가고 있었다.
 */

/** 켜면 이 앱이 실제로 무언가를 한다. 무엇을 하는지 sub 에 그대로 적는다. */
const 바로바꾸는것: 도움항목[] = [
  { key: "largeText", label: "큰 글씨", sub: "앱 전체의 글씨와 버튼을 크게 봐요" },
  { key: "highContrast", label: "고대비", sub: "글씨와 배경의 차이를 더 뚜렷하게 해요" },
  /*
   * 이 앱이 화면 글을 소리로 읽어 주고, 서버로는 preferredInput: "VOICE" 로 나간다.
   * 두 가지를 다 하는 유일한 항목이라 이쪽 무리에 둔다.
   *
   * 브라우저가 speechSynthesis 를 안 주면 이 줄을 아예 안 보여 준다(쓸수있는것).
   * 켰는데 아무 소리도 안 나면 사용자는 앱이 고장 났다고 생각한다.
   */
  { key: "voiceGuide", label: "소리로 읽어 주기", sub: "화면에 나온 안내를 소리로 읽어 드려요", 될때만: 소리를낼수있나 },
  { key: "simpleSteps", label: "쉬운 단계", sub: "이유 화면을 건너뛰고 바로 확인 화면으로 가요" },
  { key: "mobilitySupport", label: "시간 여유", sub: "연결 시간이 지나도 보던 화면을 멋대로 닫지 않아요" },
  { key: "staffAssistancePreferred", label: "직원 도움", sub: "승인 화면에도 직원에게 보여 달라는 안내를 띄워요" },
];
/** 켜도 이 앱 화면은 그대로다. 키오스크로 전해지기만 한다. */
const 전해드릴것: 도움항목[] = [
  { key: "visualGuidance", label: "그림 안내", sub: "글보다 그림으로 알려 달라고 전해요" },
  // '소리 대신 화면' 은 소리 안내를 못 듣는 분의 항목이다. 위의 '소리로 읽어 주기' 와
  // 반대되는 것이 아니라 서로 다른 사정이라, 둘 다 켤 수 있게 둔다.
  { key: "hearingSupport", label: "소리 대신 화면", sub: "소리 안내를 못 들어요. 키오스크에 그렇게 전해요" },
];

/** 이 브라우저에서 실제로 되는 항목만 남긴다. */
const 쓸수있는것 = (항목들: 도움항목[]): 도움항목[] => 항목들.filter((r) => !r.될때만 || r.될때만());

/**
 * 늘 피해야 하는 것을 고르는 줄.
 *
 * 주문표에도 알레르기 축이 있는데 여기서 또 묻는 이유 — **알레르기는 주문마다
 * 달라지는 값이 아니라 그 사람에 대한 사실**이다. 주문표에만 두면 새 주문표를
 * 만들 때마다 다시 골라야 하고, 한 번 빠뜨리면 그 주문표로 주문할 때 안 걸러진다.
 * 빠뜨려도 되는 값이 아니라서 한 번 묻고 계속 쓴다.
 *
 * 서버로 나갈 때 주문표 쪽과 **합쳐진다**(canonical.ts). 덮지 않으므로 어느 쪽을
 * 빠뜨려도 걸러지는 후보가 줄지는 않는다.
 *
 * 여섯뿐인 이유는 킷 계약이 여섯만 알아서다. 표에 없는 것을 고르게 하면
 * UNKNOWN 으로 나가고 서버가 주문을 아예 막는다.
 */
function 알레르기고르기({ 고른것, on뒤집기 }: { 고른것: AllergenId[]; on뒤집기: (id: AllergenId) => void }) {
  return (
    <div>
      <h2 style={{ ...TYPE.label, color: TEXT_2, marginBottom: 2 }}>못 드시는 것</h2>
      <p style={{ fontSize: 12, color: TEXT_2, marginBottom: 8, lineHeight: 1.6 }}>
        고르시면 그게 들어간 메뉴는 추천에서 아예 빼요. 없으시면 안 고르셔도 돼요.
      </p>
      <div className="flex flex-wrap" style={{ gap: 6 }} role="group" aria-label="못 드시는 것">
        {알레르기목록.map(({ id, label }) => (
          <Chip
            key={id}
            label={label}
            selected={고른것.includes(id)}
            onClick={() => on뒤집기(id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 안내받고 싶은 언어를 고르는 줄.
 *
 * 스위치가 아니라 넷 중 하나라서 칩으로 둔다. 이름은 그 언어로 적는다 —
 * 한국어를 못 읽는 분이 자기 언어를 찾아야 하는 목록인데 "영어" 라고 적어 두면
 * 정작 그 줄을 찾아야 할 사람이 못 읽는다.
 *
 * **이 앱 화면은 안 바뀐다.** 키오스크에 전하기만 한다. 그래서 '전해 드려요'
 * 무리에 두고, 화면이 안 바뀐다는 말을 위에 적어 둔다 — 골랐는데 아무 일도
 * 안 일어나면 사용자는 앱이 고장 났다고 생각한다.
 */
function 언어고르기({ 고른것, on바꾸기 }: { 고른것: 언어코드; on바꾸기: (v: 언어코드) => void }) {
  return (
    <div style={{ paddingTop: 16 }}>
      <span style={{ display: "block", fontSize: 17, fontWeight: 700, color: TEXT_1, letterSpacing: "-0.02em" }}>
        안내 언어
      </span>
      <span style={{ display: "block", fontSize: 13, color: TEXT_2, marginTop: 4, marginBottom: 10 }}>
        키오스크에 이 언어로 안내해 달라고 전해요
      </span>
      <div className="flex flex-wrap" style={{ gap: 6 }} role="radiogroup" aria-label="안내 언어">
        {언어목록.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={고른것 === code}
            lang={code}
            onClick={() => on바꾸기(code)}
            style={{
              minHeight: 44, padding: "10px 18px", borderRadius: RADIUS.pill,
              fontSize: 15, fontWeight: 700, fontFamily: FONT, letterSpacing: "-0.01em",
              backgroundColor: 고른것 === code ? RULE : CANVAS,
              color: 고른것 === code ? PAPER : TEXT_CHIP,
              border: "none", cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 머리카락 굵기 선으로 이어 붙인 스위치 묶음. 두 화면이 같은 모양으로 쓴다. */
function 도움목록({ 항목들, 설정, onChange }: {
  항목들: 도움항목[];
  설정: 도움설정;
  onChange: (한칸: Partial<도움설정>) => void;
}) {
  return (
    <div style={{ borderTop: `1px solid ${BORDER}` }}>
      {항목들.map((r, i) => (
        <div key={r.key} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
          <ToggleRow
            label={r.label}
            sub={r.sub}
            on={설정[r.key]}
            onToggle={() => onChange({ [r.key]: !설정[r.key] })}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 가입 직후 한 번 묻는 도움 설정. 회원가입 → 호칭 → **여기** → 환영합니다.
 *
 * 예전에는 계정 화면 깊숙한 곳에만 있었다. 큰 글씨가 필요한 사람이 그걸 찾으려면
 * 이미 작은 글씨로 세 번을 눌러야 했다 — 도움이 필요한 사람일수록 도달하기 어려운
 * 자리에 도움을 두고 있었다.
 *
 * 스위치는 **누르는 즉시 적용된다.** 저장 버튼을 따로 두지 않는 이유가 이것이다.
 * 큰 글씨를 켜 보고 "이 정도면 읽히는지" 를 눈으로 확인한 뒤 넘어가야 뜻이 있다.
 * 눌러 놓고 저장을 눌러야 반영되면, 그 사이에는 아무 일도 안 일어나서 사용자는
 * 자기가 무엇을 골랐는지 모른 채 확인을 누르게 된다.
 *
 * 그래서 아래에도 버튼이 하나뿐이다. '건너뛰기' 와 '저장하기' 를 나란히 두면
 * 둘이 똑같은 일(다음 화면으로 가기)을 하게 되고, 무엇을 눌러야 하는지 묻는
 * 화면이 하나 더 생긴다. 이 화면은 통째로 선택이라 그 말을 글로 적는다.
 */
function SetupScreen({ 설정, onChange, 알레르기, on알레르기, onNext, onBack }: {
  설정: 도움설정;
  onChange: (한칸: Partial<도움설정>) => void;
  알레르기: AllergenId[];
  on알레르기: (id: AllergenId) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0 flex items-center" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
          <ProgressBar step={3} total={3} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `28px ${GAP.screenX}px 24px` }}>
        <CenterHeadline
          kicker="accessibility"
          title={<>필요한 도움이<br />있으신가요?</>}
          desc="켜는 즉시 이 화면이 바로 바뀌어요. 안 켜셔도 괜찮아요"
          spot={<GlassesSpot />}
        />

        <p style={{ fontSize: 13, color: TEXT_2, margin: "24px 0 20px", lineHeight: 1.7, textAlign: "center" }}>
          나중에 계정 화면에서 언제든 바꿀 수 있어요.
        </p>

        <h2 style={{ ...TYPE.label, color: TEXT_2, marginBottom: 2 }}>이 앱이 바로 바꿔요</h2>
        <도움목록 항목들={쓸수있는것(바로바꾸는것)} 설정={설정} onChange={onChange} />

        <h2 style={{ ...TYPE.label, color: TEXT_2, marginTop: 24 }}>키오스크에 전해 드려요</h2>
        <p style={{ fontSize: 12, color: TEXT_2, marginBottom: 8, lineHeight: 1.6 }}>
          앱 화면은 그대로예요. 지금은 전해 주기만 해요.
        </p>
        <도움목록 항목들={쓸수있는것(전해드릴것)} 설정={설정} onChange={onChange} />
        <언어고르기 고른것={설정.language} on바꾸기={(v) => onChange({ language: v })} />

        {/*
          알레르기는 '도움 설정' 이 아니라 안전에 관한 값이라 선 아래에 따로 둔다.
          스위치 묶음에 섞으면 켜고 끄는 편의 항목처럼 읽힌다.
        */}
        <div style={{ marginTop: 28, paddingTop: 24, borderTop: `2px solid ${RULE}` }}>
          <알레르기고르기 고른것={알레르기} on뒤집기={on알레르기} />
        </div>
      </div>

      <div style={{ padding: `0 ${GAP.screenX}px 32px` }}>
        <PrimaryBtn onClick={onNext}>계속하기</PrimaryBtn>
      </div>
    </div>
  );
}

/**
 * 접근성 설정. 계정 화면에서 언제든 다시 연다.
 *
 * 두 무리로 나눠 적는다.
 *
 *   이 앱이 바로 바꾸는 것   큰 글씨 · 고대비 · 쉬운 단계 · 시간 여유 · 직원 도움
 *   키오스크에 전해 드릴 것   그림 안내 · 소리 대신 화면
 *
 * 뒤의 둘은 이 앱 화면을 바꾸지 않는다. 켰는데 아무 일도 안 일어나면 사용자는
 * 앱이 고장 났다고 생각하므로, 무엇을 하는 값인지 제목으로 먼저 밝힌다.
 * 바꾸지 않는 것을 바꾼다고 말하지 않는다.
 */
function AccessibilityScreen({ 설정, onChange, 알레르기, on알레르기, onBack }: {
  설정: 도움설정;
  onChange: (한칸: Partial<도움설정>) => void;
  /** 가입 직후에 한 번 묻지만 여기서도 고칠 수 있어야 한다 — 한 번 묻고 끝나면 못 고친다. */
  알레르기: AllergenId[];
  on알레르기: (id: AllergenId) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full kb-paper">
      <SubScreenHeader
        kicker="accessibility"
        title={<>보기 편하게<br />바꿔드릴게요</>}
        spot={<GlassesSpot />}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `12px ${GAP.screenX}px 24px` }}>
        {/*
          설명은 전부 맨 위에 모아 둔다.
          예전에는 스위치 사이사이와 맨 아래에 문단이 흩어져 있었다. 스위치를 켜러
          온 사람이 글에 걸려 넘어지고, 어디까지가 설명이고 어디부터 켤 것인지
          한눈에 안 들어왔다. 읽을 것은 먼저 끝내고, 그다음부터는 켜기만 한다.

          다섯 문단이던 것을 둘로 줄였다. 지운 것이 아니라 합쳤다 -
          없어지면 안 되는 말들이다(어디까지 남는지 · 직원 도움).
        */}
        {/*
          예전에는 "새로고침하면 처음으로 돌아가요" 라고 적혀 있었다. 이제는 안 돌아간다.
          도움이 필요해서 켠 설정이 새로고침 한 번에 꺼지던 것을 고쳤으니, 문장도 같이
          고친다 - 안 고치면 켜 놓고도 꺼진 줄 알고 다시 들어와 확인하게 된다.
        */}
        <p style={{ fontSize: 13, color: TEXT_2, marginBottom: 10, lineHeight: 1.7 }}>
          필요하신 것만 켜 주세요. 켠 것은 이 기기에만 남고, 이 창을 닫으면 처음으로 돌아가요.
        </p>
        <p style={{ fontSize: 13, color: TEXT_2, marginBottom: 20, lineHeight: 1.7 }}>
          이 앱은 원래 큰 버튼과 또렷한 대비로 만들었고, 소리로만 알리는 것은 하나도 없어요.
          어려우면 이 화면을 직원에게 보여 주세요.
        </p>

        <h2 style={{ ...TYPE.label, color: TEXT_2, marginBottom: 2 }}>이 앱이 바로 바꿔요</h2>
        <도움목록 항목들={쓸수있는것(바로바꾸는것)} 설정={설정} onChange={onChange} />

        {/*
          이 한 줄은 문단이 아니라 제목의 일부다. 스위치와 제목 사이에 본문이
          끼면 다시 '글 중간에 스위치' 가 된다. 그렇다고 지울 수는 없다 -
          이 둘은 켜도 앱 화면이 안 바뀌는데, 그 말을 안 하면 화면이 거짓이 된다.
          (ProfileMapper 는 값을 옮기기만 하고 RecommendationEngineService 는
          profile 을 읽지 않는다. 지금은 정말로 전해 주기만 한다.)
        */}
        <h2 style={{ ...TYPE.label, color: TEXT_2, marginTop: 24 }}>키오스크에 전해 드려요</h2>
        {/*
          TEXT_3 를 쓸 뻔했다. 제목보다 낮춰 보이려고 골랐는데 tokens.ts 에
          "글자 금지" 라고 적어 둔 값이다 - 흰 배경에서 1.74:1 이라 읽으라고
          둔 문장이 사실상 안 보인다. 하필 접근성 화면에서 그럴 뻔했다.

          낮춰 보이는 것은 색이 아니라 자리와 크기로 만든다. 색은 본문용
          TEXT_2(흰 배경 5.30:1)를 쓴다.
        */}
        <p style={{ fontSize: 12, color: TEXT_2, marginBottom: 8, lineHeight: 1.6 }}>
          앱 화면은 그대로예요. 지금은 전해 주기만 해요.
        </p>
        <도움목록 항목들={쓸수있는것(전해드릴것)} 설정={설정} onChange={onChange} />
        <언어고르기 고른것={설정.language} on바꾸기={(v) => onChange({ language: v })} />

        <div style={{ marginTop: 28, paddingTop: 24, borderTop: `2px solid ${RULE}` }}>
          <알레르기고르기 고른것={알레르기} on뒤집기={on알레르기} />
        </div>
      </div>
    </div>
  );
}

/**
 * 무엇을 저장하고 무엇을 저장하지 않는지.
 *
 * 약관 문구를 그대로 옮기지 않는다. 이 앱이 실제로 하는 일만 사용자의 말로 적는다.
 */
const 개인정보항목 = (guest: boolean): { title: string; body: string }[] => {
  const rows: { title: string; body: string }[] = [
    {
      title: "저장하는 것",
      body: guest
        ? "메뉴 주문표에 적어 두신 내용(예: 포장, 매운맛, 순살, 종이컵)만 저장해요. 사람이 읽는 말 그대로예요. 지금은 이 기기 안에만 있어요. 실수로 새로고침해도 다시 적지 않으셔도 되게 이 창 안에 남겨 두고, 창을 닫으면 지워요."
        // 전부 올라간다고 적으면 사실이 아니다. 장소를 안 고른 주문표는 서버가
        // 받아 주지 않아서(place 가 필수) 이 기기에만 남는다.
        : "메뉴 주문표에 적어 두신 내용(예: 포장, 매운맛, 순살, 종이컵)만 저장해요. 사람이 읽는 말 그대로예요. 로그인하고 계셔서, 장소를 정해 두신 주문표는 서버에도 올라가요 — 다음에 로그인하면 다시 불러오기 위해서예요. 장소를 안 고르신 주문표는 이 기기에만 있어요.",
    },
    {
      title: "저장하지 않는 것",
      body: "실제 이름·주소·전화번호·주민등록번호는 받지도, 저장하지도 않아요. 결제 정보도 다루지 않아요. 부르는 호칭은 화면에 띄우는 데만 쓰고 이 기기 밖으로 나가지 않아요.",
    },
    {
      title: "로그인은 어떻게 하나요",
      // 예전에는 "새로고침하면 풀립니다" 라고 적혀 있었다. 이제는 안 풀린다 —
      // 문장을 같이 안 고치면 화면이 거짓말을 하게 된다.
      body: "직접 지으신 아이디와 비밀번호만 받아요. 실제 이름이나 전화번호는 묻지 않아요. 비밀번호는 서버에서 알아볼 수 없는 형태로 바꿔 저장하고, 이 앱은 적으신 비밀번호를 어디에도 남기지 않아요. 로그인 상태는 새로고침해도 그대로지만, 이 창을 닫으면 풀립니다.",
    },
    {
      title: "키오스크에 넘기는 것",
      body: "QR로 연결할 때는 이번 주문에만 쓰는 짧은 연결 표만 오가요. 시간이 지나면 저절로 만료돼요.",
    },
    {
      title: "지우는 방법",
      // 서버에 지우기 경로가 아직 없다. 지운다고 적어 두면 그 문장이 거짓이 된다.
      // 주문표만이 아니라 키오스크에 보낸 승인·거절 기록도 서버에 남는다.
      body: guest
        ? "지금은 로그인 없이 쓰고 계셔서 이 창을 닫으면 이 기기에 남지 않아요. 바로 지우시려면 계정 화면의 ‘이 기기에서 정보 지우기’를 눌러 주세요. 다만 키오스크에 보낸 주문 기록은 서버에 남아요 — 아직 지우는 길이 없어서요."
        // 둘을 뭉뚱그려 "다 지워져요" 라고 쓰면 그게 거짓말이 된다.
        // 주문표는 지워지고(팀 #79 의 DELETE), 주문 기록은 여전히 남는다.
        : "계정 화면의 ‘이 기기에서 정보 지우기’를 누르면 이 기기에 있는 내용이 모두 사라지고, 서버에 올라간 주문표도 함께 지워요. 서버 쪽이 잘 안 되면 그때 화면으로 알려 드리고 다시 시도하실 수 있어요. 다만 키오스크에 보낸 주문 기록은 서버에 남아요 — 그건 아직 지우는 길이 없어서요.",
    },
  ];
  return rows;
};

/** 같은 내용을 개인정보 화면과 가입 화면 두 곳에서 쓴다. 한쪽만 고치는 날이 없도록 한 곳에 둔다. */
function PrivacyRows({ guest }: { guest: boolean }) {
  return (
    <>
      {개인정보항목(guest).map(({ title, body }) => (
        <section key={title} style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: "16px 18px", marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: "-0.01em" }}>{title}</h2>
          <p style={{ fontSize: 14, color: TEXT_2, marginTop: 6, lineHeight: 1.65 }}>{body}</p>
        </section>
      ))}
      <p style={{ fontSize: 13, color: TEXT_2, marginTop: 12, lineHeight: 1.7 }}>
        이 앱은 주문을 장바구니에 담는 데까지만 도와드려요. 결제는 키오스크에서 직접 하시면 돼요.
      </p>
    </>
  );
}

function PrivacyScreen({ guest, onBack }: { guest: boolean; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full kb-paper">
      <SubScreenHeader
        kicker="privacy"
        title={<>무엇을 남기고<br />무엇을 안 남기나요</>}
        spot={<LockSpot />}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `12px ${GAP.screenX}px 24px` }}>
        <PrivacyRows guest={guest} />
      </div>
    </div>
  );
}

// ─── Order Confirm ────────────────────────────────────────────────────────────

function ConfirmRow({
  label, value, large = false, changed = false, changeNote,
}: {
  label: string; value: string; large?: boolean; changed?: boolean; changeNote?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 14, fontWeight: 400, color: TEXT_2, minWidth: 60, flexShrink: 0 }}>{label}</span>
      <div className="flex items-center gap-2 justify-end flex-wrap" style={{ justifyContent: "flex-end" }}>
        {changed ? (
          <>
            <span style={{ fontSize: 16, textDecoration: "line-through", color: TEXT_2 }}>{value}</span>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, backgroundColor: FAIL_BG, color: FAIL }}>
              {changeNote ?? "오늘은 제공되지 않아요"}
            </span>
          </>
        ) : large ? (
          <span style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1, color: TEXT_1, textAlign: "right", ...NUM }}>{value}</span>
        ) : (
          <span style={{ ...TYPE.bodyBold, color: TEXT_1, textAlign: "right" }}>{value}</span>
        )}
      </div>
    </div>
  );
}

function ConfirmCard({ children, badge, badgeTone = "success", photo }: {
  children: React.ReactNode; badge?: string;
  // 배지가 늘 초록 체크였다. "확실하지 않아요" 같은 문구가 성공 배지를 달고 나오면
  // 색과 아이콘으로 상태를 알린다는 원칙이 여기서만 거꾸로 작동한다.
  badgeTone?: "success" | "caution" | "neutral";
  photo?: string | null;
}) {
  const 배지색 = badgeTone === "success"
    ? { bg: SURFACE, fg: TEXT_1, icon: "checkCircle" as const }
    : badgeTone === "caution"
      ? { bg: WARN_BG, fg: WARN, icon: "warning" as const }
      // neutral 의 바탕을 SURFACE 로 두면 카드 바탕과 같은 색이라 띠가 배경에 묻힌다.
      // 배지로 읽히지 않으면 배지가 아니다. CANVAS 는 한 톤 어두워서 경계가 보인다.
      : { bg: CANVAS, fg: TEXT_2, icon: "notePencil" as const };
  return (
    <div style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, overflow: "hidden" }}>
      {/* 키오스크가 오늘 걸어 둔 메뉴 사진. 담기 전 마지막 확인 화면이라 크게 둔다.
          글자를 읽기 어려운 분도 "내가 시키려던 그것"인지 한눈에 알아볼 수 있어야 한다.
          카탈로그에 사진이 없으면 자리를 비운다. */}
      {photo && (
        <img src={photo} alt="" aria-hidden="true" style={{ width: "100%", height: 132, objectFit: "cover", display: "block" }} />
      )}
      <div data-confirm-body style={{ padding: "6px 20px" }}>{children}</div>
      {badge && (
        <div style={{ padding: "13px 20px", backgroundColor: 배지색.bg, display: "flex", alignItems: "center", gap: 8 }}>
          <Pictogram name={배지색.icon} size={17} color={배지색.fg} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 배지색.fg }}>{badge}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 추천 이유.
 *
 * 왜 이걸 골랐는지 사용자의 말로 밝힌다. 심사 규칙상 최소 한 줄은 있어야 하고,
 * "쓴 정보"와 "뺀 이유"를 같이 보여 준다 — 무엇이 빠졌는지 모르면 확인이 아니다.
 * 색만으로 구분하지 않도록 두 종류에 서로 다른 픽토그램을 붙인다.
 */
/*
 * 이유 한 줄의 겉모습.
 *
 * 종류가 셋이라 삼항으로 가르면 어느 가지가 무엇인지 안 보인다. 표로 모은다.
 * 색만으로 알리지 않으므로 말머리 글자가 본체이고 그림은 거든다.
 */
const 이유표시 = {
  // 초록을 여기 두면 이유 목록이 초록으로 늘어선다. 초록은 담기 성공 체크에만 남긴다.
  used:     { 말머리: "반영: ", 그림: "checkCircle" as const, 색: TEXT_1 },
  unmet:    { 말머리: "못 맞춤: ", 그림: "warning" as const, 색: WARN },
  excluded: { 말머리: "제외: ", 그림: "warning" as const, 색: WARN },
};

function ReasonList({ reasons, 제목 = "이 메뉴를 고른 이유" }: { reasons?: RecommendationReason[]; 제목?: string }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <section
      aria-label={제목}
      style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: "16px 18px" }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, color: TEXT_1, marginBottom: 10 }}>
        {제목}
      </h3>
      <ul style={{ display: "flex", flexDirection: "column", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>
        {reasons.map((r) => (
          <li key={r.text} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: 2, display: "flex" }}>
              <Pictogram
                name={이유표시[r.kind].그림}
                size={16}
                color={이유표시[r.kind].색}
              />
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.6, color: TEXT_1 }}>
              {/* 색을 못 보는 경우에도 종류를 알 수 있게 말머리를 글자로 붙인다. */}
              <b style={{ fontWeight: 700 }}>{이유표시[r.kind].말머리}</b>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 이유만 보여 주는 단계. 확인 카드 앞에 온다.
 *
 * 예전에는 확인 카드 아래에 이유가 붙어 있었다. 그러면 조건표·후보 목록·이유가
 * 한 화면에 다 쌓여서, 이유를 읽으려면 스크롤을 내려야 했다. 승인하기 전에
 * 꼭 읽어야 할 것이 가장 읽기 어려운 자리에 있던 셈이다.
 *
 * 순서를 바꾼다 — 왜 이걸 골랐는지 먼저 읽고, 그 다음에 무엇을 담을지 고른다.
 * 킷 가이드가 [필수] 로 정한 "결과만 보여주지 말고 왜 그런지 함께" 도 이 순서가
 * 더 잘 지킨다. 아래로 밀려 안 읽히는 것보다 앞에 세우는 편이 낫다.
 */
function ReasonStep({ reasons, scoredAxes = [], onNext, 확인중 }: {
  reasons: RecommendationReason[];
  /**
   * 서버가 점수를 매길 때 이 메뉴를 밀어 준 축들.
   *
   * 이유 문장(reasons)이 빠뜨리는 것이 있어서 따로 보여 준다 — 가격 한도를 정해도
   * 서버의 이유 문장에는 가격 얘기가 한 줄도 안 나온다(실측). 그러면 사용자는
   * 자기가 정한 한도가 결과에 반영됐는지 알 방법이 없다.
   *
   * 점수 숫자는 안 띄운다. 0.0259 는 이 앱을 쓰는 분들에게 읽을 수 없는 값이다.
   */
  scoredAxes?: string[];
  onNext: () => void;
  /** 되묻는 상황이면 다음 화면에서 할 일을 미리 알려 준다. */
  확인중?: boolean;
}) {
  const 쓴것 = reasons.filter((r) => r.kind === "used");
  const 못맞춘것 = reasons.filter((r) => r.kind === "unmet");
  const 뺀것 = reasons.filter((r) => r.kind === "excluded");
  return (
    <div className="flex flex-col gap-5">
      <CenterHeadline
        spot={<LoupeSpot size={58} />}
        kicker="why this"
        title={<>이렇게 찾았어요</>}
        desc="저장해 두신 조건으로 오늘 메뉴에서 찾은 결과예요."
      />

      {scoredAxes.length > 0 && (
        <div>
          <h2 style={{ ...TYPE.label, color: TEXT_2, marginBottom: 6 }}>이걸 보고 골랐어요</h2>
          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {scoredAxes.map((축) => (
              <span
                key={축}
                style={{
                  fontSize: 14, fontWeight: 700, color: TEXT_1, fontFamily: FONT,
                  backgroundColor: CANVAS, borderRadius: RADIUS.pill, padding: "8px 14px",
                }}
              >
                {축}
              </span>
            ))}
          </div>
        </div>
      )}
      {쓴것.length > 0 && <ReasonList reasons={쓴것} 제목="반영한 조건" />}
      {/* 못 맞춘 것을 반영한 것 바로 아래 둔다. 이 둘을 나란히 읽어야 무엇이
          되고 무엇이 안 됐는지가 한눈에 잡힌다. 빼 둔 메뉴는 그다음이다. */}
      {못맞춘것.length > 0 && <ReasonList reasons={못맞춘것} 제목="맞추지 못한 조건" />}
      {뺀것.length > 0 && <ReasonList reasons={뺀것} 제목="빼 둔 메뉴와 그 이유" />}

      <PrimaryBtn onClick={onNext}>
        {확인중 ? "메뉴 고르러 가기" : "담을 메뉴 확인하기"}
      </PrimaryBtn>
    </div>
  );
}

/**
 * 확인 카드에 남기는 한 줄.
 *
 * 이유 전체는 앞 단계로 옮겼지만, 승인 버튼이 있는 화면에도 근거가 한 줄은
 * 있어야 한다. 킷 가이드의 '추천 화면 최소 구성' 이 "왜 추천했는가" 를 요구한다.
 * 눌러서 앞 단계로 되돌아가면 전체를 다시 읽을 수 있다.
 */
function ReasonSummary({ reasons, onOpen }: { reasons?: RecommendationReason[]; onOpen: () => void }) {
  /*
   * 못 맞춘 조건이 있으면 그것을 먼저 보여 준다.
   *
   * 한 줄만 보이는 자리라 무엇을 올릴지가 중요하다. '반영했다' 는 안심시키는
   * 말이고 '못 맞췄다' 는 확인이 필요한 말인데, 확인이 필요한 쪽을 접어 두면
   * 사용자는 다 맞은 줄 알고 승인한다.
   */
  const 첫줄 = reasons?.find((r) => r.kind === "unmet")
    ?? reasons?.find((r) => r.kind === "used")
    ?? reasons?.[0];
  if (!첫줄) return null;
  const 남은 = (reasons?.length ?? 0) - 1;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex", gap: 9, alignItems: "flex-start", textAlign: "left", width: "100%",
        borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: "13px 16px",
        border: "none", cursor: "pointer", font: "inherit",
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 2, display: "flex" }}>
        <Pictogram name={이유표시[첫줄.kind].그림} size={16} color={이유표시[첫줄.kind].색} />
      </span>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.6, color: TEXT_1 }}>
        {/*
          말머리를 글자로 붙인다. Pictogram 은 aria-hidden 이라 스크린리더가 못 읽고,
          reasons[].text 도 '반영' 인지 '제외' 인지를 문장 안에 담는다고 보장하지 않는다.
          쓴 것이 하나도 없으면 여기 뜨는 줄이 제외 사유인데, 표시가 없으면 그게
          이 메뉴를 고른 근거처럼 읽힌다. ReasonList 는 이미 이렇게 하고 있었다.
        */}
        <b style={{ fontWeight: 700 }}>{이유표시[첫줄.kind].말머리}</b>
        {첫줄.text}
        {남은 > 0 && (
          <span style={{ color: TEXT_2, textDecoration: "underline", textUnderlineOffset: 3 }}>
            {" "}이유 {남은}개 더 보기
          </span>
        )}
      </span>
    </button>
  );
}

function InfoBox({ children, variant = "warn" }: { children: React.ReactNode; variant?: "warn" | "info" }) {
  const warn = variant === "warn";
  const bg = warn ? WARN_BG : SURFACE;
  const fg = warn ? WARN : TEXT_1;
  const icon = warn
    ? <Pictogram name="warning" size={19} color={WARN} />
    : <Pictogram name="magnifyingGlass" size={19} color={TEXT_1} />;

  return (
    <div style={{ borderRadius: RADIUS.input, padding: "14px 16px", backgroundColor: bg, border: "none", display: "flex", gap: 11, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 2, display: "flex" }}>{icon}</span>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: fg }}>{children}</p>
    </div>
  );
}

// 후보 선택 카드 — 선택되면 카드 전체가 검게 반전된다. 테두리로 상태를 표시하지 않는다.
/**
 * role="radio" 를 흉내 낸 button 이었다. 스크린리더는 "라디오, 3개 중 1번째" 라고
 * 읽어 주는데 사용자가 화살표를 누르면 아무 일도 일어나지 않았다. roving tabindex 도
 * 키 핸들러도 없었기 때문이다.
 *
 * 흉내 내는 대신 진짜 <input type="radio"> 를 쓴다. 화살표 이동·그룹 안 단일 포커스가
 * 브라우저 기본으로 동작하고, 우리가 유지할 코드도 줄어든다.
 * 주문표 목록(SavedSheetsScreen)이 같은 이유로 이미 이렇게 되어 있다.
 *
 * 예전에는 role="button" 분기도 있었다. low_confidence 에서 '이게 맞아요' 를
 * 짚는 자리였는데, 확인 카드와 같은 메뉴를 카드 모양으로 두 번 그리게 되어
 * CheckRow 로 옮겼다. 이제 이 컴포넌트는 라디오 하나만 한다.
 *
 * groupName 은 필수다. 기본값을 두면 화면에 라디오 그룹이 둘 이상일 때
 * 서로 다른 질문의 선택지가 조용히 한 그룹으로 묶인다.
 */
function OptionCard({
  name, price, selected, onClick, photo, groupName, matched,
}: {
  name: string; price: string; selected: boolean; onClick: () => void;
  photo?: string | null; groupName: string;
  /**
   * 저장해 두신 조건과 이 후보가 한 축도 어긋나지 않는가.
   *
   * 서버가 후보별로 알려 준 unmatchedLabels 가 **비어 있을 때만** 참이다.
   * 안 알려 주면(undefined) 아무 말도 하지 않는다 - 이름을 뜯어보고 짐작하면
   * '아이스 아메리카노' 처럼 이름에 ICE 가 없는 후보를 틀렸다고 말하게 된다.
   */
  matched?: boolean;
}) {
  const [포커스, set포커스] = useState(false);
  const 속: React.ReactNode = (
    <>
      <span className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
        {photo && <img src={photo} alt="" aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
        {/*
          배지를 이름 옆에 두면 이름이 밀려 두 줄로 접힌다. 메뉴 이름은 이 줄에서
          가장 먼저 읽어야 하는 값이라 한 줄로 세우고, 배지는 아래로 내린다.
        */}
        <span style={{ minWidth: 0, textAlign: "left" }}>
        <span style={{ ...TYPE.bodyBold, color: selected ? PAPER : TEXT_1, display: "block" }}>{name}</span>
        {/*
          위트 액센트 하나. 뜻은 옆의 '조건 일치' 라는 글자가 지고 있고 이 그림은
          거들기만 한다 - 이모지는 기기마다 모양이 다르고 스크린리더가 이름을
          읽어 주므로, 뜻을 이 자리에 맡기지 않는다.
        */}
        {matched && (
          <span
            className="flex items-center"
            style={{ gap: 4, marginTop: 3, whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: selected ? PAPER : P }}
          >
            <span aria-hidden="true">🌿</span>조건 일치
          </span>
        )}
        </span>
      </span>
      <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 21, whiteSpace: "nowrap", color: selected ? PAPER : TEXT_1, ...NUM }}>{price}</span>
        <div aria-hidden="true" style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: selected ? PAPER : "transparent",
          // 안 고른 동그라미의 테두리는 "여기 고를 수 있는 게 있다"를 알리는 유일한 표시다.
          // TEXT_3 는 옅은 면 위에서 1.62:1 이라 컨트롤 경계 기준(3:1)에 못 미쳤다.
          border: selected ? "none" : `1.5px solid ${TEXT_2}`,
        }}>
          {selected && <Check size={12} strokeWidth={3} color={RULE} />}
        </div>
      </div>
    </>
  );

  /*
   * 카드에서 헤어라인 행으로 바꿨다.
   *
   * 후보가 셋이면 카드 셋이 각각 면을 갖는데, 종이색 바탕에서는 면이 겹겹이
   * 쌓여 보여 무엇을 고르는 자리인지가 흐려진다. 줄로 나누면 목록이 하나로
   * 읽히고, 고른 줄만 검게 반전돼서 어디를 골랐는지가 한눈에 들어온다.
   */
  const 겉모양 = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "18px 16px", borderRadius: selected ? RADIUS.card : 0, cursor: "pointer", fontFamily: FONT,
    border: "none", width: "100%",
    // 고른 것은 검은 면. 초록은 '조건 일치' 한 곳에만 남긴다.
    backgroundColor: selected ? RULE : "transparent",
    transition: "background-color 0.15s",
  } as const;

  return (
    <label style={{
      ...겉모양, position: "relative", margin: 0,
      // 포커스는 숨은 input 이 받지만 표시는 이 라벨이 한다.
      // 화살표 키를 살리려다 포커스 표시를 잃으면 안 된다.
      outline: 포커스 ? `3px solid ${RULE}` : "none",
      outlineOffset: 2,
    }}>
      {/* 눈에는 안 보이지만 지우지 않는다. 화살표 이동과 그룹 의미는 이 요소가 만든다. */}
      <input
        type="radio"
        name={groupName}
        checked={selected}
        onChange={onClick}
        onFocus={() => set포커스(true)}
        onBlur={() => set포커스(false)}
        aria-label={`${name}, ${price}`}
        style={SR_ONLY}
      />
      {속}
    </label>
  );
}

function OrderExact({
  item, reasons, onReasons, onApprove, onCancel,
}: {
  item: MappedItem; reasons?: RecommendationReason[]; onReasons: () => void; onApprove: () => void; onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ConfirmCard badge="오늘의 메뉴에서 찾았어요" photo={item.imageUrl}>
        <ConfirmRow label="상품" value={item.displayName} />
        {item.options.map((o) => (
          <ConfirmRow key={o.label} label={o.label} value={o.value} />
        ))}
        <ConfirmRow label="가격" value={item.priceText} large />
      </ConfirmCard>
      <ReasonSummary reasons={reasons} onOpen={onReasons} />
      <PrimaryBtn onClick={onApprove}>승인하고 담기</PrimaryBtn>
      <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
    </div>
  );
}

function OrderClarification({
  candidates, reason, reasons, onReasons, options, onApprove, onCancel,
}: {
  candidates: MappingCandidate[];
  reason?: string;
  reasons?: RecommendationReason[];
  onReasons: () => void;
  /** 사용자가 고른 조건. 어느 후보를 고르든 같으므로 함께 보여 준다. */
  options?: MappedOption[];
  onApprove: (candidateId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 style={{ ...TYPE.title, color: TEXT_1 }}>혹시 이 중<br />어떤 메뉴인가요?</h2>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8 }}>{reason}</p>
      </div>
      {/*
       * 저장해 둔 조건을 고르기 전에 먼저 보여 준다.
       *
       * '그대로예요' 라고 단정하지 않는다. 후보마다 맞는 축이 다르기 때문이다.
       * 형태를 '순살' 로 저장했는데 '매운 뼈 닭강정' 을 고르면 형태는 안 맞는다.
       *
       * 어긋나는 축은 응답이 알려 준다(unmatchedLabels). 이름을 뜯어보고
       * 짐작하지 않는다 — '아이스 아메리카노' 는 온도가 ICE 인데 이름 어디에도
       * 'ICE' 가 없어서, 이름으로 판단하면 정확히 맞는 후보를 틀렸다고 말한다.
       * 서버가 알려 주지 않으면 아무 표시도 하지 않는다.
       */}
      {options && options.length > 0 && (
        <ConfirmCard badge="저장하신 조건" badgeTone="neutral">
          {options.map((o) => {
            const 고른후보 = selected !== null ? candidates[selected] : undefined;
            const 안맞음 = 고른후보?.unmatchedLabels?.includes(o.label) ?? false;
            return (
              <ConfirmRow
                key={o.label}
                label={o.label}
                value={o.value}
                changed={안맞음}
                changeNote={안맞음 ? "고르신 메뉴와 달라요" : undefined}
              />
            );
          })}
        </ConfirmCard>
      )}
      <div role="radiogroup" aria-label="비슷한 메뉴 후보" style={{ borderTop: `2px solid ${RULE}` }}>
        {candidates.map((c, i) => (
          <div key={`row-${c.candidateId}`} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
          <OptionCard
            key={c.candidateId}
            groupName="후보"
            selected={selected === i}
            name={c.displayName}
            price={c.priceText}
            photo={c.imageUrl}
            matched={c.unmatchedLabels?.length === 0}
            onClick={() => setSelected(i)}
          />
          </div>
        ))}
      </div>
      <ReasonSummary reasons={reasons} onOpen={onReasons} />
      {selected === null && (
        <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2 }}>메뉴를 선택하면 승인할 수 있어요</p>
      )}
      <PrimaryBtn
        onClick={selected !== null ? () => onApprove(candidates[selected].candidateId) : undefined}
        disabled={selected === null}
      >
        승인하고 담기
      </PrimaryBtn>
      <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
    </div>
  );
}

function OrderNotFound({ message, onCancel }: { message?: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ paddingTop: 32 }}>
      <StatusHero
        mark={<Pictogram name="magnifyingGlass" size={62} color={TEXT_3} />}
        title="메뉴를 찾지 못했어요"
        desc={message}
      />
      <div style={{ width: "100%", marginTop: 36 }}>
        <OutlineBtn onClick={onCancel}>주문표 다시 보기</OutlineBtn>
      </div>
    </div>
  );
}

function OrderChanged({
  item, diffNote, reasons, onReasons, onApprove, onCancel,
}: {
  item: MappedItem;
  diffNote?: string;
  reasons?: RecommendationReason[];
  onReasons: () => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <ConfirmCard photo={item.imageUrl}>
        <ConfirmRow label="상품" value={item.displayName} />
        {item.options.map((o) => (
          <ConfirmRow key={o.label} label={o.label} value={o.value} changed={!o.matched} changeNote={o.note} />
        ))}
        <ConfirmRow label="가격" value={item.priceText} large />
      </ConfirmCard>

      <div style={{ borderRadius: RADIUS.input, padding: "15px 18px", backgroundColor: WARN_BG, border: "none", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="flex gap-3 items-start">
          <Pictogram name="warning" size={19} color={WARN} style={{ marginTop: 1 }} />
          <p style={{ fontSize: 14, lineHeight: 1.6, color: WARN }}>{diffNote}</p>
        </div>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => setChecked((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 44, border: "none", backgroundColor: "transparent", cursor: "pointer", fontFamily: FONT, padding: 0 }}
        >
          {/*
           * 안 찍힌 네모의 테두리를 WARN_BORDER 로 그리면 노란 바탕 위에서 1.29:1 이라
           * 체크박스가 있다는 것 자체가 안 보인다. 이건 승인 조건을 사람이 직접 짚었다는
           * 표시를 받는 칸이라 흐리면 안 된다. WARN 으로 그리면 5.5:1 이다.
           */}
          <div aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, border: checked ? "none" : `1.5px solid ${WARN}`, backgroundColor: checked ? WARN : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
            {checked && <Check size={12} strokeWidth={3} color={PAPER} />}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: WARN }}>달라진 내용을 확인했어요</span>
        </button>
      </div>

      <ReasonSummary reasons={reasons} onOpen={onReasons} />
      <PrimaryBtn onClick={checked ? onApprove : undefined} disabled={!checked}>변경 내용 확인하고 담기</PrimaryBtn>
      <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
    </div>
  );
}

function OrderLowConfidence({
  item, reasons, onReasons, onApprove, onCancel,
}: {
  item: MappedItem; reasons?: RecommendationReason[]; onReasons: () => void; onApprove: () => void; onCancel: () => void;
}) {
  const [selected, setSelected] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 style={{ ...TYPE.title, color: TEXT_1 }}>이 메뉴가 맞는지<br />확실하지 않아요</h2>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8 }}>맞다면 선택해 주세요</p>
      </div>
      {/*
       * 예전에는 이름과 가격만 보여 줬다. 확신이 낮으면서 조건도 못 맞춘 경우
       * 못 맞췄다는 사실이 화면에서 통째로 사라졌다 — 가장 조심해야 하는 상황에서
       * 정보가 가장 적었다. exact 와 같은 확인 카드를 그대로 쓴다.
       * 사용자는 포장인지 종이컵인지 몇 개인지 다 보고 나서 짚는다.
       */}
      <ConfirmCard badge="확실하지 않아요" badgeTone="caution" photo={item.imageUrl}>
        <ConfirmRow label="상품" value={item.displayName} />
        {item.options.map((o) => (
          <ConfirmRow key={o.label} label={o.label} value={o.value} changed={!o.matched} changeNote={o.note ?? "오늘은 이 조합이 없어요"} />
        ))}
        <ConfirmRow label="가격" value={item.priceText} large />
      </ConfirmCard>
      <InfoBox variant="info">시스템이 정확하게 찾지 못했어요. 위 내용을 확인하고 맞으면 아래에서 짚어 주세요.</InfoBox>
      {/*
       * 위 확인 카드와 같은 메뉴를 카드 모양으로 또 그리면 두 개인 줄 안다.
       * 여기는 고르는 자리가 아니라 "위 내용이 맞다" 고 짚는 자리이므로
       * 체크 한 줄로 둔다.
       */}
      <CheckRow
        checked={selected}
        onToggle={() => setSelected((v) => !v)}
        label="위 내용이 제가 시키려던 것이 맞아요"
      />
      <ReasonSummary reasons={reasons} onOpen={onReasons} />
      {!selected && (
        <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2 }}>메뉴를 선택하면 승인할 수 있어요</p>
      )}
      <PrimaryBtn onClick={selected ? onApprove : undefined} disabled={!selected}>승인하고 담기</PrimaryBtn>
      <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
    </div>
  );
}

function OrderMappingLoading() {
  return (
    <div className="flex flex-col items-center justify-center text-center" style={{ paddingTop: 72, paddingBottom: 72 }}>
      <StatusHero
        mark={<SpinnerIcon />}
        title="오늘의 메뉴와 맞춰보는 중"
        desc="저장한 주문이 오늘도 있는지 확인하고 있어요"
      />
    </div>
  );
}

function OrderConfirmScreen({
  pairingId, sheet, onBack, onApproved,
}: {
  pairingId: string;
  sheet: OrderSheet;
  onBack: () => void;
  onApproved: (planId: string) => void;
}) {
  const [mapping, setMapping] = useState<MappingResponse | null>(null);
  // 서버가 이유를 여러 줄 줄 수 있어 문장 하나가 아니라 목록으로 들고 있는다.
  const [error, setError] = useState<{ message: string; details?: string[] } | null>(null);
  // 승인은 한 번만. 연타로 실행 계획이 두 번 만들어지면 안 된다.
  const approving = useRef(false);

  useEffect(() => {
    let alive = true;
    api.requestMapping(pairingId, sheet.id)
      .then((res) => { if (alive) setMapping(res); })
      .catch((e: KioBridgeError) => { if (alive) setError({ message: e.message }); });
    return () => { alive = false; };
  }, [pairingId, sheet.id]);

  // P0-4: 실행 계획 생성은 이 핸들러 안에서만 일어난다.
  // 매핑 조회(useEffect)는 계획을 만들지 않으므로 승인 전 실행 경로가 존재하지 않는다.
  /**
   * 승인하지 않고 되돌아간다.
   *
   * 그냥 화면만 닫으면 서버는 사용자가 무엇을 보고 무엇을 거절했는지 모른다.
   * 대신 눌러 주는 앱에서 '아니오' 는 '예' 만큼 중요한 기록이라 남긴다.
   *
   * 기다리지 않고 바로 되돌아간다. 그만두겠다는 사람을 붙잡지 않는다.
   * 기록이 실패해도 화면은 이미 나가 있다 — 그건 서버 사정이지
   * 사용자가 감당할 일이 아니다.
   */
  const 거절하기 = () => {
    onBack();
    void api.reject({ pairingId, sheetId: sheet.id }).catch(() => {});
  };

  /*
   * 이유를 먼저 읽고, 그 다음에 무엇을 담을지 고른다.
   *
   * 예전에는 한 화면에 확인 카드.조건표.후보 목록.이유가 다 쌓여서, 이유를
   * 읽으려면 스크롤을 한참 내려야 했다. 승인 전에 꼭 읽어야 할 것이 가장 읽기
   * 어려운 자리에 있었다. 단계를 나눈다.
   *
   * 이유가 없으면 이 단계를 건너뛴다 - 빈 화면을 하나 더 지나가게 하지 않는다.
   */
  /*
   * '쉬운 단계' 를 켜면 이유 단계를 건너뛴다.
   *
   * 이 단계는 원래 스크롤을 줄이려고 만든 것인데, 단계를 하나 늘린 것도 사실이다.
   * 단계를 줄여 달라고 한 사람에게는 그 맞바꿈이 반대로 작용한다.
   *
   * 건너뛰어도 확인 화면의 한 줄 요약과 '이유 N개 더 보기' 는 그대로 남는다 -
   * 킷 가이드가 [필수] 로 정한 "왜 그런지 함께 보여준다" 는 지켜진다.
   * 읽고 싶으면 한 번 눌러서 전체를 볼 수 있다.
   */
  const [이유먼저, set이유먼저] = useState(!접근성설정.읽기().simpleSteps);
  const 이유있나 = (mapping?.reasons?.length ?? 0) > 0;
  const 이유단계 = 이유먼저 && 이유있나 && mapping?.result !== "not_found";

  const approve = (extra: Omit<ApproveInput, "pairingId" | "sheetId" | "mappingResult"> = {}) => {
    if (!mapping || approving.current) return;
    approving.current = true;
    setError(null);
    api.approve({ pairingId, sheetId: sheet.id, mappingResult: mapping.result, ...extra })
      .then((res) => onApproved(res.planId))
      .catch((e: KioBridgeError) => {
        approving.current = false;
        setError({ message: e.message, ...(e.details && e.details.length > 1 ? { details: e.details } : {}) });
      });
  };

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-2" style={{ marginTop: 20, paddingBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: PAPER, backgroundColor: RULE, padding: "4px 11px", borderRadius: RADIUS.pill }}>내 주문표</span>
          <span style={{ ...TYPE.bodyBold, color: TEXT_1 }}>{sheet.menuName}</span>
        </div>
        <div style={{ height: 1, backgroundColor: BORDER, marginLeft: -GAP.screenX, marginRight: -GAP.screenX }} />
      </div>

      <div className="flex-1 overflow-y-auto pb-6" style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX, paddingTop: 24 }} aria-busy={!mapping && !error}>
        {!mapping && !error && <OrderMappingLoading />}

        {/*
          이유가 여러 줄이면 줄줄이 잇지 않고 하나씩 세운다. 붙여 놓으면
          두 가지 문제가 한 문장으로 읽혀서 몇 개인지조차 안 보인다.
          InfoBox 안은 <p> 라 <ul> 을 넣을 수 없어 블록 <span> 으로 세운다.
        */}
        {error && (
          <div className="mb-4" role="alert">
            <InfoBox>
              {error.details
                ? <>
                    이런 점 때문에 담지 못했어요.
                    {/* 서버는 distinct 로 주지만 옛 경로는 같은 문장이 겹칠 수 있다. */}
                    {error.details.map((줄, i) => (
                      <span key={`${i}-${줄}`} style={{ display: "block", marginTop: 6 }}>· {줄}</span>
                    ))}
                  </>
                : error.message}
            </InfoBox>
          </div>
        )}

        {!mapping && error && <OutlineBtn onClick={onBack}>주문표 다시 보기</OutlineBtn>}

        {/*
          '직원 도움' 을 켠 사람에게는 승인 화면에서도 이 줄을 띄운다.

          지금까지 이 안내는 실패.중단 화면에만 있었다. 그런데 막히는 곳은
          대개 실패 화면이 아니라 "이게 맞나" 싶은 확인 화면이고, 거기서
          도움을 청할 길이 없으면 사람은 그냥 앱을 닫는다.
          켠 사람에게만 띄운다 - 안 켠 사람에게는 화면에 줄 하나가 더 늘 뿐이다.
        */}
        {mapping && 접근성설정.읽기().staffAssistancePreferred && (
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 16 }}>
            <Pictogram name="warning" size={17} color={TEXT_2} />
            <p style={{ ...TYPE.caption, color: TEXT_2, flex: 1 }}>
              막히시면 이 화면을 매장 직원에게 보여 주세요. 직원이 이어서 도와드릴 수 있어요.
            </p>
          </div>
        )}

        {/*
          이유 단계. 확인 카드 앞에 온다 — 스크롤을 내려야 읽히던 것을 앞으로 옮겼다.
        */}
        {mapping && 이유단계 && (
          <ReasonStep
            reasons={mapping.reasons ?? []}
            scoredAxes={mapping.scoredAxes}
            확인중={mapping.result === "clarification" || mapping.result === "low_confidence"}
            onNext={() => set이유먼저(false)}
          />
        )}

        {/*
          이유로 되돌아가도 골라 둔 것을 잃지 않는다.

          조건부로 그리면(!이유단계 && ...) 이유를 다시 볼 때 확인 갈래가 언마운트되고,
          OrderClarification 의 selected 와 OrderChanged.OrderLowConfidence 의 checked 가
          초기값으로 돌아간다. 후보를 고르고 이유를 한 번 더 읽고 온 사람은 그 사실을
          모른 채 승인 버튼이 다시 잠긴 화면을 만난다 — 재확인은 승인 조건이라 다시
          짚어야만 넘어간다.

          그래서 지우지 않고 감춘다. display:none 은 접근성 트리에서도 빠지므로
          스크린리더가 감춰진 화면을 읽지 않는다.
        */}
        <div style={{ display: 이유단계 ? "none" : undefined }}>
        {/*
         * item 이 없으면 그리지 않는다. 예전에는 mapping.item! 로 있다고 단정했는데,
         * 조건에 다 걸려 후보가 하나도 안 남으면 undefined 가 들어와 화면이 터진다.
         * 목은 이제 그 경우를 not_found 로 답하지만, 화면이 서버를 믿고 단정할 이유는 없다.
         */}
        {mapping?.result === "exact" && mapping.item && (
          <OrderExact item={mapping.item} reasons={mapping.reasons} onReasons={() => set이유먼저(true)} onApprove={() => approve()} onCancel={거절하기} />
        )}
        {mapping?.result === "clarification" && (
          <OrderClarification
            candidates={mapping.candidates ?? []}
            reason={mapping.reason}
            reasons={mapping.reasons}
            onReasons={() => set이유먼저(true)}
            options={mapping.sheetOptions}
            onApprove={(candidateId) => approve({ candidateId })}
            onCancel={거절하기}
          />
        )}
        {mapping?.result === "not_found" && <OrderNotFound message={mapping.message} onCancel={거절하기} />}
        {mapping?.result === "changed" && mapping.item && (
          <OrderChanged
            item={mapping.item}
            diffNote={mapping.diffNote}
            reasons={mapping.reasons}
            onReasons={() => set이유먼저(true)}
            onApprove={() => approve({ acknowledgedDiff: true })}
            onCancel={거절하기}
          />
        )}
        {/*
         * 상태는 왔는데 그 상태가 요구하는 필드가 없는 경우.
         * 예전에는 조건이 거짓이 되어 본문이 통째로 비었고, 사용자는
         * 무슨 일이 일어났는지도 나갈 방법도 알 수 없었다.
         */}
        {(mapping?.result === "exact" || mapping?.result === "changed" || mapping?.result === "low_confidence") && !mapping.item && (
          <div className="flex flex-col gap-4">
            <InfoBox>메뉴 정보를 불러오지 못했어요. 키오스크 화면을 직접 확인해 주세요.</InfoBox>
            <OutlineBtn onClick={onBack}>주문표 다시 보기</OutlineBtn>
          </div>
        )}
        {mapping?.result === "low_confidence" && mapping.item && (
          <OrderLowConfidence
            item={mapping.item}
            reasons={mapping.reasons}
            onReasons={() => set이유먼저(true)}
            /* 사용자가 카드를 눌러 "이 메뉴가 맞다"고 짚어야만 여기까지 온다. 그 사실을 서버에도 알린다. */
            onApprove={() => approve({ confirmedLowConfidence: true })}
            onCancel={거절하기}
          />
        )}
        </div>
      </div>
    </div>
  );
}

// ─── Execution Result ─────────────────────────────────────────────────────────

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  const isDone = status === "done";
  const isActive = status === "active";
  const isFailed = status === "failed";

  return (
    <div className="flex items-center gap-3.5" style={{ padding: "14px 0" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        // 끝난 단계는 검은 동그라미. 다섯 개가 초록으로 늘어서면 화면이 초록 목록이 된다.
        backgroundColor: isDone ? RULE : isActive ? PAPER : isFailed ? FAIL_BG : PAPER,
      }}>
        {isDone && (
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 9.5L7.5 13L14 6" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isActive && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7" stroke={BORDER} strokeWidth="2.5" />
            <path d="M10 3 A7 7 0 0 1 17 10" stroke={TEXT_1} strokeWidth="2.5" strokeLinecap="round" style={SPIN(10, 10)} />
          </svg>
        )}
        {isFailed && (
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M5 5L13 13M13 5L5 13" stroke={FAIL} strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        )}
        {status === "waiting" && (
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: TEXT_3 }} />
        )}
      </div>

      <span style={{ fontSize: 16, letterSpacing: "-0.01em", fontWeight: isActive || isDone ? 600 : 400, color: isDone ? TEXT_1 : isActive ? TEXT_1 : isFailed ? FAIL : TEXT_2 }}>
        {label}
      </span>

      {isActive && (
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, backgroundColor: RULE, color: PAPER }}>
          진행 중
        </span>
      )}
      {isFailed && (
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, backgroundColor: FAIL, color: PAPER }}>
          중단
        </span>
      )}
    </div>
  );
}

function StepCard({ statuses }: { statuses: StepStatus[] }) {
  return (
    <div style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, overflow: "hidden", padding: "6px 20px" }}>
      {STEPS.map((label, i) => (
        <div key={label} style={{ borderBottom: i < STEPS.length - 1 ? `1px solid ${BORDER}` : "none" }}>
          <StepRow label={label} status={statuses[i]} />
        </div>
      ))}
    </div>
  );
}

/**
 * 키오스크가 실제로 한 일을 순서대로 보여 준다.
 *
 * 위의 StepCard 는 우리가 정해 둔 다섯 단계이고, 이건 서버가 정말 한 동작이다.
 * 둘은 개수가 다르다 - 다섯 칸에 열 동작이 들어간다. 그래서 다섯 단계를
 * 이걸로 바꾸지 않고 아래에 접어 둔다. 열 줄을 펼쳐 두면 화면이 길어지고,
 * 대개 사람이 알고 싶은 건 '담겼나' 한 가지다.
 *
 * 접어 두되 없애지는 않는다. 결과가 미심쩍을 때 무엇을 골랐는지 한 줄씩
 * 확인할 수 있어야 하고, 그게 대신 눌러 주는 앱이 갚아야 할 몫이다.
 *
 * 서버가 안 주면(#71 이전 백엔드, 목) 이 부품을 아예 그리지 않는다.
 */
function DoneSteps({ done }: { done: { text: string; ok: boolean }[] }) {
  const [펼침, set펼침] = useState(false);
  const 실패 = done.filter((d) => !d.ok).length;

  return (
    <div>
      <button
        type="button"
        onClick={() => set펼침((v) => !v)}
        aria-expanded={펼침}
        style={{
          width: "100%", minHeight: 44, textAlign: "left", background: "none", border: "none",
          padding: "6px 2px", display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {/* 키오스크가 대신 눌러 준 일이라 handPointing 을 쓴다. 새 아이콘은 두지 않는다. */}
        <Pictogram name="handPointing" size={17} color={TEXT_2} />
        <span style={{ ...TYPE.caption, color: TEXT_2 }}>
          키오스크가 한 일 {done.length}가지
          {실패 > 0 && <b style={{ fontWeight: 700, color: WARN }}> · {실패}가지 실패</b>}
          <span style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{" "}{펼침 ? "접기" : "보기"}</span>
        </span>
      </button>

      {펼침 && (
        <ol style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: "10px 16px", marginTop: 4 }}>
          {done.map((d, i) => (
            <li
              key={`${i}-${d.text}`}
              style={{
                display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 0",
                borderBottom: i < done.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
            >
              {/*
                번호에 TEXT_3 를 썼었다. tokens.ts 에 "글자 금지" 라고 적어 둔
                값이라 흰 배경 1.74:1 이고, 이 목록의 면(SURFACE) 위에서는 더
                낮다. 몇 번째 줄인지 세라고 붙여 둔 숫자가 안 보이면 없느니만
                못하다. 낮춰 보이는 것은 색이 아니라 크기로 만든다.
              */}
              <span style={{ ...TYPE.caption, color: TEXT_2, ...NUM, minWidth: 18 }}>{i + 1}</span>
              <Pictogram name={d.ok ? "checkCircle" : "xCircle"} size={16} color={d.ok ? TEXT_1 : FAIL} style={{ marginTop: 2 }} />
              {/*
                Pictogram 은 aria-hidden 이라 이 줄이 됐는지 안 됐는지가 색과
                모양으로만 남아 있었다. 스크린리더에는 "종이컵 골랐어요" 만
                들리고 성공.실패가 통째로 빠진다. 이 앱이 화면에 "상태는 색뿐
                아니라 그림과 글씨로도 알린다" 고 적어 두고 여기서 어긴 셈이다.
                실패한 줄은 눈으로도 바로 읽히도록 글씨색까지 바꾼다.
              */}
              <span style={{ ...TYPE.caption, color: d.ok ? TEXT_1 : FAIL, flex: 1 }}>
                <b style={{ fontWeight: 700 }}>{d.ok ? "됨" : "실패"}</b>
                {" · "}{d.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ExecInProgress({ statuses }: { statuses: StepStatus[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 style={{ ...TYPE.display, color: TEXT_1 }}>키오스크에 담고 있어요</h2>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8 }}>잠시만 기다려 주세요. 화면을 닫지 마세요.</p>
      </div>
      <StepCard statuses={statuses} />
    </div>
  );
}

function ExecSuccess({ cart, steps, done, note, serverStatus, onHome }: {
  cart: CartResult; steps: StepStatus[];
  /** 키오스크가 실제로 한 일. 서버가 안 주면 없다. */
  done?: { text: string; ok: boolean }[];
  /** 서버가 증거를 읽어 만든 한 문장. 없으면 이 줄을 그리지 않는다. */
  note?: string;
  /** 서버가 매긴 상태 문장. 그대로 인용한다. */
  serverStatus?: string;
  onHome: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StatusHero
        mark={<Pictogram name="checkCircle" size={64} color={P} />}
        kicker="in the cart"
        title="장바구니에 담았어요"
      />

      <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="flex items-center justify-between">
          <p style={{ ...TYPE.label, color: TEXT_2, display: "flex", alignItems: "center", gap: 6 }}>
            <Pictogram name="receipt" size={17} color={TEXT_2} />
            담긴 내역
          </p>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: RADIUS.pill, backgroundColor: PAPER, color: TEXT_2 }}>
            {cart.evidenceLabel}
          </span>
        </div>
        <span style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1.15, color: TEXT_1, ...NUM }}>
          {cart.itemCountText} · {cart.totalText}
        </span>
      </div>

      {/*
        왜 이 메뉴였는지를 마지막에 한 번 더 말해 준다.
        확인 화면에서 읽고 승인했더라도, 담기고 나서 "무엇을 담았더라" 를
        되짚을 자리가 있어야 한다. 서버가 만든 문장이라 화면이 지어내지 않는다.
      */}
      {note && (
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", paddingLeft: 2 }}>
          <Pictogram name="checkCircle" size={17} color={TEXT_2} />
          <p style={{ ...TYPE.caption, color: TEXT_2, flex: 1 }}>{note}</p>
        </div>
      )}

      {/*
        서버가 매긴 상태를 그대로 인용한다.
        문체가 다르다('~되었습니다'). 앱 문구로 옮기지 않는 이유는, 이 줄의 쓸모가
        "이 결과가 키오스크 쪽에서 온 것이다" 를 보이는 데 있어서다. 우리 말로 바꾸면
        서버가 준 것인지 앱이 지어낸 것인지 다시 구분할 수 없어진다.
        인용이라고 밝혀서 문체 차이를 푼다 — 앱이 하는 말이 아니라 옮겨 적은 말이다.
      */}
      {serverStatus && (
        <div style={{ borderRadius: RADIUS.card, padding: "14px 16px", backgroundColor: CANVAS }}>
          <p style={{ ...TYPE.label, color: TEXT_2, marginBottom: 4 }}>키오스크가 보내온 결과</p>
          <p style={{ ...TYPE.caption, color: TEXT_1 }}>“{serverStatus}”</p>
        </div>
      )}

      <StepCard statuses={steps} />

      {done && <DoneSteps done={done} />}

      <div style={{ display: "flex", gap: 11, alignItems: "flex-start", paddingLeft: 2 }}>
        <Pictogram name="shoppingCartSimple" size={20} color={TEXT_2} style={{ marginTop: 1 }} />
        <p style={{ fontSize: 14, color: TEXT_2, lineHeight: 1.6 }}>{cart.handoff}</p>
      </div>

      <OutlineBtn onClick={onHome}>처음으로</OutlineBtn>
    </div>
  );
}

function ExecFailed({ abort, steps, done, serverStatus, onHome }: {
  abort: AbortInfo; steps: StepStatus[];
  /** 키오스크가 실제로 한 일. 어디까지 갔는지가 중단됐을 때 더 궁금하다. */
  done?: { text: string; ok: boolean }[];
  /** 서버가 매긴 상태 문장. 성공 화면과 같은 방식으로 인용한다. */
  serverStatus?: string;
  onHome: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StatusHero
        mark={<Pictogram name="xCircle" size={64} color={FAIL} />}
        title={abort.title}
      />

      <div style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: 20 }}>
        <p style={{ ...TYPE.bodyBold, color: TEXT_1, marginBottom: 6 }}>{abort.userAction}</p>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginBottom: 10 }}>{abort.message}</p>
        <p style={{ fontSize: 12, color: TEXT_2, ...NUM }}>오류 코드: {abort.code}</p>
      </div>

      {/*
        서버가 매긴 상태를 그대로 인용한다. 성공 화면과 같은 방식이다.
        멈춘 경우에는 화면에 개수.금액이 없어서 "키오스크가 뭐라고 했는지" 말고는
        확인할 방법이 없다 - 오히려 여기가 이 줄이 가장 필요한 자리다.
      */}
      {serverStatus && (
        <div style={{ borderRadius: RADIUS.card, padding: "14px 16px", backgroundColor: CANVAS }}>
          <p style={{ ...TYPE.label, color: TEXT_2, marginBottom: 4 }}>키오스크가 보내온 결과</p>
          <p style={{ ...TYPE.caption, color: TEXT_1 }}>“{serverStatus}”</p>
        </div>
      )}

      <StepCard statuses={steps} />

      {done && <DoneSteps done={done} />}

      <OutlineBtn onClick={onHome}>처음으로</OutlineBtn>
      <p style={{ textAlign: "center", fontSize: 13, color: TEXT_2 }}>이 화면을 직원에게 보여주시면 빨라요</p>
    </div>
  );
}

function ExecutionScreen({ planId, onHome }: { planId: string; onHome: () => void }) {
  const [status, setStatus] = useState<PlanStatus>({
    state: "running",
    steps: STEPS.map(() => "waiting"),
  });

  // 폴링이 실패했을 때 사용자에게 보여 줄 말. null 이면 아직 문제가 없다는 뜻이다.
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (status.state !== "running" || pollError) return;
    let alive = true;
    // 한 번 삐끗한 것과 정말 끊긴 것은 다르다. 잠깐의 실패로 겁주지 않되,
    // 계속 실패하면 반드시 알린다. 예전에는 catch(() => {}) 로 전부 버려서
    // 상태가 영원히 running 에 머물고 "담고 있어요" 스피너가 끝나지 않았다.
    // 사용자는 실패한 줄도 모르고 빠져나갈 버튼도 없었다.
    let 연속실패 = 0;
    const 한계 = 5;
    // 응답 순서가 뒤바뀌면 진행 표시가 뒤로 간다. 폴링이 겹치지 않게 하고,
    // 늦게 도착한 답은 버린다.
    let 진행중 = false;
    let 차례 = 0;
    const poll = () => {
      if (진행중) return;
      진행중 = true;
      const 내차례 = ++차례;
      api.getPlanStatus(planId)
        .then((s) => { if (alive && 내차례 === 차례) { 연속실패 = 0; setStatus(s); } })
        .catch((e: KioBridgeError) => {
          if (!alive) return;
          연속실패 += 1;
          if (연속실패 >= 한계) {
            setPollError(e?.message || "진행 상황을 확인할 수 없어요");
          }
        })
        .finally(() => { 진행중 = false; });
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [planId, status.state, pollError]);

  // 서버가 계속 running 을 돌려주면 폴링은 성공이라 pollError 가 켜지지 않는다.
  // 키오스크가 멈췄는데 세션은 살아 있는 경우가 그렇다. 그러면 사용자는
  // "잠시만 기다려 주세요. 화면을 닫지 마세요." 앞에 영원히 갇힌다.
  // 실행 화면에는 하단 탭도 뒤로 가기도 없어서 나갈 방법이 아예 없다.
  // 5단계 × 1.4초면 7초면 끝나는 일이라, 90초를 넘기면 뭔가 잘못된 것이다.
  useEffect(() => {
    if (status.state !== "running" || pollError) return;
    const t = setTimeout(() => setPollError("시간이 오래 걸리고 있어요"), 90_000);
    return () => clearTimeout(t);
  }, [status.state, pollError]);

  return (
    <div className="flex flex-col h-full kb-paper">
      <div className="shrink-0" style={{ padding: `20px ${GAP.screenX}px 20px` }}>
        <AppLogo size={26} />
      </div>

      {/* 실행 상태는 사용자 조작 없이 바뀌므로 스크린리더에 알려야 한다. 중단은 assertive. */}
      <div
        className="flex-1 overflow-y-auto pb-6"
        style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}
        role="status"
        aria-live={status.state === "aborted" ? "assertive" : "polite"}
      >
        {/*
         * 확인이 안 되는 것과 실패한 것은 다르다. 키오스크가 어떻게 됐는지 모르는
         * 상황이므로 "중단됐다"고 단정하지 않는다. 다만 사용자를 스피너 앞에
         * 세워 두지 않고, 지금 무슨 상황인지와 나갈 길을 준다.
         */}
        {status.state === "running" && pollError && (
          <div className="flex flex-col flex-1" style={{ padding: `32px 0 24px` }}>
            <StatusHero
              mark={<Pictogram name="warning" size={64} color={WARN} />}
              title={<>진행 상황을<br />확인할 수 없어요</>}
              desc={pollError}
            />
            <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: WARN_BG, marginTop: 32 }}>
              <p style={{ ...TYPE.caption, color: TEXT_1 }}>
                <strong style={{ fontWeight: 600 }}>키오스크 화면을 직접 확인해 주세요.</strong>{" "}
                담겼을 수도 있고 아닐 수도 있어요. 잘 모르겠으면 직원에게 이 화면을 보여 주세요.
              </p>
            </div>
            <div className="mt-auto" style={{ paddingTop: 24 }}>
              <PrimaryBtn onClick={onHome}>처음으로</PrimaryBtn>
            </div>
          </div>
        )}
        {status.state === "running" && !pollError && <ExecInProgress statuses={status.steps} />}
        {status.state === "cart_ready" && status.cart && (
          <ExecSuccess cart={status.cart} steps={status.steps} done={status.done} note={status.note} serverStatus={status.serverStatus} onHome={onHome} />
        )}
        {/*
         * 담기는 끝났는데 내역이 안 온 경우. cart 는 옵셔널이라 서버가 빠뜨릴 수 있다.
         * 예전에는 아무것도 안 그려서 흰 화면에 갇혔다. 이 화면에는 하단 탭이 없어
         * 나갈 방법도 없었다. 내역을 지어내지 않고, 끝났다는 사실과 나갈 길만 준다.
         */}
        {status.state === "cart_ready" && !status.cart && (
          <div className="flex flex-col flex-1" style={{ padding: `32px 0 24px` }}>
            <StatusHero
              mark={<Pictogram name="checkCircle" size={64} color={SUCCESS} />}
              title={<>장바구니에<br />담았어요</>}
              desc="담긴 내역을 불러오지 못했어요"
            />
            <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, marginTop: 32 }}>
              <p style={{ ...TYPE.caption, color: TEXT_1 }}>
                <strong style={{ fontWeight: 600 }}>키오스크 화면에서 장바구니를 확인해 주세요.</strong>{" "}
                결제는 키오스크에서 직접 하시면 돼요.
              </p>
            </div>
            {/*
              내역이 없다고 실행 내역까지 버리면 안 된다. done 은 cart 와 다른
              데서 온 값이라 cart 가 비어도 살아 있다. 오히려 여기가 - 무엇이
              담겼는지 못 보여 주는 자리가 - "무엇을 했는지" 가 가장 필요한 곳이다.
            */}
            {status.done && <div style={{ marginTop: 16 }}><DoneSteps done={status.done} /></div>}
            <div className="mt-auto" style={{ paddingTop: 24 }}>
              <PrimaryBtn onClick={onHome}>처음으로</PrimaryBtn>
            </div>
          </div>
        )}
        {status.state === "aborted" && !status.abort && (
          <div className="flex flex-col flex-1" style={{ padding: `32px 0 24px` }}>
            <StatusHero
              mark={<Pictogram name="warning" size={64} color={WARN} />}
              title={<>안전을 위해<br />중단되었습니다</>}
              desc="자세한 이유를 불러오지 못했어요"
            />
            <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: WARN_BG, marginTop: 32 }}>
              <p style={{ ...TYPE.caption, color: TEXT_1 }}>
                <strong style={{ fontWeight: 600 }}>키오스크는 건드리지 않아도 돼요.</strong>{" "}
                직원에게 이 화면을 보여 주세요.
              </p>
            </div>
            {/* 중단 사유를 못 받았어도 어디까지 갔는지는 알려 준다. */}
            {status.done && <div style={{ marginTop: 16 }}><DoneSteps done={status.done} /></div>}
            <div className="mt-auto" style={{ paddingTop: 24 }}>
              <PrimaryBtn onClick={onHome}>처음으로</PrimaryBtn>
            </div>
          </div>
        )}
        {status.state === "aborted" && status.abort && (
          <ExecFailed abort={status.abort} steps={status.steps} done={status.done} serverStatus={status.serverStatus} onHome={onHome} />
        )}
      </div>
    </div>
  );
}

// ─── 시연용 시나리오 패널 ──────────────────────────────────────────────────────
// 제품 화면 밖(폰 프레임 바깥)에 둔다. 심사 중 예외 상태를 재현하기 위한 장치이며
// 사용자가 보는 앱 UI에는 포함되지 않는다. 백엔드 연결 시 이 컴포넌트만 지우면 된다.

/**
 * 지금 목인지 실서버인지, 방금 무엇이 오갔는지 보여 준다.
 *
 * 화면만 봐서는 구분할 방법이 없다. 둘 다 그럴듯한 답을 돌려주기 때문이다.
 * 실제로 나간 요청을 그대로 띄워서 "진짜 붙었다" 를 눈으로 확인하게 한다.
 *
 * npm run dev:team 일 때만 나온다. 기본 빌드에서는 팀백엔드모드가 상수 false 라
 * 이 컴포넌트를 부르는 자리가 통째로 빠진다.
 */
function 연동표시({ onOpenLog, onOpenSide }: { onOpenLog: () => void; onOpenSide: () => void }) {
  const [, 다시그리기] = useState(0);
  // 화면이 좁으면 접어 둔다. 펼친 채로 두면 휴대폰 틀의 아래 버튼을 덮어
  // 터치를 가로챈다. 200% 확대처럼 CSS 뷰포트가 작아질 때 실제로 그렇다.
  const [펼침, 펼치기] = useState(false);
  useEffect(() => 연동기록.구독(() => 다시그리기((n) => n + 1)), []);
  const 목록 = 연동기록.읽기();
  const 성공 = 목록.filter((x) => typeof x.상태 === "number" && x.상태 < 400).length;

  return (
    <div
      style={{
        position: "fixed", right: 12, bottom: 12, zIndex: 60,
        // 좁은 화면에서는 폭을 줄인다. 340px 고정이면 작은 뷰포트를 다 덮는다.
        width: "min(340px, calc(100vw - 24px))",
        maxHeight: 펼침 ? "60vh" : undefined,
        overflowY: 펼침 ? "auto" : undefined,
        background: "#0b0b0c", color: "#e8e8ea", borderRadius: 10,
        padding: 12, fontSize: 12, lineHeight: 1.5, fontFamily: "ui-monospace, monospace",
        boxShadow: "0 8px 28px rgba(0,0,0,.35)",
      }}
    >
      <button
        type="button"
        onClick={() => 펼치기((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 펼침 ? 8 : 0,
          background: "none", border: "none", color: "inherit", font: "inherit",
          padding: 0, cursor: "pointer", width: "100%", textAlign: "left",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#37d67a", flexShrink: 0 }} />
        <strong style={{ fontSize: 13 }}>실서버에 붙어 있습니다</strong>
        <span style={{ marginLeft: "auto", color: "#9a9aa2" }}>{성공}/{목록.length} {펼침 ? "▾" : "▸"}</span>
      </button>
      {!펼침 ? null : (
      <>
      <div style={{ color: "#9a9aa2", marginBottom: 8 }}>
        목이 아니라 팀 백엔드로 보냅니다 · /api/bff → KIOBRIDGE_API_BASE
      </div>
      {/* 본문까지 펼쳐 보는 화면. 이 패널은 좁아서 한 줄 요약까지만 담는다. */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          type="button"
          onClick={onOpenSide}
          style={{
            flex: 1, background: "none", border: "1px solid #232326",
            borderRadius: 6, color: "#e8e8ea", font: "inherit", padding: "5px 0", cursor: "pointer",
            // 심사 항목이 터치 영역 최소 44x44 다. 개발용 패널도 같은 화면 안에 있다.
            minHeight: 44,
          }}
        >
          앱 옆에 띄우기
        </button>
        <button
          type="button"
          onClick={onOpenLog}
          style={{
            flex: 1, background: "none", border: "1px solid #232326",
            borderRadius: 6, color: "#e8e8ea", font: "inherit", padding: "5px 0", cursor: "pointer",
            minHeight: 44,
          }}
        >
          크게 보기
        </button>
      </div>
      {목록.length === 0 ? (
        <div style={{ color: "#9a9aa2" }}>아직 오간 게 없습니다. QR 을 찍어 보세요.</div>
      ) : (
        <>
          <div style={{ color: "#9a9aa2", marginBottom: 6 }}>
            주고받은 요청 {목록.length}건 · 성공 {성공}건
          </div>
          {목록.map((x) => (
            <div key={x.시각 + x.경로} style={{ display: "flex", gap: 8, padding: "3px 0", borderTop: "1px solid #232326" }}>
              <span style={{
                color: x.상태 === "실패" ? "#ff6b6b" : (x.상태 as number) < 400 ? "#37d67a" : "#ffb020",
                width: 34, flexShrink: 0,
              }}>{x.상태}</span>
              <span style={{ flex: 1, wordBreak: "break-all" }}>{x.경로}</span>
              <span style={{ color: "#9a9aa2", flexShrink: 0 }}>{x.걸린시간}ms</span>
            </div>
          ))}
        </>
      )}
      </>
      )}
    </div>
  );
}

/**
 * 시연용 스위치를 보여 줄지.
 *
 * 이 패널은 실제 앱 화면이 아니라 시연·심사에서 예외 상태(애매·변경·안전 중단)를
 * 재현하려고 둔 것이다. 그냥 앱을 쓰는 사람에게는 무슨 물건인지 알 수 없고,
 * 배포본에 그대로 보이면 완성되지 않은 화면처럼 읽힌다.
 *
 * 그래서 기본은 감춘다. 필요할 때만 주소 뒤에 ?demo=1 을 붙인다.
 *   https://kiobridge-app.vercel.app/?demo=1
 *
 * 지우지 않고 남기는 이유는, 시연 영상에서 이 상태들을 보여 줘야 하는데
 * 실제로 그 상황을 만들려면 키오스크가 그렇게 답해 줘야 하기 때문이다.
 */
const 시연패널보임 =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";

/*
 * ?log=1 — 백엔드가 준 것을 그대로 보는 화면.
 *
 * 앱 화면 대신 이걸 그린다. 앱 안의 패널로 두면 오간 것을 다 펼쳐 볼 자리가
 * 없다(휴대폰 틀 안이라 좁고, 겹치면 아래 버튼을 덮는다). 확인하려고 만든
 * 화면이 확인을 방해하면 안 된다.
 */
const 로그값 =
  typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("log");
/** ?log=1 겹으로 · ?log=side 앱 옆에 나란히 */
const 처음로그모드: "닫힘" | "겹" | "나란히" =
  로그값 === "side" ? "나란히" : 로그값 === "1" ? "겹" : "닫힘";

function ScenarioPanel() {
  const [current, setCurrent] = useState<Scenario>(getScenario());
  const apply = (patch: Partial<Scenario>) => {
    setScenario(patch);
    setCurrent(getScenario());
  };

  const groups: { key: keyof Scenario; title: string; options: { value: string; label: string }[] }[] = [
    {
      key: "pairing", title: "QR 연결", options: [
        { value: "connected", label: "연결됨" },
        { value: "failed", label: "실패" },
        { value: "expired", label: "만료" },
      ],
    },
    {
      key: "mapping", title: "메뉴 매칭", options: [
        { value: "exact", label: "정확" },
        { value: "clarification", label: "애매" },
        { value: "not_found", label: "없음" },
        { value: "changed", label: "변경" },
        { value: "low_confidence", label: "불확실" },
      ],
    },
    {
      key: "execution", title: "실행", options: [
        { value: "cart_ready", label: "장바구니 담김" },
        { value: "aborted", label: "안전 중단" },
      ],
    },
  ];

  return (
    <aside
      className="hidden lg:flex flex-col gap-5 self-start"
      aria-label="시연용 시나리오 설정"
      style={{ width: 220, padding: 20, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "white" }}>시나리오</p>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, marginTop: 4 }}>
          다음 단계부터 적용돼요. 앱 화면에는 포함되지 않습니다.
        </p>
      </div>

      {groups.map(({ key, title, options }) => (
        <div key={key} className="flex flex-col gap-2">
          <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)" }}>{title}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={title}>
            {options.map(({ value, label }) => {
              const active = current[key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => apply({ [key]: value } as Partial<Scenario>)}
                  style={{
                    padding: "7px 12px", borderRadius: 100, cursor: "pointer",
                    fontSize: 12, fontWeight: 600, fontFamily: FONT, border: "none",
                    backgroundColor: active ? "white" : "rgba(255,255,255,0.10)",
                    color: active ? TEXT_1 : "rgba(255,255,255,0.7)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  // 주소로 정해진 값으로 시작하고, 그 뒤로는 패널 버튼으로 바꾼다 —
  // 주소를 바꾸면 페이지가 새로 떠서 기록이 사라지기 때문이다.
  const [로그모드, set로그모드] = useState(처음로그모드);
  /**
   * 새로고침 전에 하던 것. 없으면 null 이다.
   *
   * 한 번만 읽는다. 아래 useState 들이 이 값을 초기값으로 쓰므로 순서가 중요하다 —
   * 이 훅이 먼저 와야 한다.
   *
   * 접근성 설정은 여기서 바로 되돌린다. useEffect 로 미루면 첫 그림이 한 번 그려진
   * 뒤에 바뀌어서, 큰 글씨를 켜 둔 사람에게 작은 글씨가 번쩍하고 지나간다.
   * 도움이 필요해서 켠 설정이라 그 한 번이 그냥 깜빡임으로 끝나지 않는다.
   *
   * 바꾸기 가 아니라 되살리기 를 쓴다. 바꾸기 는 듣는이에게 알리는데, 여기는
   * 그리는 도중이라 그러면 React 가 경고한다. 바로 아래 접근성값 이 같은 값으로
   * 시작하므로 알릴 것도 없다.
   */
  const [이어받은] = useState(() => {
    const v = 이어쓰기.읽기();
    if (v) { 접근성설정.되살리기(v.a11y); 가격한도.되살리기(v.budget); 알레르기설정.되살리기(v.allergies); }
    return v;
  });
  const [screen, setScreen] = useState<Screen>(이어받은?.screen ?? "welcome");
  const [tab, setTab] = useState<MainTab>(이어받은?.tab ?? "menu");
  const [name, setName] = useState(이어받은?.name ?? "");
  /**
   * 로그인한 계정. null 이면 게스트다.
   *
   * 이 탭이 살아 있는 동안만 남는다(api/session.ts 의 sessionStorage). 새로고침해도
   * 풀리지 않고, 탭을 닫으면 사라진다 — 개인정보 안내 화면이 약속한 "이번 이용이
   * 끝나면 남지 않아요" 가 그 말이다. localStorage 로 옮기면 다음에 이 기기를 켠
   * 사람이 앞사람 계정으로 들어가 있게 되므로 옮기지 말 것.
   *
   * 비밀번호는 어디에도 남기지 않는다. 여기 있는 것은 { userId, loginId } 뿐이다.
   *
   * 서버가 토큰을 주지 않는다 — 응답이 { userId, loginId } 뿐이다. 그래서 여기 있는 것은
   * 인증 증명이 아니라 식별자다. 이 값으로 할 수 있는 일은 주문표를 불러오고 올리는 것뿐이고,
   * 화면 어디에도 "안전하게 보관됩니다" 같은 말을 쓰지 않는다.
   */
  const [계정, set계정] = useState<Account | null>(이어받은?.account ?? null);
  /*
   * 게스트인지는 계정에서 나오는 값이다. 따로 useState 로 두면 둘이 어긋난다 —
   * 예전에는 로그인 화면으로 '들어갈 때' guest 를 false 로 만들어서, 로그인하지 않고
   * 뒤로 가면 로그인한 적 없는 사람이 회원으로 남았다.
   */
  const guest = 계정 === null;
  /**
   * 서버에서 불러온 주문표의 id.
   *
   * 로그아웃할 때 이것만 목록에서 뺀다. 전부 지우면 로그인 전에 게스트로 만들어 둔 주문표까지
   * 사라지고, 남겨 두면 다음 사람이 이 기기를 열었을 때 앞사람 주문표가 그대로 보인다.
   *
   * 새로고침해도 이어진다. 안 이어 주면 되살아난 목록에서 어느 것이 서버 것인지 알 수
   * 없어져서, 로그아웃해도 앞사람 주문표가 그대로 남는다.
   */
  const 서버에서온것 = useRef<Set<string>>(new Set(이어받은?.fromServer ?? []));
  /**
   * 계정이 몇 번 바뀌었는지. 로그인·로그아웃·정보 지우기가 이 값을 올린다.
   *
   * 서버 요청을 보낼 때 이 값을 적어 두고, 답이 왔을 때 아직 같은지 본다. 다르면 버린다.
   * 없으면 늦게 도착한 답이 이미 지운 주문표를 되살린다 — 화면이 "모두 지웠어요" 라고
   * 말한 뒤에 목록이 되돌아오는 것이라, 지킬 수 없는 약속을 한 셈이 된다.
   */
  const 계정세대 = useRef(0);
  /** 큰 글씨 모드. 휴대폰 틀 안 전체에 적용된다. */
  /*
   * 접근성 설정. 저장소는 api/a11y.ts 에 있고 화면은 그걸 비춘다.
   *
   * 상태를 여기 두지 않는 이유는 연동 계층(backend.ts)도 이 값을 읽어야 해서다 —
   * 서버로 보내는 표준형에 그대로 실린다. React 상태로만 두면 그쪽에서 못 읽는다.
   */
  const [접근성값, set접근성값] = useState<도움설정>(() => 접근성설정.읽기());
  useEffect(() => 접근성설정.구독(() => set접근성값({ ...접근성설정.읽기() })), []);
  /*
   * 가격 한도. 저장소는 api/budget.ts 에 있고 화면은 그걸 비춘다 — 접근성과 같은 이유다.
   * 연동 계층(backend.ts)도 이 값을 읽어야 한다. 서버로 나가는 hardConstraints 에 실린다.
   */
  const [예산, set예산] = useState<number | null>(() => 가격한도.읽기());
  /*
   * 늘 피해야 하는 것. 저장소는 api/allergy.ts 에 있고 화면은 그걸 비춘다 —
   * 연동 계층도 이 값을 읽어야 한다(주문표의 알레르기와 합쳐서 서버로 나간다).
   */
  const [알레르기, set알레르기] = useState<AllergenId[]>(() => 알레르기설정.읽기());
  useEffect(() => 알레르기설정.구독(() => set알레르기([...알레르기설정.읽기()])), []);
  useEffect(() => 가격한도.구독(() => set예산(가격한도.읽기())), []);
  const largeText = 접근성값.largeText;
  /*
   * 되살릴 때 서버에서 다시 불러오지 않는다.
   *
   * 마지막으로 보고 있던 목록을 그대로 돌려주는 편이 낫다. 다시 불러오면 새로고침할
   * 때마다 기다리는 화면이 끼어들고, 서버가 느리거나 안 되는 날에는 있던 주문표가
   * 잠깐 사라졌다 나타난다. 목록을 맞추는 일은 다음 로그인 때 이미 하고 있다.
   */
  const [sheets, setSheets] = useState<OrderSheet[]>(이어받은?.sheets ?? []);
  const [fromQr, setFromQr] = useState(false);
  const [qrKey, setQrKey] = useState(0);
  // 되돌릴 수 없는 동작은 물어보고 실행한다. null 이면 물어볼 게 없다는 뜻이다.
  const [확인대기, set확인대기] = useState<{ title: string; body: string; confirmLabel: string; run: () => void } | null>(null);
  const [pairingId, setPairingId] = useState<string | null>(null);
  // 만료 시각을 루트가 들고 있어야 한다. 예전에는 QrScreen 안에만 있어서
  // 주문표를 고르는 순간 그 화면이 사라지고 감시도 같이 사라졌다.
  // 그러면 이미 끝난 연결로 승인까지 진행되고, 화면은 아무 말도 하지 않는다.
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  // 연결된 키오스크 이름. QR 탭으로 돌아왔을 때 무엇에 연결돼 있는지 말하려면 필요하다.
  const [pairingKiosk, setPairingKiosk] = useState<string | null>(null);
  // 만료 때문에 QR 화면으로 되돌아왔는지. 되돌아왔으면 안내부터 띄운다.
  const [qrExpired, setQrExpired] = useState(false);
  const [orderSheet, setOrderSheet] = useState<OrderSheet | null>(null);
  /*
   * 연결(pairingId)은 안 이어 받는데 이것만 이어 받는다. 되살린 값으로 하는 일이
   * 읽기뿐이라서다 — 진행 상황을 물어보는 GET 하나다. 계획을 새로 만들거나 실행하는
   * 것은 승인 버튼에서만 일어나고(P0-4), 그 버튼은 살아 있는 연결을 필요로 한다.
   *
   * 안 이어 받으면 키오스크는 계속 움직이는데 앱만 목록으로 돌아간다. 대신 봐 주는
   * 앱에서 지켜볼 수 없게 되는 것이 가장 나쁘다.
   */
  const [planId, setPlanId] = useState<string | null>(이어받은?.planId ?? null);

  /**
   * 이번 이용을 새로고침 너머로 넘긴다.
   *
   * 연결·확인 카드·비밀번호는 담기지 않는다. 무엇을 담고 무엇을 안 담는지는
   * api/session.ts 에 적어 두었다.
   *
   * 서버에서온것 은 ref 라 이 목록에 넣어도 다시 그려지지 않는다. 그래도 새는 곳이
   * 없다 — 이 값이 바뀌는 자리(로그인·로그아웃·정보 지우기)는 전부 계정이나 sheets 도
   * 같이 바꾼다. 그때 이 효과가 함께 돈다.
   */
  useEffect(() => {
    이어쓰기.쓰기({
      screen, tab, name, account: 계정, sheets,
      fromServer: [...서버에서온것.current],
      a11y: 접근성값, allergies: 알레르기, budget: 예산, planId,
    });
  }, [screen, tab, name, 계정, sheets, 접근성값, 알레르기, 예산, planId]);

  const addSheet = (p: OrderSheet) => setSheets((prev) => [...prev, p]);
  // 화면에서만 지우면 목에 등록해 둔 사본이 남는다. 둘을 같이 지운다.
  const deleteSheet = (id: string) => {
    const 이름 = sheets.find((p) => p.id === id)?.menuName ?? "이 주문표";
    set확인대기({
      title: `'${이름}'을 지울까요?`,
      body: "지우면 되돌릴 수 없어요. 저장해 두신 조건이 함께 사라져요.",
      confirmLabel: "지우기",
      run: () => {
        unregisterSheet(id);
        setSheets((prev) => prev.filter((p) => p.id !== id));
        /*
         * 로그인했으면 서버에서도 지운다.
         *
         * 예전에는 이 기기에서만 지웠다. 화면은 "지우면 되돌릴 수 없어요" 라고
         * 말해 놓고, 다음에 로그인하면 그 주문표가 그대로 돌아왔다.
         *
         * 서버에서온것 으로 거르지 않는다 - 그 집합은 서버에서 '불러온' 것만
         * 담는다. 이 기기에서 만들어 올린 주문표는 거기 없어서, 걸러 내면 정작
         * 지워야 할 것을 빠뜨린다. 없는 것을 지워도 204 라 그냥 다 보낸다.
         */
        if (계정) 서버주문표지우기(계정.userId, [id]);
      },
    });
  };

  /**
   * 서버에 남은 것까지 지운다.
   *
   * 실패를 삼키지 않는다. 개인정보를 지웠다는 약속이라 안 지워졌으면 그렇게 말해야 한다.
   * 재시도도 자기 자신을 부르므로 두 번째·세 번째 실패도 조용히 넘어가지 않는다.
   */
  const 서버까지지우기 = (): void => {
    api.forgetAll().catch((e: KioBridgeError) => {
      set확인대기({
        title: "일부를 지우지 못했어요",
        body: `${e?.message ?? "서버에 남은 정보를 지우지 못했어요"}. 화면에서는 지워졌지만 서버에는 남아 있을 수 있어요.`,
        confirmLabel: "다시 시도",
        run: 서버까지지우기,
      });
    });
  };

  /**
   * 주문표 하나를 서버에 올린다. 로그인한 사람에게만 일어난다.
   *
   * 실패해도 이 기기에는 이미 저장돼 있으므로 흐름을 막지 않는다. 다만 조용히 삼키지는
   * 않는다 — 삼키면 "저장했어요" 가 절반만 사실이 되고, 사용자는 다음에 열었을 때
   * 없어진 것을 보고서야 알게 된다. 재시도도 자기 자신을 부른다.
   */
  const 주문표올리기 = (userId: number, p: OrderSheet, 세대 = 계정세대.current): void => {
    /*
     * 언제 부르든 그때의 계정이 맞는지 먼저 본다.
     *
     * 확인창의 '다시 시도' 는 사용자가 원할 때 눌린다. 그 사이에 로그아웃하고
     * 다른 계정으로 들어갈 수 있다. 예전에는 실패한 순간에만 세대를 봐서,
     * 다음 순서가 그대로 통했다.
     *
     *   ① A 로 저장 → 업로드 실패 → 확인창이 뜬다
     *   ② 확인창을 둔 채 로그아웃하고 B 로 로그인한다
     *   ③ '다시 시도' 를 누른다 → A 의 userId 로 요청이 나간다
     *
     * B 가 쓰는 기기에서 A 의 계정에 데이터가 올라간다. 재시도는 처음의 세대를
     * 그대로 들고 다니므로, 계정이 바뀌었으면 여기서 조용히 끝난다.
     */
    if (세대 !== 계정세대.current) return;
    account.saveSheet(userId, p).catch((e: KioBridgeError) => {
      // 기다리는 사이 로그아웃했거나 정보를 지웠으면 묻지 않는다. 나간 사람에게
      // 남의 계정으로 다시 올리겠냐고 묻는 셈이 된다.
      if (세대 !== 계정세대.current) return;
      set확인대기({
        title: "이 기기에는 저장했어요",
        body: `${e?.message ?? "서버에 올리지 못했어요"} 지금은 이 기기에만 있어서, 다음에 로그인하면 안 보일 수 있어요.`,
        confirmLabel: "다시 시도",
        run: () => 주문표올리기(userId, p, 세대),
      });
    });
  };

  /**
   * 서버에 있는 주문표를 지운다. 실패한 것은 삼키지 않는다.
   *
   * 이 기기에서 지우는 것은 이미 끝났고 되돌리지 않는다 - 사용자가 원한 것이
   * 그것이고, 서버가 안 된다고 이 기기에 남겨 두면 더 나쁘다.
   *
   * 다만 조용히 넘기면 화면은 "서버에 올라간 주문표도 함께 지워져요" 라고
   * 말해 놓고 실제로는 남는다. 그러면 다시 로그인했을 때 지운 줄 알았던 것이
   * 그대로 보인다. 실패한 것만 모아서 알리고 다시 시도할 길을 준다.
   *
   * 세대는 보지 않는다. 주문표올리기 와 다른 점이다 - 저기는 '이 계정에 올릴까'
   * 를 묻는 것이라 계정이 바뀌면 물으면 안 되지만, 여기는 사용자가 이미
   * 지우겠다고 한 것을 끝내는 일이다. 로그아웃했다고 그만둘 이유가 없다.
   */
  /**
   * 서버에 있는 것까지 빠짐없이 지운다. '이 기기에서 정보 지우기' 가 쓴다.
   *
   * 화면에 있는 id 만 지우면 새는 자리가 있다. 로그인 직후 목록을 불러오는
   * 중에 정보 지우기를 누르면, 서버에만 있던 주문표는 아직 sheets 에 없다.
   * 게다가 계정세대가 올라가서 늦게 도착한 목록도 버려진다 - 그 주문표에는
   * DELETE 가 한 번도 안 간다.
   *
   * 그래서 먼저 목록을 받아 합친다. 목록을 못 받으면 아는 것만 지우고,
   * **다 지웠다고 말하지 않는다** - 화면이 "서버에 올라간 주문표도 함께
   * 지워요" 라고 약속했으므로, 못 지킨 것은 못 지켰다고 말해야 한다.
   */
  const 서버주문표모두지우기 = (userId: number, 아는것: string[]): void => {
    account.listSheets(userId).then(
      (목록) => 서버주문표지우기(userId, [...new Set([...아는것, ...목록.map((p) => p.id)])]),
      // 목록을 못 받았다는 사실을 아래로 넘긴다. 여기서 확인창을 따로 띄우면
      // 삭제가 끝난 뒤 뜨는 창이 그걸 덮어쓴다 - 확인창 자리가 하나뿐이다.
      () => 서버주문표지우기(userId, 아는것, true),
    );
  };

  /**
   * @param 목록못봄 서버 목록을 못 받은 채로 지우는 중인가.
   *
   * 이 값이 참이면 **지우지 못한 것이 없어도 알린다.** 화면이 "서버에 올라간
   * 주문표도 함께 지워요" 라고 약속했는데, 무엇이 올라가 있었는지조차 모르는
   * 상태라 다 지켰다고 말할 수 없다.
   *
   * 다시 시도도 갈래가 다르다. 목록을 못 봤으면 목록부터 다시 받아야 한다 -
   * 못 지운 것만 다시 지우면, 처음 조회에서 빠진 서버 주문표는 영영 안 지워진다.
   */
  const 서버주문표지우기 = (userId: number, ids: string[], 목록못봄 = false): void => {
    if (ids.length === 0 && !목록못봄) return;
    void Promise.all(
      ids.map((id) => account.deleteSheet(userId, id).then(() => null, () => id)),
    ).then((결과) => {
      const 못지운것 = 결과.filter((x): x is string => x !== null);
      if (못지운것.length === 0 && !목록못봄) return;
      set확인대기({
        title: 목록못봄 ? "서버에 무엇이 남았는지 확인하지 못했어요" : "이 기기에서는 지웠어요",
        body: 목록못봄
          ? (못지운것.length === 0
            ? "화면에 있던 주문표는 지웠지만, 서버 목록을 못 받아서 남은 것이 있는지 알 수 없어요."
            : `서버 목록을 못 받았고, 지우지 못한 주문표도 ${못지운것.length}개 있어요. 남은 것이 더 있을 수 있어요.`)
          : `서버에 있는 주문표 ${못지운것.length}개를 지우지 못했어요. 그대로 두면 다시 로그인했을 때 보입니다.`,
        confirmLabel: "다시 시도",
        run: () => (목록못봄
          ? 서버주문표모두지우기(userId, ids)
          : 서버주문표지우기(userId, 못지운것)),
      });
    });
  };

  /**
   * 새 주문표를 저장한다. 로그인했으면 서버에도 올린다.
   *
   * 장소를 안 고른 주문표는 올리지 않는다 — 서버의 place 가 @NotBlank 라 400 이 나는데,
   * 그 400 은 code 도 message 도 없는 스프링 기본 응답이라 사용자에게 이유를 말해 줄 수 없다.
   * 대신 주문표 화면이 저장하기 전에 미리 알려 준다(아래 OrderSheetScreen 의 안내 한 줄).
   */
  const 주문표저장 = (p: OrderSheet): void => {
    addSheet(p);
    setScreen("saved");
    setTab("menu");
    // 못올리는이유() 는 이유 문자열이거나 null 이다. null 일 때만 올린다.
    if (계정 && 못올리는이유(p) === null) 주문표올리기(계정.userId, p);
  };

  /**
   * 로그인·회원가입이 끝났다.
   *
   * 서버에 저장해 둔 주문표를 가져와 목록 앞에 붙인다. 같은 id 는 서버 것으로 덮는다 —
   * 서버가 최신이다. 게스트로 만들어 둔 주문표는 지우지 않는다. 방금 만든 것이
   * 로그인했다는 이유로 사라지면 그게 가장 나쁘다.
   *
   * 불러오기에 실패해도 로그인 자체는 된 것이다. 다만 말은 해 준다 — 아무 말 없이
   * 빈 목록을 보여 주면 사용자는 저장해 둔 게 사라진 줄 안다.
   */
  const 계정으로들어가기 = (a: Account, 다음화면: Screen): void => {
    계정세대.current += 1;
    const 내세대 = 계정세대.current;
    set계정(a);
    setScreen(다음화면);
    if (다음화면 === "saved") setTab("menu");

    const 불러오기 = (): void => {
      account.listSheets(a.userId)
        .then((서버것) => {
          /*
           * 늦게 온 답을 그대로 넣으면 이미 지운 것이 되살아난다. 두 경우가 있었다.
           *
           *   ① 기다리는 동안 로그아웃한다 → 게스트 화면에 앞사람 주문표가 남는다.
           *   ② 기다리는 동안 '이 기기에서 정보 지우기' 를 누른다 → 비운 목록이 되돌아온다.
           *
           * 둘째가 특히 나쁘다. 화면이 지웠다고 말해 놓고 실제로는 안 지운 것이 된다.
           * 계정이 바뀌는 모든 자리에서 세대를 올리고, 답이 오면 내 세대인지 먼저 본다.
           */
          if (내세대 !== 계정세대.current) return;
          if (서버것.length === 0) return;
          for (const p of 서버것) 서버에서온것.current.add(p.id);
          setSheets((prev) => {
            const 서버id = new Set(서버것.map((p) => p.id));
            return [...서버것, ...prev.filter((p) => !서버id.has(p.id))];
          });
        })
        .catch((e: KioBridgeError) => {
          // 이미 나간 사람에게 다시 시도하겠냐고 묻지 않는다.
          if (내세대 !== 계정세대.current) return;
          set확인대기({
            title: "저장해 두신 주문표를 못 불러왔어요",
            body: `${e?.message ?? "서버에 연결하지 못했어요"} 로그인은 됐어요. 이 기기에 있는 주문표는 그대로 쓸 수 있어요.`,
            confirmLabel: "다시 시도",
            run: 불러오기,
          });
        });
    };
    불러오기();
  };

  /**
   * 로그아웃.
   *
   * 서버에서 불러온 주문표는 목록에서 뺀다. 남겨 두면 로그아웃했는데도 그 사람 주문표가
   * 화면에 그대로 있고, 다음 사람이 이 기기를 열었을 때 앞사람 것을 보게 된다.
   * 게스트로 만든 주문표는 이 기기 것이므로 건드리지 않는다.
   */
  const 로그아웃 = (): void => {
    // 아직 오는 중인 답을 무효로 만든다. 안 그러면 로그아웃한 뒤에 도착한 목록이
    // 방금 뺀 주문표를 그대로 돌려놓는다.
    계정세대.current += 1;
    // 떠 있는 확인창도 닫는다. 앞 계정에 대해 묻고 있던 창을 다음 사람이 받는다.
    set확인대기(null);
    const 뺄것 = 서버에서온것.current;
    setSheets((prev) => prev.filter((p) => !뺄것.has(p.id)));
    for (const id of 뺄것) unregisterSheet(id);
    서버에서온것.current = new Set();
    set계정(null);
    setName("");
    setFromQr(false);
    setTab("menu");
    setScreen("welcome");
    /*
     * 알레르기도 비운다.
     *
     * 로그아웃은 이 기기를 다음 사람에게 넘기는 자리이기도 하다. 남겨 두면 다음
     * 사람의 주문이 **앞사람의 알레르기로** 걸러지고, 정작 자기 것은 안 걸러진다.
     * 화면에는 알레르기가 설정된 것처럼 보이니 더 나쁘다 — 걸러지는 줄 알고
     * 승인한다.
     *
     * 다시 고르는 값이 여섯 칸뿐인 것과, 안 걸러져서 못 먹는 것을 먹는 것 중
     * 어느 쪽이 나쁜지는 분명하다.
     */
    알레르기설정.비우기();
    // 적어 둔 것도 같이 지운다. 안 지우면 새로고침 한 번에 로그아웃이 되돌아간다.
    // 위의 setState 들이 끝나면 저장 효과가 한 번 더 도는데, 그때는 담을 것이
    // 남아 있지 않아서 다시 쓰이지 않는다(session.ts 의 남길것이있나).
    이어쓰기.비우기();
  };

  // 연결이 끝나면 어느 화면에 있든 되돌린다.
  // 실행 중일 때는 건드리지 않는다. 이미 키오스크가 움직이고 있는데 화면만
  // 되돌리면 사용자는 무슨 일이 일어난 건지 알 수 없다. 그 화면은 자기 상태를
  // 폴링으로 따로 관리한다.
  useEffect(() => {
    if (!pairingExpiresAt || screen === "execution") return;
    /*
     * '시간 여유' 를 켜면 만료돼도 화면을 멋대로 되돌리지 않는다.
     *
     * 서버 세션은 어차피 끊긴다 — 그건 앱이 늘릴 수 없다. 앱이 할 수 있는 것은
     * 보고 있던 화면을 갑자기 걷어내지 않는 것이다. 천천히 읽는 사람에게는
     * 읽던 화면이 통째로 바뀌는 일이 가장 곤란하다. 다음에 승인을 누를 때
     * 서버가 만료를 알려 주고, 그때 사용자가 스스로 다시 찍으면 된다.
     */
    if (접근성값.mobilitySupport) return;
    const 남은 = pairingExpiresAt - Date.now();
    const 되돌리기 = () => {
      setPairingId(null);
      setPairingExpiresAt(null);
      setPairingKiosk(null);
      setOrderSheet(null);
      setFromQr(false);
      setScreen("saved");
      setTab("qr");
      setQrExpired(true);
      setQrKey((k) => k + 1);
    };
    if (남은 <= 0) { 되돌리기(); return; }
    const t = setTimeout(되돌리기, 남은);
    return () => clearTimeout(t);
  }, [pairingExpiresAt, screen, 접근성값.mobilitySupport]);

  // 화면이 바뀌면 포커스가 <body> 로 떨어진다. 누르던 버튼이 사라지기 때문이다.
  // 스크린리더 사용자는 자기가 어디로 갔는지 듣지 못하고, 키보드 사용자는
  // 문서 처음부터 다시 Tab 을 눌러야 한다.
  //
  // 적을 게 하나뿐인 화면(전화번호·호칭·인증번호)에서는 그 칸으로 보낸다.
  // 이 효과가 없던 때는 input 의 autoFocus 가 그 일을 했는데, autoFocus 는
  // 커밋 단계라 부모 useEffect 보다 먼저 실행된다. 제목으로만 옮기면
  // autoFocus 를 덮어써서 휴대폰 키보드가 안 올라오고, 어르신은 칸을 한 번 더
  // 눌러야 한다. 스크린리더에는 input 의 라벨이 읽히므로 잃는 것도 없다.
  //
  // 적을 게 없는 화면에서는 첫 제목으로 보내 "여기가 어디인지" 부터 들려준다.
  const 화면영역 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const 뿌리 = 화면영역.current;
    if (!뿌리) return;
    // data-autofocus 로 표시한다. React 는 autoFocus prop 을 DOM 속성으로 남기지 않고
    // 커밋 때 focus() 를 직접 부르므로, [autofocus] 로는 찾을 수 없다.
    const 대상 =
      뿌리.querySelector<HTMLElement>("[data-autofocus]") ??
      뿌리.querySelector<HTMLElement>("h1, h2, [data-screen-title]");
    if (!대상) return;
    // 제목은 원래 포커스를 못 받는 요소라 한 번만 열어 준다.
    // 탭 순서에는 들어가지 않도록 -1 로 둔다.
    if (!대상.hasAttribute("tabindex") && !(대상 instanceof HTMLInputElement) && !(대상 instanceof HTMLTextAreaElement)) {
      대상.setAttribute("tabindex", "-1");
    }
    대상.focus({ preventScroll: true });

    /*
     * 소리 안내를 켠 분에게는 같은 것을 소리로도 한 번 읽어 준다.
     *
     * 포커스가 가는 그 요소를 읽는다 - 스크린리더가 읽는 것과 같은 자리다.
     * 따로 고르면 화면이 바뀔 때 눈으로 보는 것과 귀로 듣는 것이 갈린다.
     *
     * 제목만 읽고 본문은 안 읽는다. 화면 전체를 읽으면 다음 화면으로 넘어갈 때까지
     * 계속 말하게 되고, 급한 사람은 말이 끝나기를 기다려야 한다. 어디에 왔는지만
     * 알려 주고 나머지는 화면에 그대로 있다.
     */
    if (접근성값.voiceGuide) 읽어주기(대상.innerText || 대상.textContent || "");
  }, [screen, tab, 접근성값.voiceGuide]);

  /*
   * 스위치를 끄거나 화면을 떠나면 읽던 것을 멈춘다.
   *
   * 안 멈추면 끈 뒤에도 하던 말을 끝까지 한다. 끄는 사람은 지금 조용해지기를
   * 바라는 것이라, 그 한 문장이 가장 거슬린다.
   */
  useEffect(() => {
    if (!접근성값.voiceGuide) 그만읽기();
    return 그만읽기;
  }, [접근성값.voiceGuide]);

  const inMain = screen === "saved";

  const handleTabChange = (t: MainTab) => {
    // 만료 안내는 만료된 그 순간 한 번만 보여 준다. 안 풀어 주면 그 뒤로
    // QR 탭에 들어갈 때마다 지난 만료 안내부터 뜬다.
    if (t === "qr") { setQrKey((k) => k + 1); setQrExpired(false); }
    setTab(t);
    setScreen("saved");
    // 연결이 아직 살아 있으면 주문 경로를 유지한다. 예전에는 무조건 껐더니
    // 하단 탭으로 '내 주문표'에 가는 순간 주문 버튼이 사라졌고,
    // QR 을 다시 찍는 것 말고는 되돌릴 방법이 없었다.
    if (!pairingId) setFromQr(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center gap-8 p-6"
      style={{ backgroundColor: BACKDROP, fontFamily: FONT }}
    >
      <style>{PALETTE_STYLES}{FOCUS_STYLES}</style>
      {시연패널보임 && <ScenarioPanel />}
      {/* 나란히 보는 중에는 구석 패널을 감춘다. 같은 것을 두 번 띄울 이유가 없다. */}
      {팀백엔드모드 && 로그모드 !== "나란히" && (
        <연동표시 onOpenLog={() => set로그모드("겹")} onOpenSide={() => set로그모드("나란히")} />
      )}
      {/*
        앱을 덮는 겹으로 띄운다. 다른 주소로 옮기면 페이지가 새로 뜨고 기록은
        메모리에만 있어서 그때 다 사라진다 — 주문을 마치고 보러 가면 늘 0건이 된다.
      */}
      {/*
        겹 모드에는 목이든 실서버든 언제나 닫는 길을 준다.
        앱 전체를 덮는 대화상자라 닫기가 없으면 키보드 사용자가 갇힌다 —
        다시 못 여는 것보다 못 나가는 쪽이 훨씬 나쁘다. 다시 열려면 주소를
        새로 치면 되고, 그때 기록이 사라지는 것은 감수할 만하다.
      */}
      {로그모드 === "겹" && <BackendLog onClose={() => set로그모드("닫힘")} />}
      {/*
        큰 글씨 모드. 화면 크기(휴대폰 틀)는 그대로 두고 안쪽 내용만 키운다.
        바깥 틀은 실제 크기(FRAME_W × FRAME_H)를 잡고, 안쪽은 그 크기를 배율로 나눠 잡는다.
        zoom 이 다시 배율을 곱하므로 최종 렌더 크기는 틀과 정확히 같아진다.
      */}
      <div style={{ width: "100%", maxWidth: FRAME_W, height: FRAME_H }}>
        <div
          ref={화면영역}
          /*
           * 고대비는 색 토큰을 갈아 끼워서 만든다. tokens.ts 의 PALETTE_STYLES 가
           * 이 표시를 보고 CSS 변수를 다른 값으로 채운다.
           *
           * 예전에는 filter: contrast(1.3) 이었는데 그게 화면을 더 나쁘게 만들었다 -
           * 흰색에 가까운 값이 전부 순백으로 뭉개져서 카드 경계가 사라졌다.
           */
          data-contrast={접근성값.highContrast ? "high" : undefined}
          className="kb-paper overflow-hidden flex flex-col"
          style={{
            zoom: largeText ? LARGE_TEXT_SCALE : 1,
            width: largeText ? FRAME_W / LARGE_TEXT_SCALE : "100%",
            height: largeText ? FRAME_H / LARGE_TEXT_SCALE : FRAME_H,

            // absolute 로 띄우는 것들(확인 시트·QR 스캐너)이 이 안에 갇히려면
            // 여기가 컨테이닝 블록이어야 한다. overflow-hidden 만으로는
            // 자기가 기준이 아니면 클리핑도 못 해서 화면 전체를 덮어 버린다.
            position: "relative",
            borderRadius: 54, boxShadow: "0 24px 80px rgba(0,0,0,0.16)",
          }}
        >
        <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          {screen === "welcome" && (
            <WelcomeScreen
              // 익명 시작: 계정 화면을 거치지 않고 바로 본 화면으로 간다.
              onStart={() => { setName(""); setScreen("saved"); setTab("menu"); }}
              // 선택적 로그인: 고른 사람만 계정 경로로 간다. 여기서 뒤로 가면
              // 아무 일도 없었던 것이 되어야 하므로 계정 상태는 아직 건드리지 않는다.
              onLogin={() => setScreen("login")}
            />
          )}
          {screen === "login" && (
            <LoginScreen
              // 이미 계정이 있는 사람이다. 호칭은 서버가 갖고 있지 않지만 다시 묻지 않는다 —
              // 로그인할 때마다 호칭을 적게 하면 로그인이 가입보다 번거로워진다.
              // 계정 화면은 호칭이 없으면 아이디를 부른다.
              onDone={(a) => 계정으로들어가기(a, "saved")}
              onBack={() => setScreen("welcome")}
              onGoSignup={() => setScreen("signup")}
            />
          )}
          {screen === "signup" && (
            <SignupScreen
              // 가입 직후에는 서버에 주문표가 없다. 그래도 같은 경로를 탄다 —
              // 갈래를 둘로 두면 한쪽만 고치는 날이 온다. 빈 목록이면 아무 일도 안 한다.
              onDone={(a) => 계정으로들어가기(a, "name")}
              onBack={() => setScreen("login")}
              onGoLogin={() => setScreen("login")}
            />
          )}
          {screen === "name" && (
            <NameScreen
              onNext={(n) => { setName(n); setScreen("setup"); }}
              // 가입은 이미 끝났다. 뒤로 가도 가입 화면으로 돌아가지 않는다 —
              // 돌아가면 같은 아이디로 또 가입하려다 "이미 쓰고 있는 아이디예요" 를 만난다.
              onBack={() => { setScreen("saved"); setTab("menu"); }}
            />
          )}
          {screen === "setup" && (
            <SetupScreen
              설정={접근성값}
              알레르기={알레르기}
              on알레르기={(id) => 알레르기설정.뒤집기(id)}
              // 계정 화면의 접근성 설정과 같은 저장소에 쓴다. 여기서 켠 것이
              // 거기서도 켜져 있어야 한다 — 두 화면이 같은 스위치를 다루므로.
              onChange={(한칸) => 접근성설정.바꾸기(한칸)}
              onNext={() => setScreen("greeting")}
              // 호칭 화면으로 되돌아간다. 여기까지 왔으면 호칭은 이미 적었고,
              // 고쳐 적고 싶을 수 있는 유일한 앞 단계다.
              onBack={() => setScreen("name")}
            />
          )}
          {screen === "greeting" && (
            <GreetingScreen name={name} onNext={() => { setScreen("saved"); setTab("menu"); }} />
          )}
          {screen === "sheet" && (
            <OrderSheetScreen
              로그인함={!guest}
              onNext={주문표저장}
              onBack={() => setScreen("saved")}
            />
          )}
          {inMain && tab === "qr" && (
            <QrScreen
              key={qrKey}
              initialPhase={qrExpired ? "expired" : "scan"}
              // 연결이 살아 있으면 스캐너부터 열지 않는다. 예전에는 QR 탭에 들어갈
              // 때마다 검은 스캐너가 떠서, 연결이 멀쩡한데도 끊긴 것처럼 보였다.
              // 같은 상태를 두고 주문 화면과 QR 화면이 다른 이야기를 했다.
              connected={
                pairingId && pairingExpiresAt
                  ? { pairingId, expiresAt: pairingExpiresAt, kioskName: pairingKiosk ?? "키오스크" }
                  : null
              }
              onPaired={(id, exp, kiosk) => { setPairingId(id); setPairingExpiresAt(exp); setPairingKiosk(kiosk); setQrExpired(false); setFromQr(true); setTab("menu"); }}
            />
          )}
          {inMain && tab === "menu" && (
            <SavedSheetsScreen
              sheets={sheets}
              onAddSheet={() => { setScreen("sheet"); }}
              onDeleteSheet={deleteSheet}
              // 매핑을 요청하기 전에 이 주문표를 서버가 찾을 수 있게 등록한다.
              // 실서비스에서는 주문표 저장 시점에 서버로 올라가고 이 줄은 사라진다.
              onOrder={(p) => { registerSheet(p); setOrderSheet(p); setScreen("order-confirm"); }}
              showOrder={fromQr}
              예산={예산}
              on예산={(원) => 가격한도.바꾸기(원)}
            />
          )}
          {screen === "order-confirm" && pairingId && orderSheet && (
            <OrderConfirmScreen
              pairingId={pairingId}
              sheet={orderSheet}
              onBack={() => setScreen("saved")}
              onApproved={(id) => { setPlanId(id); setScreen("execution"); }}
            />
          )}
          {screen === "execution" && planId && (
            <ExecutionScreen
              planId={planId}
              onHome={() => {
                setScreen("saved"); setFromQr(false);
                setPlanId(null); setOrderSheet(null); setPairingId(null); setPairingExpiresAt(null); setPairingKiosk(null);
              }}
            />
          )}
          {inMain && tab === "account" && (
            <AccountScreen
              // 호칭을 안 적은 사람도 있다(로그인만 한 경우). 그때는 아이디로 부른다.
              // "사용자님" 은 마지막 수단이다 — 게스트에게는 이 값을 쓰지 않는다.
              name={name || 계정?.loginId || ""}
              guest={guest}
              onLogout={로그아웃}
              onLogin={() => setScreen("login")}
              // 저장된 정보를 지우는 길. 주문표까지 함께 비운다.
              onClearLocal={() => set확인대기({
                title: "이 기기에서 정보를 지울까요?",
                body: 계정
                  // 서버 주문표까지 지운다(팀 #79). 주문 기록은 여전히 남으므로
                  // 뭉뚱그리지 않는다. 못 지운 것이 있으면 지운 뒤에 알린다.
                  ? "이 기기에 있는 주문표와 호칭이 사라지고 로그아웃돼요. 서버에 저장해 둔 주문표도 함께 지워져요. 다만 키오스크에 보낸 주문 기록은 남아요."
                  : "저장한 주문표와 호칭이 모두 사라져요. 되돌릴 수 없어요.",
                confirmLabel: "모두 지우기",
                run: () => {
                  // 목 전용 함수가 아니라 계약의 삭제 메서드를 부른다.
                  // 실제 client 로 바꿔도 서버에 남은 것까지 함께 지워진다.
                  // 접근성 설정도 함께 비운다. 안 그러면 다음 사람이 앞사람의 도움
                  // 설정을 그대로 보게 되고, 그 값이 서버로도 계속 나간다.
                  // 화면이 '모두 지워요' 라고 말한 것에 이것도 들어간다.
                  접근성설정.비우기();
                  // 가격 한도도 내가 정한 값이다. 남겨 두면 다음 사람이 앞사람의 한도로
                  // 걸러진 목록을 보게 되고, 왜 메뉴가 적게 나오는지 알 수 없다.
                  가격한도.비우기();
                  // 알레르기도 지운다. 남겨 두면 다음 사람이 앞사람의 알레르기로
                  // 걸러진 목록을 보게 되고, 정작 자기 것은 안 걸러진다.
                  알레르기설정.비우기();
                  서버까지지우기();
                  /*
                   * 서버에 올라간 주문표도 지운다 (팀 #79 의 DELETE).
                   *
                   * 화면이 "모두 지워요" 라고 말하는데 서버에 남으면 다시
                   * 로그인했을 때 그대로 보인다. 지금 화면에 있는 것을 전부
                   * 지우려 든다 - 그중 서버에 안 올라간 것도 섞여 있지만
                   * 없는 것을 지워도 204 라 문제가 없다.
                   *
                   * 실패해도 붙잡지 않는다. 사용자는 이미 지우겠다고 했고
                   * 그 뒤에 오류 화면을 띄우면 나가려는 사람을 붙잡는 셈이다.
                   * 이 기기에서 지우는 것은 아래에서 이미 끝난다.
                   */
                  if (계정) 서버주문표모두지우기(계정.userId, sheets.map((p) => p.id));
                  setSheets([]); setName("");
                  // 계정도 함께 푼다. 안 풀면 주문표를 다 지운 화면에 회원으로 남아
                  // '저장된 주문표 관리' 가 빈 목록을 회원 것처럼 보여 준다.
                  // 세대를 올려 아직 오는 중인 불러오기 답도 무효로 만든다 — 안 그러면
                  // 방금 비운 목록이 그 답으로 되돌아온다.
                  계정세대.current += 1;
                  set계정(null); 서버에서온것.current = new Set();
                  setOrderSheet(null); setPlanId(null);
                  // 연결 정보도 지운다. 안 지우면 정리한 뒤 몇 분 지나 만료 타이머가
                  // 터지면서 QR 만료 화면으로 튕겨 나간다. 방금 다 지웠는데 왜 그러는지
                  // 사용자는 알 수 없다.
                  setPairingId(null); setPairingExpiresAt(null); setPairingKiosk(null); setFromQr(false);
                  // 새로고침 너머로 넘기려고 적어 둔 것까지 지운다. 이걸 빼면
                  // "모두 지워요" 라고 말한 뒤 새로고침 한 번에 전부 되돌아온다.
                  이어쓰기.비우기();
                },
              })}
              // 연결이 살아 있으면 주문 경로를 끊지 않는다. 하단 탭과 같은 판단이다.
              // 끊으면 QR 을 다시 찍는 것 말고 되돌릴 방법이 없다.
              onSheets={() => { setTab("menu"); if (!pairingId) setFromQr(false); }}
              onA11y={() => setScreen("a11y")}
              onPrivacy={() => setScreen("privacy")}
            />
          )}
          {screen === "a11y" && (
            <AccessibilityScreen
              설정={접근성값}
              알레르기={알레르기}
              on알레르기={(id) => 알레르기설정.뒤집기(id)}
              onChange={(한칸) => 접근성설정.바꾸기(한칸)}
              onBack={() => { setScreen("saved"); setTab("account"); }}
            />
          )}
          {screen === "privacy" && (
            <PrivacyScreen guest={guest} onBack={() => { setScreen("saved"); setTab("account"); }} />
          )}
        </div>

        {inMain && (
          <BottomNav tab={tab} onChange={handleTabChange} />
        )}

        {/* 되돌릴 수 없는 동작을 묻는 자리. 폰 프레임 안에 뜬다. */}
        {확인대기 && (
          <ConfirmSheet
            title={확인대기.title}
            body={확인대기.body}
            confirmLabel={확인대기.confirmLabel}
            onConfirm={() => { 확인대기.run(); set확인대기(null); }}
            onCancel={() => set확인대기(null)}
          />
        )}
        </div>
      </div>

      {/*
        앱 옆에 세워 둔다. 겹치지 않으므로 앱을 쓰면서 오간 것이 쌓이는 걸
        그대로 볼 수 있다 — 눌러서 열어 봐야 하는 것과 달리, 누를 때마다
        무엇이 나가는지가 눈에 보인다.
      */}
      {/*
        목 모드에서는 닫기를 주지 않는다.

        여는 버튼은 연동표시 안에만 있고, 그 패널은 팀 백엔드 모드에서만 뜬다.
        그래서 목으로 돌 때 ?log=side 로 열고 닫아 버리면 다시 여는 길이 없다 —
        주소를 새로 치면 페이지가 새로 떠서 기록이 사라지므로 같은 자리로도 못 돌아간다.
        여는 길이 없는 닫기 버튼은 두지 않는다.
      */}
      {로그모드 === "나란히" && (
        <BackendLog 나란히 {...(팀백엔드모드 ? { onClose: () => set로그모드("닫힘") } : {})} />
      )}
    </div>
  );
}
