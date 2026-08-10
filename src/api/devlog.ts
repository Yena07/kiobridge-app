/**
 * 지금 어디에 붙어 있는지, 방금 무엇이 오갔는지 눈으로 보게 한다.
 *
 * 화면만 봐서는 목인지 실서버인지 구분할 방법이 없다. 둘 다 그럴듯한 답을
 * 돌려주기 때문이다. 그래서 실제로 나간 요청을 여기 모아 두고, 개발 중에만
 * 옆에 띄운다.
 *
 * 팀 백엔드 모드(npm run dev:team · build:team)에서만 기록한다.
 * 기본 빌드에서는 __TEAM_BACKEND__ 가 거짓이라 이 모듈을 부르는 쪽이 통째로 사라진다.
 */

export interface 오간것 {
  방법: string;
  경로: string;
  상태: number | "실패";
  걸린시간: number;
  시각: number;
}

const 최대 = 12;
let 기록: 오간것[] = [];
const 듣는이 = new Set<() => void>();

export const 연동기록 = {
  남기기(x: 오간것): void {
    // 오래된 것부터 버린다. 개발용이라 다 쌓아 둘 이유가 없다.
    기록 = [x, ...기록].slice(0, 최대);
    for (const f of 듣는이) f();
  },
  읽기: (): 오간것[] => 기록,
  구독(f: () => void): () => void {
    듣는이.add(f);
    return () => { 듣는이.delete(f); };
  },
};

/** 팀 백엔드 모드인가. 빌드할 때 정해지므로 아닌 쪽 코드는 번들에서 빠진다. */
export const 팀백엔드모드 = __TEAM_BACKEND__;
