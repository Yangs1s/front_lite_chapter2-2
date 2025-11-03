import { useState } from "../core";

/**
 * 리렌더링되어도 변경되지 않는 참조(reference) 객체를 반환합니다.
 * .current 속성을 통해 값에 접근하고 변경할 수 있습니다.
 *
 * @param initialValue - ref 객체의 초기 .current 값
 * @returns `{ current: T }` 형태의 ref 객체
 */
export const useRef = <T>(initialValue: T): { current: T } => {
  // 여기를 구현하세요.
  // useState를 사용하여 ref 객체를 한 번만 생성하도록 해야 합니다.

  const [state] = useState({ current: initialValue });
  return state;
};
