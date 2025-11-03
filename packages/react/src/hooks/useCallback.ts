import { DependencyList } from "./types";
import { useMemo } from "./useMemo";
import type { AnyFunction } from "../types";

/**
 * 함수를 메모이제이션합니다.
 * 의존성 배열(deps)의 값이 변경될 때만 함수를 재생성합니다.
 *
 * @param callback - 메모이제이션할 콜백 함수
 * @param deps - 의존성 배열
 * @returns 메모이제이션된 콜백 함수
 */
export const useCallback = <T extends AnyFunction>(callback: T, deps: DependencyList): T => {
  // 여기를 구현하세요.
  // useMemo를 사용하여 구현할 수 있습니다.
  return useMemo(() => callback, deps);
};
