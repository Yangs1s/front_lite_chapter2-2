import type { AnyFunction } from "../types";
import { useCallback } from "./useCallback";
import { useRef } from "./useRef";

/**
 * 항상 최신 상태를 참조하면서도, 함수 자체의 참조는 변경되지 않는 콜백을 생성합니다.
 *
 * @param fn - 최신 상태를 참조할 함수
 * @returns 참조가 안정적인 콜백 함수
 */
export const useAutoCallback = <T extends AnyFunction>(fn: T): T => {
  // 여기를 구현하세요.
  // useRef와 useCallback을 조합하여 구현해야 합니다.
  const fnRef = useRef(fn);
  fnRef.current = fn; // 매 렌더링마다 최신 함수로 업데이트

  // 참조는 변하지 않지만 항상 최신 함수를 호출하는 래퍼
  return useCallback(((...args: Parameters<T>) => fnRef.current(...args)) as T, []);
};
