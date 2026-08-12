/**
 * 화면에 나가는 우리말 → English.
 *
 * 열쇠는 우리말 원문 그대로다. 표에 없으면 원문이 그대로 보인다(i18n/apply.ts) —
 * 빈칸이나 열쇠 이름이 뜨는 것보다 낫고, 무엇이 안 옮겨졌는지 화면에서 바로 보인다.
 *
 * ── 여기 넣으면 안 되는 것 ─────────────────────────────────────────────────
 *
 * **사용자가 적은 값**(메뉴 이름·메모·호칭)은 넣지 않는다. 표에 있는 문장과
 * 정확히 같으면 바뀌는데, 사람이 적은 말이 바뀌면 자기가 적은 것이 아닌 것이
 * 화면에 뜬다.
 *
 * **서버가 준 문장**도 넣지 않는다. 추천 이유·제외 사유는 서버가 만든 말이고,
 * 이 앱은 그걸 그대로 인용한다는 원칙을 지켜 왔다. 서버가 영어로 줄 수 있게
 * 되면 그때 서버가 준 것을 그대로 쓴다.
 *
 * 저장값은 안 바뀐다. 주문표의 selections 는 계속 우리말이고(canonical.ts 가 그
 * 우리말을 enum 으로 옮긴다), 여기서 바뀌는 것은 **보여 주는 글자뿐**이다.
 */
export const EN: Record<string, string> = {
  // ─── 첫 화면 · 동의 ───────────────────────────────────────────────────────
  "키오스크 앞에서 헤매지 않도록,": "So you never feel lost at a kiosk,",
  "저장해 둔 주문을 대신 담아드려요": "we add your saved order for you",
  "바로 시작하기": "Start now",
  "가입 없이 바로 쓸 수 있어요.": "No sign-up needed.",
  "입력한 내용은 이번 한 번만 쓰고 지워집니다": "What you enter is used once, then erased",
  "로그인 (선택)": "Log in (optional)",
  "주문에 쓸 정보를 모으고 쓰는 데 동의합니다.": "I agree to the use of my order details.",
  "메뉴 조건과 도움 설정이에요. 이름·전화번호는 받지 않아요.":
    "Menu preferences and support settings. We never ask for your name or phone number.",
  "자세히": "Details",
  "동의하셔야 시작할 수 있어요": "Please agree to continue",
  "동의하셔야 로그인할 수 있어요": "Please agree to log in",
  "동의하셔야 가입할 수 있어요": "Please agree to sign up",

  // ─── 로그인 · 가입 ────────────────────────────────────────────────────────
  "로그인": "Log in",
  "저장해 두신 주문표를 다시 불러와요": "Bring back the order cards you saved",
  "아이디": "ID",
  "비밀번호": "Password",
  "비밀번호 다시 적기": "Re-enter password",
  "보기": "Show",
  "숨기기": "Hide",
  "확인하는 중": "Checking",
  "아이디와 비밀번호를 적으면 로그인할 수 있어요": "Enter your ID and password to log in",
  "아이디가 없으신가요? 회원가입": "No account yet? Sign up",
  "이미 아이디가 있으신가요? 로그인": "Already have an account? Log in",
  "회원가입": "Sign up",
  "아이디와 비밀번호만 받아요": "We only ask for an ID and a password",
  "가입하고 시작하기": "Sign up and start",
  "가입하는 중": "Signing up",
  "아이디와 비밀번호를 적으면 가입할 수 있어요": "Enter an ID and password to sign up",
  "같은 비밀번호를 한 번 더 적어 주세요": "Please enter the same password again",
  "아이디를 적어 주세요": "Please enter an ID",
  "비밀번호를 적어 주세요": "Please enter a password",
  "아이디 또는 비밀번호가 맞지 않아요": "That ID or password doesn’t match",
  "이미 쓰고 있는 아이디예요": "That ID is already taken",
  "비밀번호가 달라요": "The passwords don’t match",
  "비밀번호가 너무 길어요. 조금 줄여 주세요": "That password is too long. Please shorten it",

  // ─── 호칭 · 환영 ──────────────────────────────────────────────────────────
  "반갑습니다!": "Nice to meet you!",
  "어떻게 불러드릴까요?": "What should we call you?",
  "부르는 말만 쓰여요. 실제 이름이 아니어도 괜찮아요":
    "Only used to greet you. It doesn’t have to be your real name",
  "부를 호칭": "What to call you",
  "예: 할머니, 김씨": "e.g. Grandma, Mr. Kim",
  // 숫자가 끼는 문장이라 조각으로 쪼개진다. tf() 로 통째로 옮긴다.
  "전체 {전체}단계 중 {지금}단계": "Step {지금} of {전체}",
  "계속하기": "Continue",
  "반가워요,": "Nice to meet you,",
  "님!": "!",
  "자주 시키는 주문을 저장해 두면": "Save the orders you make often and",
  "키오스크 앞에서 바로 꺼내 쓸 수 있어요": "you can pull them up right at the kiosk",

  // ─── 도움 설정 ────────────────────────────────────────────────────────────
  "필요한 도움이": "Do you need any",
  "있으신가요?": "help?",
  "켜는 즉시 이 화면이 바로 바뀌어요. 안 켜셔도 괜찮아요":
    "Changes apply right away. It’s fine to leave them off",
  "나중에 계정 화면에서 언제든 바꿀 수 있어요.": "You can change these any time from your account.",
  "보기 편하게": "Let’s make it",
  "바꿔드릴게요": "easier to read",
  "필요하신 것만 켜 주세요. 켠 것은 이 기기에만 남고, 이 창을 닫으면 처음으로 돌아가요.":
    "Turn on only what you need. These stay on this device and reset when you close this window.",
  "이 앱은 원래 큰 버튼과 또렷한 대비로 만들었고, 소리로만 알리는 것은 하나도 없어요. 어려우면 이 화면을 직원에게 보여 주세요.":
    "This app already uses large buttons and strong contrast, and nothing is announced by sound alone. If you get stuck, show this screen to a staff member.",
  "이 앱이 바로 바꿔요": "Changes this app right away",
  "키오스크에 전해 드려요": "Passed on to the kiosk",
  "앱 화면은 그대로예요. 지금은 전해 주기만 해요.":
    "This app’s screens stay the same. For now we only pass this on.",
  "큰 글씨": "Large text",
  "앱 전체의 글씨와 버튼을 크게 봐요": "Makes all text and buttons bigger",
  "고대비": "High contrast",
  "글씨와 배경의 차이를 더 뚜렷하게 해요": "Sharpens the difference between text and background",
  "소리로 읽어 주기": "Read aloud",
  "화면에 나온 안내를 소리로 읽어 드려요": "Reads what’s on screen out loud",
  "쉬운 단계": "Fewer steps",
  "이유 화면을 건너뛰고 바로 확인 화면으로 가요": "Skips the reason screen and goes straight to review",
  "시간 여유": "More time",
  "연결 시간이 지나도 보던 화면을 멋대로 닫지 않아요":
    "Won’t close the screen you’re reading when the session times out",
  "직원 도움": "Staff help",
  "승인 화면에도 직원에게 보여 달라는 안내를 띄워요":
    "Shows a note asking staff for help on the approval screen too",
  "그림 안내": "Picture guidance",
  "글보다 그림으로 알려 달라고 전해요": "Asks the kiosk to guide with pictures rather than text",
  "소리 대신 화면": "Screen instead of sound",
  "소리 안내를 못 들어요. 키오스크에 그렇게 전해요":
    "I can’t hear audio guidance. We tell the kiosk that",
  "안내 언어": "Guidance language",
  "키오스크에 이 언어로 안내해 달라고 전해요": "Asks the kiosk to guide you in this language",

  // ─── 알레르기 ─────────────────────────────────────────────────────────────
  "못 드시는 것": "Foods to avoid",
  "고르시면 그게 들어간 메뉴는 추천에서 아예 빼요. 없으시면 안 고르셔도 돼요.":
    "Anything you pick is removed from recommendations entirely. Skip this if none apply.",
  "땅콩": "Peanut",
  "대두": "Soy",
  "우유": "Milk",
  "계란": "Egg",
  "밀": "Wheat",
  "새우": "Shrimp",

  // ─── 주문표 목록 ──────────────────────────────────────────────────────────
  "어떤 주문표로": "Which order card",
  "주문할까요?": "should we use?",
  "저장된 주문표 목록": "Saved order cards",
  "저장된 주문표가 없어요": "No saved order cards yet",
  "새 주문표를 추가해보세요": "Try adding one",
  "+ 새 주문표 추가": "+ Add an order card",
  "이 주문표로 주문하기": "Order with this card",
  "삭제": "Delete",
  "가격 한도 (선택)": "Price limit (optional)",
  // 직접 적는 칸이다. 단위(원 / KRW)는 표가 아니라 코드에서 언어를 보고 붙인다.
  "예: 8000": "e.g. 8000",
  "비워 두면 한도 없이 찾아요": "Leave it blank to search without a limit",
  "QR 찍기": "Scan QR",
  "내 주문표": "My cards",
  "계정": "Account",

  // ─── 주문표 만들기 ────────────────────────────────────────────────────────
  "메뉴 주문표": "Order card",
  "자주 주문하는 메뉴를 저장해두세요": "Save the menu you order often",
  "메뉴 이름": "Menu name",
  "장소 유형": "Place type",
  "메모": "Note",
  "필수": "Required",
  "선택": "Optional",
  "저장하고 시작하기": "Save and start",
  // 저장해 둔 주문표를 다시 열어 고칠 때의 문구.
  "주문표 고치기": "Edit this card",
  "고치고 저장하면 이 주문표가 바뀌어요": "Saving replaces this card",
  "고친 내용 저장하기": "Save changes",
  "고치기": "Edit",
  "맨 위 메뉴 이름을 적으면 저장할 수 있어요": "Enter a menu name above to save",
  "주문에 필요한 내용만 적어 주세요. 이름·전화번호·주민등록번호 같은 개인정보는 적지 마세요.":
    "Write only what’s needed for the order. Don’t include personal details like your name, phone number, or ID number.",
  "카페": "Café",
  "음식점": "Restaurant",
  "병원": "Clinic",
  "관공서": "Public office",
  "이용 방식": "Dine in or take out",
  "먹고 가기": "Eat in",
  "포장하기": "Take out",
  "맵기": "Spice level",
  "순한맛": "Mild",
  "보통맛": "Medium",
  "매운맛": "Hot",
  "형태": "Bone or boneless",
  "뼈": "Bone-in",
  "순살": "Boneless",
  "컵": "Cup",
  "종이컵": "Paper cup",
  "일반컵": "Regular cup",
  "수량": "Quantity",
  "1개": "1",
  "2개": "2",
  "3개": "3",

  // ─── QR · 연결 ────────────────────────────────────────────────────────────
  "키오스크의 QR 코드를": "Point your camera at",
  "카메라에 맞춰주세요": "the kiosk’s QR code",
  "QR 코드가 잘 보이지 않으면 조명을 조절해 주세요": "If the QR code is hard to see, adjust the lighting",
  "연결되었습니다": "Connected",
  "키오스크": "Kiosk",
  "세션 유효시간": "Session time left",
  "만료되면 QR을 다시 스캔해 주세요": "Scan the QR code again when it expires",
  "주문표 선택하기": "Choose an order card",

  // ─── 이유 · 확인 ──────────────────────────────────────────────────────────
  "이렇게 찾았어요": "How we found this",
  "저장해 두신 조건으로 오늘 메뉴에서 찾은 결과예요.":
    "This is what we found on today’s menu using your saved preferences.",
  "이걸 보고 골랐어요": "What we looked at",
  "반영한 조건": "What we used",
  "맞추지 못한 조건": "What we couldn’t match",
  "빼 둔 메뉴와 그 이유": "Menus we left out, and why",
  "담을 메뉴 확인하기": "Review what goes in the cart",
  "메뉴 고르러 가기": "Go pick a menu",
  "상품": "Item",
  "가격": "Price",
  "승인하고 담기": "Approve and add",
  "취소": "Cancel",
  "혹시 이 중": "Which one",
  "어떤 메뉴인가요?": "did you mean?",
  "비슷한 메뉴가 여러 개예요": "There are several similar menus",
  "저장하신 조건": "Your saved preferences",
  "조건 일치": "Matches",
  "고르신 메뉴와 달라요": "Different from what you picked",
  "메뉴를 선택하면 승인할 수 있어요": "Pick a menu to approve",
  "담을 수 있는 메뉴가 없어요": "There’s no menu we can add",
  "확실하지 않아요": "Not certain",

  // ─── 계정 ─────────────────────────────────────────────────────────────────
  "게스트로 이용 중": "Using as a guest",
  "로그인 없이 모든 기능을 쓰고 있어요": "You’re using every feature without logging in",
  "다음에도 불러오려면 로그인 (선택)": "Log in to bring these back next time (optional)",
  "저장된 주문표 관리": "Manage saved order cards",
  "이번 이용에만 쓰는 메뉴 주문표예요": "Order cards for this visit only",
  "접근성 설정": "Support settings",
  "개인정보 안내": "Privacy notice",
  "무엇을 저장하고 무엇을 저장하지 않는지": "What we keep and what we don’t",
  "이 기기에서 정보 지우기": "Erase everything on this device",
  "지금까지 입력한 내용을 모두 지워요": "Erases everything you’ve entered",
  "저장해 둔 내용을 모두 지워요": "Erases everything you’ve saved",
  "로그아웃": "Log out",
  "모두 지우기": "Erase everything",
  "다시 시도": "Try again",
  "지우기": "Delete",

  // ─── 개인정보 안내 ────────────────────────────────────────────────────────
  "무엇을 남기고": "What we keep and",
  "무엇을 안 남기나요": "what we don’t",
  "동의는 언제 받나요": "When do you ask for consent?",
  "저장하는 것": "What we keep",
  "저장하지 않는 것": "What we never keep",
  "로그인은 어떻게 하나요": "How does logging in work?",
  "키오스크에 넘기는 것": "What goes to the kiosk",
  "지우는 방법": "How to erase it",
  "이 앱은 주문을 장바구니에 담는 데까지만 도와드려요. 결제는 키오스크에서 직접 하시면 돼요.":
    "This app only helps up to adding items to the cart. You handle the rest at the kiosk yourself.",

  // ─── 키오스크 연동 ────────────────────────────────────────────────────────
  "키오스크에 연결하는 중": "Connecting to the kiosk",
  "연결할 수 없습니다": "Can’t connect",
  "유효하지 않은 QR입니다": "That QR code isn’t valid",
  /*
   * 제목이 <br /> 로 두 줄이라 조각 둘로 들어온다. 우리말과 영어의 어순이 같아
   * 조각째 옮겨도 말이 된다 — "연결 시간이 / 만료되었습니다", "The connection /
   * has timed out".
   */
  "연결 시간이": "The connection",
  "만료되었습니다": "has timed out",
  "안전을 위해 연결이 종료되었어요": "The connection was closed for your safety",
  /*
   * 원래 "QR 코드를 <strong>다시 스캔</strong>해 주세요" 라 조각이 셋이었다.
   * 영어는 'again' 이 문장 끝에 붙어서 가운데 조각만 옮기면 어순이 무너진다.
   * 굵은 자리를 "다시 스캔해 주세요" 로 넓혀 조각을 둘로 만들었다.
   *
   * 그래서 굵어지는 곳이 두 언어에서 다르다.
   *
   *   우리말  키오스크에 부착된 QR 코드를 **다시 스캔해 주세요**   (동작 전체)
   *   영어    Scan the QR code on the kiosk **again**            ('again' 만)
   *
   * 영어 쪽은 동작(Scan)이 강조 밖에 있다. 어순 때문에 어쩔 수 없고, 그래도
   * 말이 된다 — 한 번 찍어 본 사람에게 새로 알려야 할 것은 '또' 라는 사실이다.
   */
  "키오스크에 부착된 QR 코드를": "Scan the QR code on the kiosk",
  "다시 스캔해 주세요": "again",
  "문제가 반복되면 매장 직원에게 도움을 요청하세요":
    "If this keeps happening, ask a staff member for help",

  // ─── 실행 · 결과 ──────────────────────────────────────────────────────────
  "잠시만 기다려 주세요": "Just a moment",
  "화면을 닫지 마세요": "Please don’t close this screen",
  "장바구니에 담았어요": "Added to the cart",
  "처음으로": "Back to start",
  "포장/매장 선택": "Dine in or take out",
  "메뉴 선택": "Choose menu",
  "옵션 선택": "Choose options",
  "옵션 확정·담기": "Confirm and add",
  "장바구니 확인": "Check the cart",
  "됨": "Done",
  "실패": "Failed",

  // ─── 훑어서 찾은 나머지 (i18n/apply.ts 의 안바뀐것) ────────────────────────
  //
  // "키오브릿지" 와 "한국어" 는 일부러 안 넣는다 — 앞은 앱 이름이고, 뒤는 언어를
  // 그 언어로 적는 목록이라 영어 화면에서도 한국어로 보여야 찾을 수 있다.
  "주요 메뉴": "Main menu",
  "버전 1.0.0": "Version 1.0.0",
  "뒤로 가기": "Back",
  "메뉴 이름 (필수)": "Menu name (required)",
  "예) 아이스 아메리카노 둘": "e.g. two iced americanos",
  "장소 유형 선택": "Choose a place type",
  "메모 (선택). 이름·전화번호·주민등록번호 같은 개인정보는 적지 마세요":
    "Note (optional). Don’t include personal details like your name, phone number, or ID number",
  "예: 얼음 적게 주세요": "e.g. light on the ice",
  "주문에 필요한 내용만 적어 주세요.": "Write only what’s needed for the order.",
  "이름·전화번호·주민등록번호 같은 개인정보는 적지 마세요.":
    "Don’t include personal details like your name, phone number, or ID number.",
  "맨 위": "the", "을 적으면 저장할 수 있어요": "above to save",
  "메뉴 주문표에 적어 두신 내용(예: 포장, 매운맛, 순살, 종이컵)만 저장해요. 사람이 읽는 말 그대로예요. 지금은 이 기기 안에만 있어요. 실수로 새로고침해도 다시 적지 않으셔도 되게 이 창 안에 남겨 두고, 창을 닫으면 지워요.":
    "We keep only what you wrote on your order card (take-out, hot, boneless, paper cup, and so on) — in plain words. Right now it stays on this device. We keep it inside this window so an accidental refresh doesn’t make you type it again, and we erase it when the window closes.",
  "실제 이름·주소·전화번호·주민등록번호는 받지도, 저장하지도 않아요. 결제 정보도 다루지 않아요. 부르는 호칭은 화면에 띄우는 데만 쓰고 이 기기 밖으로 나가지 않아요.":
    "We never ask for or keep your real name, address, phone number, or ID number. We don’t handle payment details either. The name you’re greeted by is only shown on screen and never leaves this device.",
  "직접 지으신 아이디와 비밀번호만 받아요. 실제 이름이나 전화번호는 묻지 않아요. 비밀번호는 서버에서 알아볼 수 없는 형태로 바꿔 저장하고, 이 앱은 적으신 비밀번호를 어디에도 남기지 않아요. 로그인 상태는 새로고침해도 그대로지만, 이 창을 닫으면 풀립니다.":
    "We only take an ID and password you make up yourself. We never ask for your real name or phone number. The server stores your password in a form it can’t read back, and this app keeps it nowhere. You stay logged in across a refresh, but closing this window logs you out.",
  "QR로 연결할 때는 이번 주문에만 쓰는 짧은 연결 표만 오가요. 시간이 지나면 저절로 만료돼요.":
    "Connecting by QR only passes a short-lived pass used for this order. It expires on its own after a while.",
  "지금은 로그인 없이 쓰고 계셔서 이 창을 닫으면 이 기기에 남지 않아요. 바로 지우시려면 계정 화면의 ‘이 기기에서 정보 지우기’를 눌러 주세요. 다만 키오스크에 보낸 주문 기록은 서버에 남아요 — 아직 지우는 길이 없어서요.":
    "You’re using this without logging in, so nothing stays on this device once you close the window. To erase it right away, tap “Erase everything on this device” on the account screen. One thing stays: the order record sent to the kiosk remains on the server — there’s no way to erase that yet.",
  "세부 옵션": "Details",
  "1개 선택": "Pick one",
  "이용 방식 — 1개 선택": "Dine in or take out — pick one",
  "맵기 — 1개 선택": "Spice level — pick one",
  "형태 — 1개 선택": "Bone or boneless — pick one",
  "컵 — 1개 선택": "Cup — pick one",
  "수량 — 1개 선택": "Quantity — pick one",
  "QR 코드를 인식했어요": "QR code recognized",
  "QR 코드 스캔": "QR code scanner",
  "QR 스캔 닫기": "Close the scanner",
  // 한 덩어리로 오는 자리. 줄 단위 항목만으로는 안 맞아서 줄바꿈째 넣는다.
  "키오스크의 QR 코드를\n카메라에 맞춰주세요": "Point your camera\nat the kiosk’s QR code",
  "{금액}보다 비싼 메뉴는 빼고 찾아요. 남는 게 없으면 그렇다고 알려 드려요.":
    "We’ll leave out anything above {금액}. If nothing is left, we’ll tell you so.",
  "주문표 삭제": "Delete order card",
  // ─── QR 다시 찍기 갈래 ────────────────────────────────────────────────────
  "QR 코드를": "Scan the",
  "찍어 주세요": "QR code",
  "키오스크 화면이나 기계에 붙어 있어요": "It’s on the kiosk screen or stuck to the machine",
  "찍지 않아도": "Even without scanning, you can review your saved",
  "에서 저장한 조건을 먼저 확인할 수 있어요": "first",
  "QR 다시 스캔하기": "Scan the QR code again",
  "연결이 끊어졌어요": "The connection ended",
  "연결 시간이 지났어요": "The session timed out",
  // ─── 이유 화면 ────────────────────────────────────────────────────────────
  //
  // 서버가 준 문장(추천 이유·제외 사유)은 일부러 안 넣는다. 이 앱은 그걸 그대로
  // 인용한다는 원칙을 지켜 왔고, 우리가 영어로 바꾸면 서버가 한 말인지 우리가
  // 지어낸 말인지 다시 알 수 없다. 서버가 영어로 줄 수 있게 되면 그때 받아 쓴다.
  //
  // 메뉴 이름도 안 넣는다. 사용자는 이 이름을 키오스크 화면과 맞춰 봐야 하는데,
  // 옮기면 화면에 있는 이름과 달라져서 맞춰 볼 수가 없다.
  "반영:": "Used:",
  "제외:": "Left out:",
  "비슷한 메뉴 후보": "Similar menu options",
  // ─── 결과 화면 ────────────────────────────────────────────────────────────
  "담긴 내역": "What went in",
  "담긴 내역을 불러오지 못했어요": "We couldn’t load what went in",
  "화면 인식으로 확인됨": "Confirmed by reading the screen",
  "키오스크가 보내온 결과": "What the kiosk sent back",
  "키오스크 화면에서 장바구니를 확인해 주세요": "Please check the cart on the kiosk screen",
  "이유 {n}개 더 보기": "See {n} more reasons",
  // ─── 오류 문구 ────────────────────────────────────────────────────────────
  //
  // 화면에 그대로 뜨는 말이라 옮긴다. 서버가 준 문장(추천 이유 등)과 달리
  // 이건 우리가 지은 말이다.
  "메뉴를 먼저 찾아야 해요": "We need to find the menu first",
  "주문표를 찾을 수 없어요": "We can’t find that order card",
  "연결이 만료됐어요. QR을 다시 찍어 주세요": "The session expired. Please scan the QR code again",
  "저장하신 조건을 서버가 읽지 못했어요": "The server couldn’t read your saved preferences",
  "저장하신 조건을 다시 확인해 주세요": "Please check your saved preferences again",
  "저장하신 알레르기 중에 저희가 확인하지 못한 것이 있어요. 주문표에서 다시 골라 주시거나 직원에게 도움을 청해 주세요.":
    "There’s an allergy we couldn’t confirm. Please pick it again on your order card, or ask a staff member for help.",
  "진행 상황을 확인할 수 없어요": "We can’t check the progress",
  "서버에 남은 정보를 지우지 못했어요": "We couldn’t erase what’s left on the server",
  "요청을 처리하지 못했어요": "We couldn’t complete that request",
  "잠시 후 다시 시도해 주세요": "Please try again in a moment",
  "안전을 위해 중단되었습니다": "Stopped for safety",
  "예상하지 못한 화면이 감지되어 작동을 멈췄어요.": "We stopped because the screen wasn’t what we expected.",
  "직원 초기화를 기다려 주세요": "Please wait for a staff member to reset it",
  "키오스크가 한 일 {n}가지": "{n} things the kiosk did",
};
