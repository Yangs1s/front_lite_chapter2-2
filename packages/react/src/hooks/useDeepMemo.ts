import { deepEquals } from "../utils";
import { DependencyList } from "./types";
import { useMemo } from "./useMemo";

/**
 * `deepEquals`를 사용하여 의존성을 깊게 비교하는 `useMemo` 훅입니다.
 */
export const useDeepMemo = <T>(factory: () => T, deps: DependencyList): T => {
  // 여기를 구현하세요.
  // useMemo와 deepEquals 함수를 사용해야 합니다.
  return useMemo(factory, deps, deepEquals);
};
