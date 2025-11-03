import { DependencyList } from "./types";
import { useRef } from "./useRef";
import { shallowEquals } from "../utils";

/**
 * 계산 비용이 큰 함수의 결과를 메모이제이션합니다.
 * 의존성 배열(deps)의 값이 변경될 때만 함수를 다시 실행합니다.
 *
 * @param factory - 메모이제이션할 값을 생성하는 함수
 * @param deps - 의존성 배열
 * @param equals - 의존성을 비교할 함수 (기본값: shallowEquals)
 * @returns 메모이제이션된 값
 */
export const useMemo = <T>(factory: () => T, deps: DependencyList, equals = shallowEquals): T => {
  // 여기를 구현하세요.
  // useRef를 사용하여 이전 의존성 배열과 계산된 값을 저장해야 합니다.
  // equals 함수로 의존성을 비교하여 factory 함수를 재실행할지 결정합니다.

  const ref = useRef<{ deps: DependencyList; value: T } | null>(null);

  if (!ref.current || !equals(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory(),
    };
  }
  return ref.current.value;
};
