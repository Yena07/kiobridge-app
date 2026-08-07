import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Check, Phone } from "lucide-react";

import { Pictogram } from "@/design/Pictogram";
import kioskHeroImg from "@/assets/images/kiosk-hero.jpg";
import {
  P, ACCENT, TEXT_1, TEXT_2, TEXT_3, BORDER, SURFACE, CANVAS, BACKDROP,
  SUCCESS, SUCCESS_BG, WARN, WARN_BG, FAIL, FAIL_BG, TEXT_BTN, TEXT_CHIP,
  FONT, SERIF, TYPE, NUM, GAP, RADIUS, FOCUS_STYLES,
} from "@/design/tokens";
import type {
  Screen, MainTab, PlaceType, PairingState, StepStatus, ProfileData, PairingResult,
  MappingResponse, MappedItem, MappedOption, MappingCandidate, ApproveInput, RecommendationReason,
  PlanStatus, CartResult, AbortInfo,
} from "@/domain/types";
import { DETAIL_OPTIONS, PLACE_LIST, PLACE_ICONS, MOCK_PROFILES, STEPS } from "@/domain/catalog";
import { api, POLL_MS, KioBridgeError, getScenario, setScenario, registerProfile, unregisterProfile, type Scenario } from "@/api/client";

// 휴대폰 틀 크기. 큰 글씨 모드가 이 값을 기준으로 안쪽 크기를 되계산한다.
const FRAME_W = 384;
const FRAME_H = 780;
const LARGE_TEXT_SCALE = 1.18;

// ─── Primitives ───────────────────────────────────────────────────────────────

// 워드마크는 세리프로. 정체(kio)와 이탤릭(bridge)을 섞어 에디토리얼 인상을 만든다.
function AppLogo({ light = false, size = 34 }: { light?: boolean; size?: number }) {
  const color = light ? "white" : TEXT_1;
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
function ProgressBar({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="flex justify-center gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total} aria-label={`전체 ${total}단계 중 ${step}단계`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{ width: i < step ? 16 : 5, height: 5, borderRadius: 100, backgroundColor: i < step ? P : BORDER, transition: "all 0.4s" }}
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

// 온보딩 화면의 가운데 정렬 헤드라인. 레퍼런스처럼 문장을 화면 중앙에 세운다.
function CenterHeadline({ title, desc }: { title: React.ReactNode; desc?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ ...TYPE.title, color: TEXT_1 }}>{title}</h1>
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
        width: "100%", height: 56, borderRadius: RADIUS.button,
        fontSize: 17, fontWeight: 600, fontFamily: FONT, letterSpacing: "-0.02em",
        backgroundColor: disabled ? SURFACE : P,
        // 비활성 컨트롤은 WCAG 대비 규정에서 빠져 있다. 그래도 여기서는 고친다.
        // 아직 못 누르는 버튼의 글자가 "다 채우면 무슨 일이 일어나는지"를 알려 주는 유일한 문장이라
        // 1.62:1(#C4C4C8)로 지워 놓으면 무엇을 기다리는지 알 수 없다.
        // 초록 알약이 회색 알약으로 바뀌는 것만으로 못 누른다는 신호는 충분하다.
        color: disabled ? TEXT_2 : "white",
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
        width: "100%", height: 56, borderRadius: RADIUS.button,
        fontSize: 17, fontWeight: 600, fontFamily: FONT, letterSpacing: "-0.02em",
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
      style={{ backgroundColor: "white", padding: `12px ${GAP.screenX}px 24px` }}
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
        minHeight: 44, padding: "10px 16px", borderRadius: RADIUS.pill,
        fontSize: 15, fontWeight: 600, fontFamily: FONT, letterSpacing: "-0.01em",
        backgroundColor: selected ? P : CANVAS,
        color: selected ? "white" : TEXT_CHIP,
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
    <div className="flex flex-col h-full bg-white">
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
          style={{ height: "58%", background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 62%, #fff 100%)" }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center" style={{ minHeight: 0, padding: `0 ${GAP.screenX}px`, marginTop: -12 }}>
        <Pictogram name="handPointing" size={54} color={P} />
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
            <Pictogram name="handPointing" size={18} color="#fff" />
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
            marginTop: 4, minHeight: 56, borderRadius: RADIUS.button, background: "#fff",
            border: `1px solid ${BORDER}`, color: TEXT_2, fontSize: 15, fontWeight: 600,
          }}
          className="flex items-center justify-center gap-2 w-full"
        >
          <Phone size={17} strokeWidth={2.2} />
          전화번호로 로그인 (선택)
        </button>
      </div>
    </div>
  );
}

// ─── Phone ────────────────────────────────────────────────────────────────────

// 실제 번호가 아닌 것이 눈에 보이는 시연용 값. 010-0000-0000 은 실제로
// 쓰이지 않는 번호라 누구의 것도 아니다.
const DEMO_PHONE = "01000000000";

function PhoneScreen({ onNext, onBack, onPrivacy }: { onNext: (phone: string) => void; onBack: () => void; onPrivacy: () => void }) {
  const [phone] = useState(DEMO_PHONE);
  const formatted = phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0 flex items-center" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
          <ProgressBar step={1} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `48px ${GAP.screenX}px 0` }}>
        <CenterHeadline title="전화번호를 알려주세요" />

        <label htmlFor="phone-input" className="sr-only">전화번호</label>
        <div
          className="flex items-center gap-3"
          style={{ marginTop: 40, justifyContent: "center" }}
        >
          <span style={{ ...TYPE.bodyBold, color: TEXT_1, backgroundColor: CANVAS, padding: "10px 16px", borderRadius: RADIUS.pill, flexShrink: 0 }}>
            +82
          </span>
          {/*
           * 실제 번호를 받지 않는다. 심사 규칙이 실제 개인정보 수집을 금지하고,
           * 가상·합성 데이터만 허용한다.
           *
           * 자동완성을 끄는 것만으로는 부족하다 — 사용자가 자기 번호를 직접
           * 칠 수 있고, 그러면 실제 번호가 앱에 들어온다. 시연용 번호를 미리
           * 채우고 읽기 전용으로 둔다. 칠 게 없으니 자동완성도 필요 없고,
           * 손 떨리는 분이 11자리를 치는 부담도 사라진다.
           */}
          <input
            id="phone-input"
            type="tel"
            inputMode="numeric"
            readOnly
            aria-readonly="true"
            // 고칠 수 없는 칸에서 탭이 한 번 멈출 이유가 없다.
            // 값은 아래 안내 문구가 대신 알려 준다.
            tabIndex={-1}
            value={formatted}
            style={{
              flex: 1, minWidth: 0, fontSize: 19, fontWeight: 600, color: TEXT_1, fontFamily: FONT,
              letterSpacing: "-0.02em", border: "none", outline: "none",
              backgroundColor: "transparent", padding: "10px 0", ...NUM,
            }}
          />
        </div>
      </div>

      <div style={{ padding: `0 ${GAP.screenX}px 32px` }} className="flex flex-col gap-4">
        <p style={{ fontSize: 13, color: TEXT_2, textAlign: "center", lineHeight: 1.7 }}>
          시연용 번호가 미리 채워져 있어요. 실제 번호는 받지 않습니다.{" "}
          {/* 밑줄만 그어 두고 눌리지 않으면 링크처럼 보이는 장식일 뿐이다.
              무엇을 받고 무엇을 안 받는지 적어 둔 화면이 이미 있으므로 거기로 보낸다. */}
          <button
            type="button"
            onClick={onPrivacy}
            style={{ color: TEXT_2, textDecoration: "underline", background: "none", border: "none", padding: "6px 2px", minHeight: 44, cursor: "pointer", fontFamily: FONT, fontSize: 13 }}
          >
            개인정보처리방침
          </button>
        </p>
        <PrimaryBtn onClick={() => phone.length === 11 && onNext(phone)} disabled={phone.length < 11}>
          인증번호 받기
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

function OtpScreen({ phone, onNext, onBack }: { phone: string; onNext: () => void; onBack: () => void }) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [timer, setTimer] = useState(180);
  useEffect(() => {
    const id = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
  };
  const handleChange = (i: number, val: string) => {
    const 숫자 = val.replace(/[^0-9]/g, "");
    // 문자 앱의 자동완성이나 붙여넣기는 6자리를 한 번에 넣는다.
    // 한 글자만 받으면 그 편의가 통째로 죽고, 손으로 여섯 번 옮겨 적어야 한다.
    if (숫자.length > 1) {
      const next = [...otp];
      숫자.slice(0, 6).split("").forEach((d, n) => { if (i + n < 6) next[i + n] = d; });
      setOtp(next);
      inputs.current[Math.min(i + 숫자.length, 5)]?.focus();
      return;
    }
    const next = [...otp];
    next[i] = 숫자.slice(-1);
    setOtp(next);
    if (숫자 && i < 5) inputs.current[i + 1]?.focus();
  };
  // 시간이 지나면 확인 버튼도 잠긴다. 남은 시간을 보여 주면서 눌리게 두면
  // 눌러 놓고 왜 안 되는지 모르게 된다.
  const expired = timer === 0;
  const filled = otp.every((d) => d !== "") && !expired;
  const maskedPhone = phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-****-$3");
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0 flex items-center" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
          <ProgressBar step={2} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `48px ${GAP.screenX}px 0` }}>
        <CenterHeadline
          title={<>문자로 받은<br />인증번호를 입력해주세요</>}
          desc={<><span style={{ color: TEXT_1, fontWeight: 600 }}>{maskedPhone}</span>으로 보냈어요</>}
        />

        <div className="flex justify-center" style={{ gap: 7, marginTop: 40 }} role="group" aria-label="인증번호 6자리">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="tel"
              inputMode="numeric"
              // 문자로 온 인증번호를 기기가 대신 채워 준다. 첫 칸에만 붙인다.
              autoComplete={i === 0 ? "one-time-code" : "off"}
              // 값이 있는 칸을 다시 누르면 기존 값을 선택해 둔다.
              // 그러면 재입력이 '교체' 로 동작한다. 이게 없으면 e.target.value 가
              // "12" 가 되어 붙여넣기 경로를 타고 옆 칸까지 덮어쓴다.
              onFocus={(e) => e.target.select()}
              aria-label={`인증번호 ${i + 1}번째 자리`}
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              {...(i === 0 ? { "data-autofocus": true } : {})}
              style={{
                width: 44, height: 52, textAlign: "center",
                fontSize: 22, fontWeight: 600, fontFamily: FONT, ...NUM,
                borderRadius: RADIUS.input, border: "none", outline: "none",
                backgroundColor: digit ? P : CANVAS,
                color: digit ? "white" : TEXT_1,
                transition: "background-color 0.12s",
              }}
            />
          ))}
        </div>

        <div className="flex flex-col items-center" style={{ marginTop: 20 }}>
          <button
            type="button"
            aria-label="인증번호 재전송"
            onClick={() => setTimer(180)}
            style={{ fontSize: 14, color: TEXT_2, textDecoration: "underline", minHeight: 44, padding: "0 8px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}
          >
            메시지 재전송
          </button>
          <p style={{ fontSize: 13, color: TEXT_2, ...NUM }}>
            남은 시간 <span style={{ fontWeight: 600, color: timer < 30 ? FAIL : TEXT_2 }}>{mm}:{ss}</span>
          </p>
        </div>
      </div>

      <div style={{ padding: `0 ${GAP.screenX}px 32px` }}>
        {expired && (
          <p role="alert" style={{ ...TYPE.caption, color: FAIL, textAlign: "center", marginBottom: 12 }}>
            입력 시간이 지났어요. 메시지를 다시 받아 주세요
          </p>
        )}
        <PrimaryBtn onClick={onNext} disabled={!filled}>확인</PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Name ─────────────────────────────────────────────────────────────────────

function NameScreen({ onNext, onBack }: { onNext: (name: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0 flex items-center" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
          <ProgressBar step={3} />
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
      className="flex flex-col h-full items-center justify-center text-center bg-white"
      style={{ padding: `0 ${GAP.screenX}px` }}
      role="status"
      aria-live="polite"
    >
      <Pictogram name="handsClapping" size={72} color={P} />
      <h1 style={{ ...TYPE.title, color: TEXT_1, marginTop: 32 }}>
        반가워요, <span style={{ color: ACCENT }}>{name}</span>님!
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
 * 지금 이걸 쓰는 곳은 프로필 삭제와 '이 기기에서 정보 지우기' 둘뿐이다.
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
        style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: `28px ${GAP.screenX}px 24px`, outline: "none" }}
      >
        <h2 id="confirm-title" style={{ ...TYPE.title, color: TEXT_1, margin: 0 }}>{title}</h2>
        <p id="confirm-body" style={{ ...TYPE.body, color: TEXT_2, marginTop: 10 }}>{body}</p>
        <div style={{ marginTop: 24 }}>
          {/* 지우는 쪽을 기본으로 두지 않는다. 취소가 더 누르기 쉬운 자리에 있어야 한다. */}
          <button
            type="button"
            onClick={onConfirm}
            style={{ width: "100%", minHeight: 52, borderRadius: RADIUS.button, backgroundColor: FAIL, color: "white", border: "none", cursor: "pointer", ...TYPE.bodyBold, fontFamily: FONT }}
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
        backgroundColor: checked ? P : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
      }}>
        {checked && <Check size={12} strokeWidth={3} color="white" />}
      </div>
      <span style={{ ...TYPE.caption, fontWeight: 600, color: TEXT_1 }}>{label}</span>
    </button>
  );
}

// ─── Profile Form ─────────────────────────────────────────────────────────────

// 프로필 id. 사람이 읽을 값이 아니고 서버로도 나가지 않는 화면 내부 표식이다.
// 시각은 사람이 만든 순서를 알아보기 쉬워서 남기고, 뒤에 카운터를 붙여 충돌을 막는다.
let 프로필일련번호 = 0;
const newProfileId = () => `p${Date.now()}_${++프로필일련번호}`;

function ProfileScreen({ onNext, onBack, showProgress = true }: { onNext: (p: ProfileData) => void; onBack: () => void; showProgress?: boolean }) {
  const [menuName, setMenuName] = useState("");
  const [place, setPlace] = useState<PlaceType>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [memo, setMemo] = useState("");

  const options = place ? DETAIL_OPTIONS[place] : [];

  const toggleChip = (sectionLabel: string, choice: string, multi: boolean) => {
    const 배타 = options.find((o) => o.label === sectionLabel)?.exclusive ?? [];
    setSelections((prev) => {
      const current = prev[sectionLabel] ?? [];
      if (multi) {
        if (current.includes(choice)) {
          return { ...prev, [sectionLabel]: current.filter((c) => c !== choice) };
        }
        // '시럽 없음' 을 고르면 다른 시럽은 내린다. 반대로 시럽을 고르면 '없음'을 내린다.
        // 둘이 같이 켜져 있으면 앱도 사용자도 무엇을 시킨 건지 알 수 없다.
        const 남길 = 배타.includes(choice)
          ? []
          : current.filter((c) => !배타.includes(c));
        return { ...prev, [sectionLabel]: [...남길, choice] };
      } else {
        return { ...prev, [sectionLabel]: current[0] === choice ? [] : [choice] };
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
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <div className="flex items-center">
          <BackButton onClick={onBack} />
          <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
            {/*
             * 진행 표시는 로그인 흐름(전화 1 → 인증 2 → 호칭 3 → 프로필 4)을 전제한다.
             * 주 경로인 게스트는 앞의 셋을 건너뛰므로, 처음 프로필을 만드는 사람에게
             * "4단계 중 4단계" 라고 읽히는 건 사실이 아니다. 게스트에게는 숨긴다.
             */}
            {showProgress && <ProgressBar step={4} />}
          </div>
        </div>
        <h1 style={{ ...TYPE.display, color: TEXT_1, marginTop: 28 }}>메뉴 프로필</h1>
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
                  backgroundColor: place === label ? P : CANVAS,
                  color: place === label ? "white" : TEXT_CHIP,
                  transition: "background-color 0.15s",
                }}
              >
                <span aria-hidden="true" style={{ color: place === label ? "white" : P, display: "flex" }}>{icon}</span>
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
        <PrimaryBtn
          // Date.now() 만 쓰면 같은 밀리초에 두 개를 만들 때 id 가 겹친다.
          // 겹치면 프로필 하나를 지울 때 다른 하나도 같이 사라진다.
          onClick={() => onNext({ id: newProfileId(), menuName, place, selections, memo })}
          disabled={!menuName.trim()}
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

function ProfileCard({
  profile, selected, onSelect, onDelete,
}: {
  profile: ProfileData; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const allTags = [...(profile.place ? [profile.place] : []), ...Object.values(profile.selections).flat()];
  const visibleTags = allTags.slice(0, 4);
  const overflow = allTags.length - visibleTags.length;
  const [focused, setFocused] = useState(false);

  /*
   * 고르는 곳과 지우는 곳은 형제여야 한다.
   *
   * 예전에는 카드 전체가 role="radio" 이고 그 안에 삭제 버튼이 들어 있었다.
   * 그러면 삭제 버튼에 포커스를 두고 Enter 를 눌러도 카드만 선택되고 지워지지 않는다.
   * 부모가 그 Enter 를 가로채 preventDefault() 해 버리기 때문이다.
   * 키보드만 쓰는 사람에게는 프로필을 지울 방법이 아예 없었다.
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
        backgroundColor: selected ? P : SURFACE,
        transition: "background-color 0.15s",
        outline: focused ? `3px solid ${TEXT_1}` : "none",
        outlineOffset: 2,
      }}
    >
      <label style={{ display: "block", padding: "20px 20px 0", cursor: "pointer" }}>
        <input
          type="radio"
          name="saved-profile"
          style={SR_ONLY}
          checked={selected}
          onChange={onSelect}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label={`${profile.menuName}${profile.place ? `, ${profile.place}` : ""}`}
        />
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* 저장된 프로필에는 사진을 붙이지 않는다. 아직 어느 키오스크에도 물어보기 전이라
                여기서 사진을 보여 주면 오늘 실제로 나올 메뉴를 앱이 장담하는 꼴이 된다. */}
            <div
              aria-hidden="true"
              style={{
                width: 40, height: 40, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: selected ? "rgba(255,255,255,0.16)" : "white",
                color: selected ? "white" : P, flexShrink: 0,
              }}
            >
              {profile.place ? PLACE_ICONS[profile.place] : <Pictogram name="squaresFour" size={19} />}
            </div>
            <span style={{ ...TYPE.bodyBold, color: selected ? "white" : TEXT_1 }}>{profile.menuName}</span>
          </div>
          <div
            aria-hidden="true"
            style={{
              width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 5,
              display: "flex", alignItems: "center", justifyContent: "center",
              backgroundColor: selected ? "white" : "transparent",
              // 안 고른 동그라미의 테두리는 "여기 고를 수 있는 게 있다"를 알리는 유일한 표시다.
              // TEXT_3 는 옅은 면 위에서 1.62:1 이라 컨트롤 경계 기준(3:1)에 못 미쳤다.
              border: selected ? "none" : `1.5px solid ${TEXT_2}`,
            }}
          >
            {selected && <Check size={13} strokeWidth={3} color={P} />}
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
              backgroundColor: selected ? "rgba(0,0,0,0.18)" : "white",
              color: selected ? "white" : TEXT_2,
            }}>
              {tag}
            </span>
          ))}
          {overflow > 0 && (
            <span style={{
              fontSize: 13, fontWeight: 500, padding: "4px 11px", borderRadius: RADIUS.pill,
              backgroundColor: selected ? "rgba(0,0,0,0.18)" : "white",
              color: selected ? "white" : TEXT_2,
            }}>
              +{overflow}
            </span>
          )}
        </div>

        {/* 반투명 흰색(70%)은 초록 위에서 3.31:1 이라 읽히지 않는다. 흰색은 5.08:1 이다. */}
        {profile.memo && (
          <p style={{ fontSize: 14, color: selected ? "white" : TEXT_2, lineHeight: 1.5, marginTop: 12 }}>{profile.memo}</p>
        )}
      </label>

      {/* 삭제는 라벨 바깥에 둔다. 안에 있으면 label 이 클릭을 가로채 선택으로 바꿔 버린다. */}
      <div className="flex justify-end" style={{ padding: "0 20px 20px", marginTop: 4 }}>
        <button
          type="button"
          aria-label={`${profile.menuName} 프로필 삭제`}
          onClick={onDelete}
          style={{
            // 높이만 44 였고 폭이 30 이었다. 밑줄은 글자에만 걸리므로
            // 폭을 44 로 넓혀도 보이는 크기는 그대로고 누를 수 있는 데만 넓어진다.
            fontSize: 13, fontWeight: 500, minHeight: 44, minWidth: 44, padding: "6px 10px",
            background: "none", border: "none", cursor: "pointer",
            // 70% 흰색은 초록 위에서 3.31:1 이었다. 지우는 버튼은 흐릿하면 안 된다.
            color: selected ? "white" : TEXT_2,
            textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function SavedProfilesScreen({
  profiles, onAddProfile, onDeleteProfile, onOrder, showOrder = false,
}: {
  profiles: ProfileData[];
  onAddProfile: () => void;
  onDeleteProfile: (id: string) => void;
  onOrder: (profile: ProfileData) => void;
  showOrder?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id ?? null);

  // 목록이 바뀌면 고른 것도 따라가야 한다. 초기값에 갇혀 있으면
  // 전부 지웠다가 새로 만들었을 때 아무것도 안 골라진 채로 남고,
  // '이 프로필로 주문하기'가 계속 잠겨서 빠져나갈 방법이 없어진다.
  useEffect(() => {
    if (profiles.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    // 목록이 실제로 바뀌었을 때만 따라간다.
    // 지워진 프로필이 골라져 있었으면 첫 번째로 옮긴다. 삭제를 취소한 경우에는
    // profiles 가 그대로라 이 이펙트가 돌지 않으므로 선택도 움직이지 않는다.
    if (!profiles.some((p) => p.id === selectedId)) setSelectedId(profiles[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0" style={{ padding: `20px ${GAP.screenX}px 20px` }}>
        <AppLogo size={26} />
        <h1 style={{ ...TYPE.display, color: TEXT_1, marginTop: 22 }}>저장된 프로필</h1>
        <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 6 }}>사용할 프로필을 선택하세요</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-2" style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}>
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Pictogram name="squaresFour" size={56} color={TEXT_3} />
            <p style={{ ...TYPE.bodyBold, color: TEXT_1, marginTop: 20 }}>저장된 프로필이 없어요</p>
            <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 6 }}>새 프로필을 추가해보세요</p>
          </div>
        ) : (
          /*
           * role="radiogroup" 을 쓰지 않고 fieldset 을 쓴다.
           * radiogroup 은 라디오만 품는 게 원칙인데 여기에는 카드마다 삭제 버튼이 같이 있다.
           * fieldset/legend 는 브라우저가 원래 갖고 있는 묶음이라 버튼이 섞여 있어도 괜찮고,
           * 같은 name 을 가진 라디오끼리 화살표 키로 옮겨 다니는 것도 그대로 동작한다.
           */
          <fieldset style={{ border: 0, margin: 0, padding: 0, minInlineSize: 0 }}>
            <legend style={SR_ONLY}>저장된 프로필 목록</legend>
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                selected={selectedId === profile.id}
                onSelect={() => setSelectedId(profile.id)}
                // 선택을 여기서 옮기지 않는다. onDeleteProfile 은 이제 확인창만
                // 열고 아직 지우지 않는데, 여기서 옮기면 대답도 하기 전에 선택이
                // 움직이고 '그대로 두기' 를 눌러도 돌아오지 않는다.
                // 실제로 지워진 뒤의 선택 이동은 아래 useEffect 가 맡는다.
                onDelete={() => onDeleteProfile(profile.id)}
              />
            ))}
          </fieldset>
        )}
      </div>

      <StickyFooter>
        {showOrder && (
          <PrimaryBtn
            onClick={() => {
              const picked = profiles.find((p) => p.id === selectedId);
              if (picked) onOrder(picked);
            }}
            disabled={!selectedId}
          >
            이 프로필로 주문하기
          </PrimaryBtn>
        )}
        <OutlineBtn onClick={onAddProfile}>
          + 새 프로필 추가
        </OutlineBtn>
      </StickyFooter>
    </div>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

function BottomNav({ tab, onChange }: { tab: MainTab; onChange: (t: MainTab) => void }) {
  const items: { id: MainTab; icon: React.ReactNode; label: string }[] = [
    { id: "qr", icon: <Pictogram name="qrCode" size={25} />, label: "QR 찍기" },
    { id: "menu", icon: <Pictogram name="notePencil" size={25} />, label: "내 프로필" },
    { id: "account", icon: <Pictogram name="userCircle" size={25} />, label: "계정" },
  ];
  return (
    <nav aria-label="주요 메뉴" className="shrink-0 flex" style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: "white", paddingBottom: 12 }}>
      {items.map(({ id, icon, label }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
            className="flex-1 flex flex-col items-center gap-1.5"
            style={{ border: "none", backgroundColor: "transparent", cursor: "pointer", minHeight: 56, padding: "12px 0 4px" }}
          >
            {/* 안 눌린 탭도 읽을 수 있어야 한다. TEXT_3 는 1.74:1 이라 사실상 안 보였다. */}
            <span aria-hidden="true" style={{ color: active ? P : TEXT_2, display: "flex" }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, letterSpacing: "-0.02em", color: active ? P : TEXT_2, fontFamily: FONT }}>
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
      <path d="M32 5 A27 27 0 0 1 59 32" stroke={P} strokeWidth="4" strokeLinecap="round" style={SPIN(32, 32)} />
    </svg>
  );
}

// 상태 화면 공통 골격 — 가운데 정렬 표식 + 제목 + 설명. 색이 아니라 배치로 위계를 만든다.
function StatusHero({ mark, title, desc }: { mark: React.ReactNode; title: React.ReactNode; desc?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div aria-hidden="true" className="flex items-center justify-center" style={{ height: 72 }}>{mark}</div>
      <h2 style={{ ...TYPE.title, color: TEXT_1, marginTop: 20 }}>{title}</h2>
      {desc && <p style={{ ...TYPE.caption, color: TEXT_2, marginTop: 8 }}>{desc}</p>}
    </div>
  );
}

function PairingConnecting() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center" style={{ paddingLeft: GAP.screenX, paddingRight: GAP.screenX }}>
      <StatusHero mark={<SpinnerIcon />} title="키오스크에 연결하는 중" desc="잠시만 기다려 주세요" />
    </div>
  );
}

function PairingConnected({
  kioskName, expiresAt, onExpire, onSelectProfile,
}: {
  kioskName: string;
  expiresAt: number;
  onExpire: () => void;
  onSelectProfile: () => void;
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
        title="연결되었습니다"
        desc={<span style={{ fontWeight: 600, color: TEXT_1 }}>{kioskName}</span>}
      />

      <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, marginTop: 32 }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p style={{ ...TYPE.label, color: TEXT_1, marginBottom: 5 }}>세션 유효시간</p>
            <p style={{ fontSize: 13, color: TEXT_2, lineHeight: 1.5 }}>만료되면 QR을 다시 스캔해 주세요</p>
          </div>
          <span style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1, color: TEXT_1, ...NUM }}>{mm}:{ss}</span>
        </div>
      </div>

      <div className="mt-auto" style={{ paddingTop: 24 }}>
        <PrimaryBtn onClick={onSelectProfile}>프로필 선택하기</PrimaryBtn>
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
  // 스크린리더로는 뒤에 있는 프로필 목록과 하단 탭이 그대로 읽히고,
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
              <div style={{ width: 60, height: 60, borderRadius: "50%", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M7 17L13 23L25 11" stroke={P} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
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
          찍지 않아도 <strong style={{ fontWeight: 600 }}>내 프로필</strong>에서 저장한 조건을 먼저 확인할 수 있어요
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
    <div className="flex flex-col h-full bg-white">
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
            onSelectProfile={() => onPaired(pairing.pairingId, pairing.expiresAt, pairing.kioskName)}
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
  name, guest, onLogout, onLogin, onClearLocal, onProfiles, onA11y, onPrivacy,
}: {
  name: string; guest: boolean;
  onLogout: () => void; onLogin: () => void; onClearLocal: () => void;
  onProfiles: () => void; onA11y: () => void; onPrivacy: () => void;
}) {
  // 목록에 올린 항목은 전부 실제로 열린다. 눌러도 아무 일이 없는 줄은 두지 않는다.
  const items = guest
    ? [
        { label: "저장된 프로필 관리", sub: "이번 이용에만 쓰는 메뉴 프로필이에요", action: onProfiles, danger: false },
        { label: "접근성 설정", sub: "큰 글씨", action: onA11y, danger: false },
        { label: "개인정보 안내", sub: "무엇을 저장하고 무엇을 저장하지 않는지", action: onPrivacy, danger: false },
        { label: "이 기기에서 정보 지우기", sub: "지금까지 입력한 내용을 모두 지워요", action: onClearLocal, danger: true },
      ]
    : [
        { label: "저장된 프로필 관리", sub: "내 메뉴 프로필을 확인하고 수정해요", action: onProfiles, danger: false },
        { label: "접근성 설정", sub: "큰 글씨", action: onA11y, danger: false },
        { label: "개인정보 안내", sub: "무엇을 저장하고 무엇을 저장하지 않는지", action: onPrivacy, danger: false },
        { label: "이 기기에서 정보 지우기", sub: "저장해 둔 내용을 모두 지워요", action: onClearLocal, danger: true },
        { label: "로그아웃", sub: "", action: onLogout, danger: true },
      ];
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0" style={{ padding: `20px ${GAP.screenX}px 24px` }}>
        <AppLogo size={26} />
        <div className="flex items-center gap-4" style={{ marginTop: 28 }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", backgroundColor: guest ? SURFACE : P, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {guest
              ? <Pictogram name="handPointing" size={24} color={TEXT_2} />
              : <span style={{ fontFamily: SERIF, fontSize: 24, color: "white" }}>{name ? name[0] : "?"}</span>}
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
              background: "#fff", border: `1px solid ${BORDER}`, color: TEXT_2,
              fontSize: 15, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
            }}
            className="flex items-center justify-center gap-2"
          >
            <Phone size={17} strokeWidth={2.2} />
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
function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="shrink-0" style={{ padding: `14px ${GAP.screenX}px 8px` }}>
      <BackButton onClick={onBack} />
      <h1 style={{ ...TYPE.title, color: TEXT_1, marginTop: 8 }}>{title}</h1>
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
        gap: 16, padding: "18px 20px", textAlign: "left", cursor: "pointer", fontFamily: FONT,
        backgroundColor: "transparent", border: "none",
      }}
    >
      <span>
        <span style={{ display: "block", fontSize: 16, fontWeight: 500, color: TEXT_1, letterSpacing: "-0.01em" }}>{label}</span>
        <span style={{ display: "block", fontSize: 13, color: TEXT_2, marginTop: 3 }}>{sub}</span>
      </span>
      {/* 색만으로 상태를 알리지 않는다 — 켜짐일 때는 체크 표시도 함께 둔다. */}
      <span
        aria-hidden="true"
        style={{
          width: 52, height: 31, borderRadius: 100, flexShrink: 0, position: "relative",
          backgroundColor: on ? P : BORDER, transition: "background-color 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute", top: 3, left: on ? 24 : 3, width: 25, height: 25, borderRadius: "50%",
            backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {on && <Check size={14} strokeWidth={3} style={{ color: P }} />}
        </span>
      </span>
    </button>
  );
}

/**
 * 접근성 설정.
 *
 * 여기 있는 항목은 전부 실제로 동작하는 것만 둔다. 준비 중인 기능을 목록에 올려 두면
 * 화면을 믿을 수 없게 된다. 큰 글씨는 앱 전체(휴대폰 틀 안)에 바로 적용된다.
 */
function AccessibilityScreen({
  largeText, onLargeText, onBack,
}: {
  largeText: boolean; onLargeText: (v: boolean) => void; onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-white">
      <SubScreenHeader title="접근성 설정" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `12px ${GAP.screenX}px 24px` }}>
        <div style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, overflow: "hidden" }}>
          <ToggleRow
            label="큰 글씨"
            sub="앱 전체의 글씨와 버튼을 크게 봐요"
            on={largeText}
            onToggle={() => onLargeText(!largeText)}
          />
        </div>

        <p style={{ fontSize: 13, color: TEXT_2, marginTop: 20, lineHeight: 1.7 }}>
          이 앱은 처음부터 큰 버튼과 또렷한 대비로 만들었어요.
          단계마다 한 가지만 물어보고, 상태는 색뿐 아니라 그림과 글씨로도 함께 알려드려요.
        </p>
        <p style={{ fontSize: 13, color: TEXT_2, marginTop: 12, lineHeight: 1.7 }}>
          화면이 어려우면 이 화면을 매장 직원에게 보여주세요. 직원이 이어서 도와드릴 수 있어요.
        </p>
      </div>
    </div>
  );
}

/**
 * 무엇을 저장하고 무엇을 저장하지 않는지.
 *
 * 약관 문구를 그대로 옮기지 않는다. 이 앱이 실제로 하는 일만 사용자의 말로 적는다.
 */
function PrivacyScreen({ guest, onBack }: { guest: boolean; onBack: () => void }) {
  const rows: { title: string; body: string }[] = [
    {
      title: "저장하는 것",
      body: "메뉴 프로필에 적어 두신 내용(예: 포장, 매운맛, 순살, 종이컵)만 저장해요. 사람이 읽는 말 그대로예요.",
    },
    {
      title: "저장하지 않는 것",
      body: "실제 이름·주소·주민등록번호는 받지도, 저장하지도 않아요. 결제 정보도 다루지 않아요. 부르는 호칭은 화면에 띄우는 데만 쓰고 이 기기 밖으로 나가지 않아요.",
    },
    {
      title: "전화번호는 어떻게 하나요",
      body: "실제 전화번호는 받지 않아요. 로그인 화면에는 시연용 번호가 미리 채워져 있고 고칠 수 없어요. 그 값도 인증이 끝나면 바로 지웁니다.",
    },
    {
      title: "키오스크에 넘기는 것",
      body: "QR로 연결할 때는 이번 주문에만 쓰는 짧은 연결 표만 오가요. 시간이 지나면 저절로 만료돼요.",
    },
    {
      title: "지우는 방법",
      body: guest
        ? "지금은 로그인 없이 쓰고 계셔서 이번 이용이 끝나면 남지 않아요. 바로 지우시려면 계정 화면의 ‘이 기기에서 정보 지우기’를 눌러 주세요."
        : "계정 화면의 ‘이 기기에서 정보 지우기’를 누르면 저장해 둔 내용이 모두 사라져요.",
    },
  ];
  return (
    <div className="flex flex-col h-full bg-white">
      <SubScreenHeader title="개인정보 안내" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, padding: `12px ${GAP.screenX}px 24px` }}>
        {rows.map(({ title, body }) => (
          <section key={title} style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: "16px 18px", marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: TEXT_1, letterSpacing: "-0.01em" }}>{title}</h2>
            <p style={{ fontSize: 14, color: TEXT_2, marginTop: 6, lineHeight: 1.65 }}>{body}</p>
          </section>
        ))}
        <p style={{ fontSize: 13, color: TEXT_2, marginTop: 12, lineHeight: 1.7 }}>
          이 앱은 주문을 장바구니에 담는 데까지만 도와드려요. 결제는 키오스크에서 직접 하시면 돼요.
        </p>
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
    ? { bg: SUCCESS_BG, fg: SUCCESS, icon: "checkCircle" as const }
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
function ReasonList({ reasons }: { reasons?: RecommendationReason[] }) {
  if (!reasons || reasons.length === 0) return null;
  return (
    <section
      aria-label="이 메뉴를 고른 이유"
      style={{ borderRadius: RADIUS.card, backgroundColor: SURFACE, padding: "16px 18px" }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, color: TEXT_1, marginBottom: 10 }}>
        이 메뉴를 고른 이유
      </h3>
      <ul style={{ display: "flex", flexDirection: "column", gap: 9, margin: 0, padding: 0, listStyle: "none" }}>
        {reasons.map((r) => (
          <li key={r.text} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: 2, display: "flex" }}>
              <Pictogram
                name={r.kind === "used" ? "checkCircle" : "warning"}
                size={16}
                color={r.kind === "used" ? SUCCESS : WARN}
              />
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.6, color: TEXT_1 }}>
              {/* 색을 못 보는 경우에도 종류를 알 수 있게 말머리를 글자로 붙인다. */}
              <b style={{ fontWeight: 700 }}>{r.kind === "used" ? "반영: " : "제외: "}</b>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
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
 * 프로필 목록(SavedProfilesScreen)이 같은 이유로 이미 이렇게 되어 있다.
 *
 * 예전에는 role="button" 분기도 있었다. low_confidence 에서 '이게 맞아요' 를
 * 짚는 자리였는데, 확인 카드와 같은 메뉴를 카드 모양으로 두 번 그리게 되어
 * CheckRow 로 옮겼다. 이제 이 컴포넌트는 라디오 하나만 한다.
 *
 * groupName 은 필수다. 기본값을 두면 화면에 라디오 그룹이 둘 이상일 때
 * 서로 다른 질문의 선택지가 조용히 한 그룹으로 묶인다.
 */
function OptionCard({
  name, price, selected, onClick, photo, groupName,
}: {
  name: string; price: string; selected: boolean; onClick: () => void;
  photo?: string | null; groupName: string;
}) {
  const [포커스, set포커스] = useState(false);
  const 속: React.ReactNode = (
    <>
      <span className="flex items-center gap-3" style={{ minWidth: 0 }}>
        {photo && <img src={photo} alt="" aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
        <span style={{ ...TYPE.bodyBold, color: selected ? "white" : TEXT_1, textAlign: "left" }}>{name}</span>
      </span>
      <div className="flex items-center gap-3">
        <span style={{ ...TYPE.bodyBold, color: selected ? "white" : TEXT_1, ...NUM }}>{price}</span>
        <div aria-hidden="true" style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: selected ? "white" : "transparent",
          // 안 고른 동그라미의 테두리는 "여기 고를 수 있는 게 있다"를 알리는 유일한 표시다.
          // TEXT_3 는 옅은 면 위에서 1.62:1 이라 컨트롤 경계 기준(3:1)에 못 미쳤다.
          border: selected ? "none" : `1.5px solid ${TEXT_2}`,
        }}>
          {selected && <Check size={12} strokeWidth={3} color={P} />}
        </div>
      </div>
    </>
  );

  const 겉모양 = {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "17px 20px", borderRadius: RADIUS.card, cursor: "pointer", fontFamily: FONT,
    border: "none", width: "100%",
    backgroundColor: selected ? P : SURFACE,
    transition: "background-color 0.15s",
  } as const;

  return (
    <label style={{
      ...겉모양, position: "relative", margin: 0,
      // 포커스는 숨은 input 이 받지만 표시는 이 라벨이 한다.
      // 화살표 키를 살리려다 포커스 표시를 잃으면 안 된다.
      outline: 포커스 ? `3px solid ${P}` : "none",
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
  item, reasons, onApprove, onCancel,
}: {
  item: MappedItem; reasons?: RecommendationReason[]; onApprove: () => void; onCancel: () => void;
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
      <ReasonList reasons={reasons} />
      <PrimaryBtn onClick={onApprove}>승인하고 담기</PrimaryBtn>
      <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
    </div>
  );
}

function OrderClarification({
  candidates, reason, reasons, options, onApprove, onCancel,
}: {
  candidates: MappingCandidate[];
  reason?: string;
  reasons?: RecommendationReason[];
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
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="비슷한 메뉴 후보">
        {candidates.map((c, i) => (
          <OptionCard
            key={c.candidateId}
            groupName="후보"
            selected={selected === i}
            name={c.displayName}
            price={c.priceText}
            photo={c.imageUrl}
            onClick={() => setSelected(i)}
          />
        ))}
      </div>
      <ReasonList reasons={reasons} />
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
        <OutlineBtn onClick={onCancel}>프로필 다시 보기</OutlineBtn>
      </div>
    </div>
  );
}

function OrderChanged({
  item, diffNote, reasons, onApprove, onCancel,
}: {
  item: MappedItem;
  diffNote?: string;
  reasons?: RecommendationReason[];
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
            {checked && <Check size={12} strokeWidth={3} color="white" />}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: WARN }}>달라진 내용을 확인했어요</span>
        </button>
      </div>

      <ReasonList reasons={reasons} />
      <PrimaryBtn onClick={checked ? onApprove : undefined} disabled={!checked}>변경 내용 확인하고 담기</PrimaryBtn>
      <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
    </div>
  );
}

function OrderLowConfidence({
  item, reasons, onApprove, onCancel,
}: {
  item: MappedItem; reasons?: RecommendationReason[]; onApprove: () => void; onCancel: () => void;
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
      <ReasonList reasons={reasons} />
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
  pairingId, profile, onBack, onApproved,
}: {
  pairingId: string;
  profile: ProfileData;
  onBack: () => void;
  onApproved: (planId: string) => void;
}) {
  const [mapping, setMapping] = useState<MappingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 승인은 한 번만. 연타로 실행 계획이 두 번 만들어지면 안 된다.
  const approving = useRef(false);

  useEffect(() => {
    let alive = true;
    api.requestMapping(pairingId, profile.id)
      .then((res) => { if (alive) setMapping(res); })
      .catch((e: KioBridgeError) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pairingId, profile.id]);

  // P0-4: 실행 계획 생성은 이 핸들러 안에서만 일어난다.
  // 매핑 조회(useEffect)는 계획을 만들지 않으므로 승인 전 실행 경로가 존재하지 않는다.
  const approve = (extra: Omit<ApproveInput, "pairingId" | "profileId" | "mappingResult"> = {}) => {
    if (!mapping || approving.current) return;
    approving.current = true;
    setError(null);
    api.approve({ pairingId, profileId: profile.id, mappingResult: mapping.result, ...extra })
      .then((res) => onApproved(res.planId))
      .catch((e: KioBridgeError) => { approving.current = false; setError(e.message); });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-2" style={{ marginTop: 20, paddingBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "white", backgroundColor: P, padding: "4px 11px", borderRadius: RADIUS.pill }}>내 프로필</span>
          <span style={{ ...TYPE.bodyBold, color: TEXT_1 }}>{profile.menuName}</span>
        </div>
        <div style={{ height: 1, backgroundColor: BORDER, marginLeft: -GAP.screenX, marginRight: -GAP.screenX }} />
      </div>

      <div className="flex-1 overflow-y-auto pb-6" style={{ minHeight: 0, paddingLeft: GAP.screenX, paddingRight: GAP.screenX, paddingTop: 24 }} aria-busy={!mapping && !error}>
        {!mapping && !error && <OrderMappingLoading />}

        {error && (
          <div className="mb-4" role="alert">
            <InfoBox>{error}</InfoBox>
          </div>
        )}

        {!mapping && error && <OutlineBtn onClick={onBack}>프로필 다시 보기</OutlineBtn>}

        {/*
         * item 이 없으면 그리지 않는다. 예전에는 mapping.item! 로 있다고 단정했는데,
         * 조건에 다 걸려 후보가 하나도 안 남으면 undefined 가 들어와 화면이 터진다.
         * 목은 이제 그 경우를 not_found 로 답하지만, 화면이 서버를 믿고 단정할 이유는 없다.
         */}
        {mapping?.result === "exact" && mapping.item && (
          <OrderExact item={mapping.item} reasons={mapping.reasons} onApprove={() => approve()} onCancel={onBack} />
        )}
        {mapping?.result === "clarification" && (
          <OrderClarification
            candidates={mapping.candidates ?? []}
            reason={mapping.reason}
            reasons={mapping.reasons}
            options={mapping.profileOptions}
            onApprove={(candidateId) => approve({ candidateId })}
            onCancel={onBack}
          />
        )}
        {mapping?.result === "not_found" && <OrderNotFound message={mapping.message} onCancel={onBack} />}
        {mapping?.result === "changed" && mapping.item && (
          <OrderChanged
            item={mapping.item}
            diffNote={mapping.diffNote}
            reasons={mapping.reasons}
            onApprove={() => approve({ acknowledgedDiff: true })}
            onCancel={onBack}
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
            <OutlineBtn onClick={onBack}>프로필 다시 보기</OutlineBtn>
          </div>
        )}
        {mapping?.result === "low_confidence" && mapping.item && (
          <OrderLowConfidence
            item={mapping.item}
            reasons={mapping.reasons}
            /* 사용자가 카드를 눌러 "이 메뉴가 맞다"고 짚어야만 여기까지 온다. 그 사실을 서버에도 알린다. */
            onApprove={() => approve({ confirmedLowConfidence: true })}
            onCancel={onBack}
          />
        )}
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
        backgroundColor: isDone ? P : isActive ? "white" : isFailed ? FAIL_BG : "white",
      }}>
        {isDone && (
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 9.5L7.5 13L14 6" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {isActive && (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7" stroke={BORDER} strokeWidth="2.5" />
            <path d="M10 3 A7 7 0 0 1 17 10" stroke={P} strokeWidth="2.5" strokeLinecap="round" style={SPIN(10, 10)} />
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
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, backgroundColor: P, color: "white" }}>
          진행 중
        </span>
      )}
      {isFailed && (
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, backgroundColor: FAIL, color: "white" }}>
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

function ExecSuccess({ cart, steps, onHome }: { cart: CartResult; steps: StepStatus[]; onHome: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <StatusHero
        mark={<Pictogram name="checkCircle" size={64} color={P} />}
        title="장바구니에 담았어요"
      />

      <div style={{ borderRadius: RADIUS.card, padding: 20, backgroundColor: SURFACE, display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="flex items-center justify-between">
          <p style={{ ...TYPE.label, color: TEXT_2, display: "flex", alignItems: "center", gap: 6 }}>
            <Pictogram name="receipt" size={17} color={TEXT_2} />
            담긴 내역
          </p>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: RADIUS.pill, backgroundColor: "white", color: TEXT_2 }}>
            {cart.evidenceLabel}
          </span>
        </div>
        <span style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1.15, color: TEXT_1, ...NUM }}>
          {cart.itemCountText} · {cart.totalText}
        </span>
      </div>

      <StepCard statuses={steps} />

      <div style={{ display: "flex", gap: 11, alignItems: "flex-start", paddingLeft: 2 }}>
        <Pictogram name="shoppingCartSimple" size={20} color={TEXT_2} style={{ marginTop: 1 }} />
        <p style={{ fontSize: 14, color: TEXT_2, lineHeight: 1.6 }}>{cart.handoff}</p>
      </div>

      <OutlineBtn onClick={onHome}>처음으로</OutlineBtn>
    </div>
  );
}

function ExecFailed({ abort, steps, onHome }: { abort: AbortInfo; steps: StepStatus[]; onHome: () => void }) {
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

      <StepCard statuses={steps} />

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
    <div className="flex flex-col h-full bg-white">
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
          <ExecSuccess cart={status.cart} steps={status.steps} onHome={onHome} />
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
            <div className="mt-auto" style={{ paddingTop: 24 }}>
              <PrimaryBtn onClick={onHome}>처음으로</PrimaryBtn>
            </div>
          </div>
        )}
        {status.state === "aborted" && status.abort && (
          <ExecFailed abort={status.abort} steps={status.steps} onHome={onHome} />
        )}
      </div>
    </div>
  );
}

// ─── 시연용 시나리오 패널 ──────────────────────────────────────────────────────
// 제품 화면 밖(폰 프레임 바깥)에 둔다. 심사 중 예외 상태를 재현하기 위한 장치이며
// 사용자가 보는 앱 UI에는 포함되지 않는다. 백엔드 연결 시 이 컴포넌트만 지우면 된다.

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
  const [screen, setScreen] = useState<Screen>("welcome");
  const [tab, setTab] = useState<MainTab>("menu");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  /** 로그인 없이 시작했는가. true 면 기기에 아무것도 남기지 않는다. */
  const [guest, setGuest] = useState(true);
  /** 큰 글씨 모드. 휴대폰 틀 안 전체에 적용된다. */
  const [largeText, setLargeText] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>(MOCK_PROFILES);
  const [fromQr, setFromQr] = useState(false);
  const [qrKey, setQrKey] = useState(0);
  // 되돌릴 수 없는 동작은 물어보고 실행한다. null 이면 물어볼 게 없다는 뜻이다.
  const [확인대기, set확인대기] = useState<{ title: string; body: string; confirmLabel: string; run: () => void } | null>(null);
  const [pairingId, setPairingId] = useState<string | null>(null);
  // 만료 시각을 루트가 들고 있어야 한다. 예전에는 QrScreen 안에만 있어서
  // 프로필을 고르는 순간 그 화면이 사라지고 감시도 같이 사라졌다.
  // 그러면 이미 끝난 연결로 승인까지 진행되고, 화면은 아무 말도 하지 않는다.
  const [pairingExpiresAt, setPairingExpiresAt] = useState<number | null>(null);
  // 연결된 키오스크 이름. QR 탭으로 돌아왔을 때 무엇에 연결돼 있는지 말하려면 필요하다.
  const [pairingKiosk, setPairingKiosk] = useState<string | null>(null);
  // 만료 때문에 QR 화면으로 되돌아왔는지. 되돌아왔으면 안내부터 띄운다.
  const [qrExpired, setQrExpired] = useState(false);
  const [orderProfile, setOrderProfile] = useState<ProfileData | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  const addProfile = (p: ProfileData) => setProfiles((prev) => [...prev, p]);
  // 화면에서만 지우면 목에 등록해 둔 사본이 남는다. 둘을 같이 지운다.
  const deleteProfile = (id: string) => {
    const 이름 = profiles.find((p) => p.id === id)?.menuName ?? "이 프로필";
    set확인대기({
      title: `'${이름}'을 지울까요?`,
      body: "지우면 되돌릴 수 없어요. 저장해 두신 조건이 함께 사라져요.",
      confirmLabel: "지우기",
      run: () => {
        unregisterProfile(id);
        setProfiles((prev) => prev.filter((p) => p.id !== id));
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

  // 연결이 끝나면 어느 화면에 있든 되돌린다.
  // 실행 중일 때는 건드리지 않는다. 이미 키오스크가 움직이고 있는데 화면만
  // 되돌리면 사용자는 무슨 일이 일어난 건지 알 수 없다. 그 화면은 자기 상태를
  // 폴링으로 따로 관리한다.
  useEffect(() => {
    if (!pairingExpiresAt || screen === "execution") return;
    const 남은 = pairingExpiresAt - Date.now();
    const 되돌리기 = () => {
      setPairingId(null);
      setPairingExpiresAt(null);
      setPairingKiosk(null);
      setOrderProfile(null);
      setFromQr(false);
      setScreen("saved");
      setTab("qr");
      setQrExpired(true);
      setQrKey((k) => k + 1);
    };
    if (남은 <= 0) { 되돌리기(); return; }
    const t = setTimeout(되돌리기, 남은);
    return () => clearTimeout(t);
  }, [pairingExpiresAt, screen]);

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
  }, [screen, tab]);

  const inMain = screen === "saved";

  const handleTabChange = (t: MainTab) => {
    // 만료 안내는 만료된 그 순간 한 번만 보여 준다. 안 풀어 주면 그 뒤로
    // QR 탭에 들어갈 때마다 지난 만료 안내부터 뜬다.
    if (t === "qr") { setQrKey((k) => k + 1); setQrExpired(false); }
    setTab(t);
    setScreen("saved");
    // 연결이 아직 살아 있으면 주문 경로를 유지한다. 예전에는 무조건 껐더니
    // 하단 탭으로 '내 프로필'에 가는 순간 주문 버튼이 사라졌고,
    // QR 을 다시 찍는 것 말고는 되돌릴 방법이 없었다.
    if (!pairingId) setFromQr(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center gap-8 p-6"
      style={{ backgroundColor: BACKDROP, fontFamily: FONT }}
    >
      <style>{FOCUS_STYLES}</style>
      <ScenarioPanel />
      {/*
        큰 글씨 모드. 화면 크기(휴대폰 틀)는 그대로 두고 안쪽 내용만 키운다.
        바깥 틀은 실제 크기(FRAME_W × FRAME_H)를 잡고, 안쪽은 그 크기를 배율로 나눠 잡는다.
        zoom 이 다시 배율을 곱하므로 최종 렌더 크기는 틀과 정확히 같아진다.
      */}
      <div style={{ width: "100%", maxWidth: FRAME_W, height: FRAME_H }}>
        <div
          ref={화면영역}
          className="bg-white overflow-hidden flex flex-col"
          style={{
            zoom: largeText ? LARGE_TEXT_SCALE : 1,
            width: largeText ? FRAME_W / LARGE_TEXT_SCALE : "100%",
            height: largeText ? FRAME_H / LARGE_TEXT_SCALE : FRAME_H,
            // absolute 로 띄우는 것들(확인 시트·QR 스캐너)이 이 안에 갇히려면
            // 여기가 컨테이닝 블록이어야 한다. overflow-hidden 만으로는
            // 자기가 기준이 아니면 클리핑도 못 해서 화면 전체를 덮어 버린다.
            position: "relative",
            borderRadius: 44, boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
          }}
        >
        <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          {screen === "welcome" && (
            <WelcomeScreen
              // 익명 시작: 로그인 화면을 거치지 않고 바로 본 화면으로 간다.
              onStart={() => { setGuest(true); setName(""); setPhone(""); setScreen("saved"); setTab("menu"); }}
              // 선택적 로그인: 고른 사람만 전화번호 경로로 간다.
              onLogin={() => { setGuest(false); setScreen("phone"); }}
            />
          )}
          {screen === "phone" && (
            <PhoneScreen
              onNext={(p) => { setPhone(p); setScreen("otp"); }}
              onBack={() => setScreen("welcome")}
              onPrivacy={() => setScreen("privacy")}
            />
          )}
          {screen === "otp" && (
            <OtpScreen
              phone={phone}
              // 인증이 끝나면 번호를 즉시 버린다. 더 들고 있을 이유가 없다.
              // 남겨 두면 실제 개인정보를 저장하는 셈이 된다.
              onNext={() => { setPhone(""); setScreen("name"); }}
              onBack={() => setScreen("phone")}
            />
          )}
          {screen === "name" && (
            <NameScreen onNext={(n) => { setName(n); setScreen("greeting"); }} onBack={() => setScreen("otp")} />
          )}
          {screen === "greeting" && (
            <GreetingScreen name={name} onNext={() => { setScreen("saved"); setTab("menu"); }} />
          )}
          {screen === "profile" && (
            <ProfileScreen
              showProgress={!guest}
              onNext={(p) => { addProfile(p); setScreen("saved"); setTab("menu"); }}
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
            <SavedProfilesScreen
              profiles={profiles}
              onAddProfile={() => { setScreen("profile"); }}
              onDeleteProfile={deleteProfile}
              // 매핑을 요청하기 전에 이 프로필을 서버가 찾을 수 있게 등록한다.
              // 실서비스에서는 프로필 저장 시점에 서버로 올라가고 이 줄은 사라진다.
              onOrder={(p) => { registerProfile(p); setOrderProfile(p); setScreen("order-confirm"); }}
              showOrder={fromQr}
            />
          )}
          {screen === "order-confirm" && pairingId && orderProfile && (
            <OrderConfirmScreen
              pairingId={pairingId}
              profile={orderProfile}
              onBack={() => setScreen("saved")}
              onApproved={(id) => { setPlanId(id); setScreen("execution"); }}
            />
          )}
          {screen === "execution" && planId && (
            <ExecutionScreen
              planId={planId}
              onHome={() => {
                setScreen("saved"); setFromQr(false);
                setPlanId(null); setOrderProfile(null); setPairingId(null); setPairingExpiresAt(null); setPairingKiosk(null);
              }}
            />
          )}
          {inMain && tab === "account" && (
            <AccountScreen
              name={name}
              guest={guest}
              onLogout={() => {
                setName(""); setPhone(""); setFromQr(false); setGuest(true);
                setTab("menu"); setScreen("welcome");
              }}
              onLogin={() => { setGuest(false); setScreen("phone"); }}
              // 저장된 정보를 지우는 길. 프로필까지 함께 비운다.
              onClearLocal={() => set확인대기({
                title: "이 기기에서 정보를 지울까요?",
                body: "저장한 프로필과 호칭, 전화번호가 모두 사라져요. 되돌릴 수 없어요.",
                confirmLabel: "모두 지우기",
                run: () => {
                  // 목 전용 함수가 아니라 계약의 삭제 메서드를 부른다.
                  // 실제 client 로 바꿔도 서버에 남은 것까지 함께 지워진다.
                  서버까지지우기();
                  setProfiles([]); setName(""); setPhone("");
                  setOrderProfile(null); setPlanId(null);
                  // 연결 정보도 지운다. 안 지우면 정리한 뒤 몇 분 지나 만료 타이머가
                  // 터지면서 QR 만료 화면으로 튕겨 나간다. 방금 다 지웠는데 왜 그러는지
                  // 사용자는 알 수 없다.
                  setPairingId(null); setPairingExpiresAt(null); setPairingKiosk(null); setFromQr(false);
                },
              })}
              // 연결이 살아 있으면 주문 경로를 끊지 않는다. 하단 탭과 같은 판단이다.
              // 끊으면 QR 을 다시 찍는 것 말고 되돌릴 방법이 없다.
              onProfiles={() => { setTab("menu"); if (!pairingId) setFromQr(false); }}
              onA11y={() => setScreen("a11y")}
              onPrivacy={() => setScreen("privacy")}
            />
          )}
          {screen === "a11y" && (
            <AccessibilityScreen
              largeText={largeText}
              onLargeText={setLargeText}
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
    </div>
  );
}
