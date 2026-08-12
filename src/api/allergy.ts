import { type AllergenId } from "@/api/canonical";

/**
 * 이 사람이 늘 피해야 하는 것.
 *
 * 주문표에도 알레르기 축이 있는데 왜 따로 두나 —
 * **알레르기는 주문마다 달라지는 값이 아니라 그 사람에 대한 사실**이기 때문이다.
 * 주문표에만 두면 새 주문표를 만들 때마다 다시 골라야 하고, 한 번 빠뜨리면
 * 그 주문표로 주문할 때 걸러지지 않는다. 빠뜨려도 되는 값이 아니다.
 *
 * ── 주문표 쪽과 합친다, 덮지 않는다 ─────────────────────────────────────────
 *
 * 서버로 나갈 때 주문표의 알레르기와 **합집합**을 만든다(canonical.ts).
 * 합치면 걸러지는 후보가 늘어날 뿐 줄지 않는다 — 어느 쪽을 빠뜨려도 안전한
 * 방향으로만 틀린다. 덮어쓰면 한쪽이 사라져서 안 걸러진다.
 *
 * ── 여섯뿐인 이유 ──────────────────────────────────────────────────────────
 *
 * 킷 계약의 AllergenId 가 여섯에 UNKNOWN 하나다. 표에 없는 것을 고르게 하면
 * UNKNOWN 으로 나가고, 서버는 그걸 '확인 못 한 절대 조건' 으로 보고 주문을
 * 아예 막는다(RECONFIRMATION_REQUIRED). 고를 수 있게 해 놓고 고르면 주문이
 * 안 되는 칸을 만들지 않는다.
 */

export const 알레르기목록: { id: AllergenId; label: string }[] = [
  { id: "PEANUT", label: "땅콩" },
  { id: "SOY", label: "대두" },
  { id: "MILK", label: "우유" },
  { id: "EGG", label: "계란" },
  { id: "WHEAT", label: "밀" },
  { id: "SHRIMP", label: "새우" },
];

const 아는것 = new Set<string>(알레르기목록.map((x) => x.id));

/** 저장된 값이 우리가 아는 알레르기인가. 모르는 값은 받지 않는다. */
export const 아는알레르기 = (v: unknown): v is AllergenId =>
  typeof v === "string" && 아는것.has(v);

let 값: AllergenId[] = [];
const 듣는이 = new Set<() => void>();

export const 알레르기설정 = {
  읽기: (): AllergenId[] => 값,
  /** 하나를 켜고 끈다. 목록 순서를 지켜서 화면과 서버로 나가는 순서가 같게 둔다. */
  뒤집기(id: AllergenId): void {
    const 있음 = 값.includes(id);
    값 = 알레르기목록
      .map((x) => x.id)
      .filter((x) => (x === id ? !있음 : 값.includes(x)));
    for (const f of 듣는이) f();
  },
  비우기(): void {
    값 = [];
    for (const f of 듣는이) f();
  },
  /**
   * 저장해 둔 값으로 되돌린다. **듣는이에게 알리지 않는다.**
   * 화면이 첫 그림을 그리기 전에 한 번만 부른다 — a11y.ts 의 되살리기 와 같은 이유다.
   */
  되살리기(목록: unknown): void {
    const 받은것 = Array.isArray(목록) ? 목록.filter(아는알레르기) : [];
    // 목록 순서로 정리한다. 손댄 순서가 화면 순서를 흔들지 않게.
    값 = 알레르기목록.map((x) => x.id).filter((id) => 받은것.includes(id));
  },
  구독(f: () => void): () => void {
    듣는이.add(f);
    return () => { 듣는이.delete(f); };
  },
};
