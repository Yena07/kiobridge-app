import { useState, useRef, useEffect } from "react";
import { ChevronLeft, Check, Phone } from "lucide-react";

import { Pictogram } from "@/design/Pictogram";
import kioskHeroImg from "@/assets/images/kiosk-hero.jpg";
import {
  P, ACCENT, TEXT_1, TEXT_2, TEXT_3, BORDER, SURFACE, CANVAS, BACKDROP,
  SUCCESS, SUCCESS_BG, WARN, WARN_BG, FAIL, FAIL_BG,
  FONT, SERIF, TYPE, NUM, GAP, RADIUS, FOCUS_STYLES,
} from "@/design/tokens";
import type {
  Screen, MainTab, PlaceType, PairingState, StepStatus, ProfileData, PairingResult,
  MappingResponse, MappedItem, MappingCandidate, ApproveInput, RecommendationReason,
  PlanStatus, CartResult, AbortInfo,
} from "@/domain/types";
import { DETAIL_OPTIONS, PLACE_LIST, PLACE_ICONS, MOCK_PROFILES, STEPS } from "@/domain/catalog";
import { api, POLL_MS, KioBridgeError, getScenario, setScenario, registerProfile, type Scenario } from "@/api/client";

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
        color: "#4A4A4F",
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
        color: selected ? "white" : "#4E5968",
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

function PhoneScreen({ onNext, onBack }: { onNext: (phone: string) => void; onBack: () => void }) {
  const [phone, setPhone] = useState("");
  const formatted = phone.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw.length <= 11) setPhone(raw);
  };
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
          <input
            id="phone-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={formatted}
            onChange={handleChange}
            placeholder="전화번호 입력"
            autoFocus
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
          만 14세 이상만 가입할 수 있어요.{" "}
          <span style={{ color: TEXT_2, textDecoration: "underline" }}>개인정보처리방침</span>
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
    const digit = val.replace(/[^0-9]/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };
  const filled = otp.every((d) => d !== "");
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
              aria-label={`인증번호 ${i + 1}번째 자리`}
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKey(i, e)}
              autoFocus={i === 0}
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
        <CenterHeadline title={<>반갑습니다!<br />어떻게 불러드릴까요?</>} />

        <label htmlFor="name-input" className="sr-only">이름</label>
        <input
          id="name-input"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 입력"
          autoFocus
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
  useEffect(() => {
    const t = setTimeout(onNext, 2600);
    return () => clearTimeout(t);
  }, [onNext]);

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
    </div>
  );
}

// ─── Profile Form ─────────────────────────────────────────────────────────────

function ProfileScreen({ onNext, onBack }: { onNext: (p: ProfileData) => void; onBack: () => void }) {
  const [menuName, setMenuName] = useState("");
  const [place, setPlace] = useState<PlaceType>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [memo, setMemo] = useState("");

  const toggleChip = (sectionLabel: string, choice: string, multi: boolean) => {
    setSelections((prev) => {
      const current = prev[sectionLabel] ?? [];
      if (multi) {
        return { ...prev, [sectionLabel]: current.includes(choice) ? current.filter((c) => c !== choice) : [...current, choice] };
      } else {
        return { ...prev, [sectionLabel]: current[0] === choice ? [] : [choice] };
      }
    });
  };

  const handlePlaceChange = (p: PlaceType) => { setPlace(p); setSelections({}); };
  const options = place ? DETAIL_OPTIONS[place] : [];

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0" style={{ padding: `12px ${GAP.screenX}px 0` }}>
        <div className="flex items-center">
          <BackButton onClick={onBack} />
          <div className="flex-1 flex justify-center" style={{ marginRight: 34 }}>
            <ProgressBar step={4} />
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
                  color: place === label ? "white" : "#4E5968",
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
          <textarea
            aria-label="메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="추가로 기억해둘 내용을 적어주세요."
            rows={3}
            style={{
              width: "100%", ...TYPE.body, color: TEXT_1, fontFamily: FONT,
              padding: "15px 16px", borderRadius: RADIUS.input, resize: "none",
              border: "none", outline: "none", backgroundColor: CANVAS, boxSizing: "border-box",
            }}
          />
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
          onClick={() => onNext({ id: Date.now().toString(), menuName, place, selections, memo })}
          disabled={!menuName.trim()}
        >
          저장하고 시작하기
        </PrimaryBtn>
      </StickyFooter>
    </div>
  );
}

// ─── Saved Profiles ───────────────────────────────────────────────────────────

/** 눈에는 안 보이지만 포커스와 스크린리더에는 남아 있어야 하는 요소. */
const SR_ONLY: React.CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
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
                onDelete={() => {
                  onDeleteProfile(profile.id);
                  if (selectedId === profile.id) {
                    const remaining = profiles.filter((p) => p.id !== profile.id);
                    setSelectedId(remaining[0]?.id ?? null);
                  }
                }}
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

function SpinnerIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="27" stroke={BORDER} strokeWidth="4" />
      <path d="M32 5 A27 27 0 0 1 59 32" stroke={P} strokeWidth="4" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="0.9s" repeatCount="indefinite" />
      </path>
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
  expire.current = onExpire;

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

function QrScannerModal({ onClose, onDetected, hideClose }: { onClose: () => void; onDetected: () => void; hideClose?: boolean }) {
  const [scanning, setScanning] = useState(true);

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
  }, [onDetected]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: "#000" }}>
      <div className="flex items-center justify-between shrink-0" style={{ padding: `20px ${GAP.screenX}px 12px` }}>
        <AppLogo light size={24} />
        {!hideClose && (
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
        )}
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

function QrScreen({ onPaired }: { onPaired: (pairingId: string) => void }) {
  const [phase, setPhase] = useState<"scan" | PairingState>("scan");
  const [pairing, setPairing] = useState<PairingResult | null>(null);

  const handleScanned = () => {
    setPhase("connecting");
    api.claimPairing("kb_demo")
      .then((r) => { setPairing(r); setPhase("connected"); })
      .catch((e: KioBridgeError) => setPhase(e.code === "CLAIM_EXPIRED" ? "expired" : "failed"));
  };
  const handleRescan = () => setPhase("scan");

  if (phase === "scan") {
    return <QrScannerModal onClose={() => {}} hideClose onDetected={handleScanned} />;
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
        {phase === "connecting" && <PairingConnecting />}
        {phase === "connected" && pairing && (
          <PairingConnected
            kioskName={pairing.kioskName}
            expiresAt={pairing.expiresAt}
            onExpire={() => setPhase("expired")}
            onSelectProfile={() => onPaired(pairing.pairingId)}
          />
        )}
        {phase === "failed" && <PairingFailed onScan={handleRescan} />}
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
      body: "이름·주소·주민등록번호 같은 정보는 받지도, 저장하지도 않아요. 결제 정보도 다루지 않아요.",
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

function ConfirmCard({ children, badge, photo }: { children: React.ReactNode; badge?: string; photo?: string | null }) {
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
        <div style={{ padding: "13px 20px", backgroundColor: SUCCESS_BG, display: "flex", alignItems: "center", gap: 8 }}>
          <Pictogram name="checkCircle" size={17} color={SUCCESS} />
          <span style={{ fontSize: 13, fontWeight: 600, color: SUCCESS }}>{badge}</span>
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
function OptionCard({
  name, price, selected, onClick, role = "radio", photo,
}: {
  name: string; price: string; selected: boolean; onClick: () => void; role?: "radio" | "button"; photo?: string | null;
}) {
  const radio = role === "radio";
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      aria-label={`${name}, ${price}`}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "17px 20px", borderRadius: RADIUS.card, cursor: "pointer", fontFamily: FONT,
        border: "none", width: "100%",
        backgroundColor: selected ? P : SURFACE,
        transition: "background-color 0.15s",
      }}
    >
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
    </button>
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
  candidates, reason, reasons, onApprove, onCancel,
}: {
  candidates: MappingCandidate[];
  reason?: string;
  reasons?: RecommendationReason[];
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
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="비슷한 메뉴 후보">
        {candidates.map((c, i) => (
          <OptionCard
            key={c.candidateId}
            role="radio"
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
      <OptionCard
        role="button"
        selected={selected}
        name={item.displayName}
        price={item.priceText}
        photo={item.imageUrl}
        onClick={() => setSelected((v) => !v)}
      />
      <InfoBox variant="info">시스템이 정확하게 찾지 못했어요. 직접 확인해 주세요.</InfoBox>
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

        {mapping?.result === "exact" && (
          <OrderExact item={mapping.item!} reasons={mapping.reasons} onApprove={() => approve()} onCancel={onBack} />
        )}
        {mapping?.result === "clarification" && (
          <OrderClarification
            candidates={mapping.candidates ?? []}
            reason={mapping.reason}
            reasons={mapping.reasons}
            onApprove={(candidateId) => approve({ candidateId })}
            onCancel={onBack}
          />
        )}
        {mapping?.result === "not_found" && <OrderNotFound message={mapping.message} onCancel={onBack} />}
        {mapping?.result === "changed" && (
          <OrderChanged
            item={mapping.item!}
            diffNote={mapping.diffNote}
            reasons={mapping.reasons}
            onApprove={() => approve({ acknowledgedDiff: true })}
            onCancel={onBack}
          />
        )}
        {mapping?.result === "low_confidence" && (
          <OrderLowConfidence
            item={mapping.item!}
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
            <path d="M10 3 A7 7 0 0 1 17 10" stroke={P} strokeWidth="2.5" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.9s" repeatCount="indefinite" />
            </path>
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

  useEffect(() => {
    if (status.state !== "running") return;
    let alive = true;
    const poll = () => {
      api.getPlanStatus(planId).then((s) => { if (alive) setStatus(s); }).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [planId, status.state]);

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
        {status.state === "running" && <ExecInProgress statuses={status.steps} />}
        {status.state === "cart_ready" && status.cart && (
          <ExecSuccess cart={status.cart} steps={status.steps} onHome={onHome} />
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
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [orderProfile, setOrderProfile] = useState<ProfileData | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  const addProfile = (p: ProfileData) => setProfiles((prev) => [...prev, p]);
  const deleteProfile = (id: string) => setProfiles((prev) => prev.filter((p) => p.id !== id));

  const inMain = screen === "saved";

  const handleTabChange = (t: MainTab) => {
    if (t === "qr") setQrKey((k) => k + 1);
    setTab(t);
    setScreen("saved");
    setFromQr(false);
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
          className="bg-white overflow-hidden flex flex-col"
          style={{
            zoom: largeText ? LARGE_TEXT_SCALE : 1,
            width: largeText ? FRAME_W / LARGE_TEXT_SCALE : "100%",
            height: largeText ? FRAME_H / LARGE_TEXT_SCALE : FRAME_H,
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
            <PhoneScreen onNext={(p) => { setPhone(p); setScreen("otp"); }} onBack={() => setScreen("welcome")} />
          )}
          {screen === "otp" && (
            <OtpScreen phone={phone} onNext={() => setScreen("name")} onBack={() => setScreen("phone")} />
          )}
          {screen === "name" && (
            <NameScreen onNext={(n) => { setName(n); setScreen("greeting"); }} onBack={() => setScreen("otp")} />
          )}
          {screen === "greeting" && (
            <GreetingScreen name={name} onNext={() => { setScreen("saved"); setTab("menu"); }} />
          )}
          {screen === "profile" && (
            <ProfileScreen
              onNext={(p) => { addProfile(p); setScreen("saved"); setTab("menu"); }}
              onBack={() => setScreen("saved")}
            />
          )}
          {inMain && tab === "qr" && (
            <QrScreen
              key={qrKey}
              onPaired={(id) => { setPairingId(id); setFromQr(true); setTab("menu"); }}
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
                setPlanId(null); setOrderProfile(null); setPairingId(null);
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
              onClearLocal={() => {
                setProfiles([]); setName(""); setPhone("");
                setOrderProfile(null); setPlanId(null);
              }}
              onProfiles={() => { setTab("menu"); setFromQr(false); }}
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
        </div>
      </div>
    </div>
  );
}
