import { shallowEquals } from "../utils";
import { context } from "./context";
import { EffectHook } from "./types";
import { enqueueRender } from "./render";
import { HookTypes } from "./constants";

/**
 * 사용되지 않는 컴포넌트의 훅 상태와 이펙트 클린업 함수를 정리합니다.
 */
export const cleanupUnusedHooks = () => {
  // visited Set에 없는 경로의 훅 상태 정리
  const allPaths = Array.from(context.hooks.state.keys());

  for (const path of allPaths) {
    // 이번 렌더링에서 방문하지 않은 컴포넌트
    if (!context.hooks.visited.has(path)) {
      // 해당 경로의 훅들 가져오기
      const hooks = context.hooks.state.get(path) || [];

      // 이펙트 훅의 cleanup 함수 실행
      for (const hook of hooks) {
        if (hook && hook.kind === HookTypes.EFFECT && hook.cleanup) {
          hook.cleanup();
        }
      }

      // 상태와 커서 제거
      context.hooks.state.delete(path);
      context.hooks.cursor.delete(path);
    }
  }

  // visited Set 초기화 (다음 렌더링을 위해)
  context.hooks.visited.clear();
};

/**
 * 컴포넌트의 상태를 관리하기 위한 훅입니다.
 * @param initialValue - 초기 상태 값 또는 초기 상태를 반환하는 함수
 * @returns [현재 상태, 상태를 업데이트하는 함수]
 */
export const useState = <T>(initialValue: T | (() => T)): [T, (nextValue: T | ((prev: T) => T)) => void] => {
  // 1. 현재 컴포넌트의 경로와 훅 커서 가져오기
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;
  const hooks = context.hooks.currentHooks;

  // 2. 첫 렌더링이라면 초기값으로 상태 설정
  if (hooks[cursor] === undefined) {
    // 함수형 초기값이면 실행 (lazy initialization)
    const value = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    hooks[cursor] = value;
  }

  // 3. 현재 상태 가져오기
  const state = hooks[cursor] as T;

  // 4. setState 함수 생성
  const setState = (nextValue: T | ((prev: T) => T)) => {
    // 함수형 업데이트면 이전 값을 인자로 호출
    const newValue = typeof nextValue === "function" ? (nextValue as (prev: T) => T)(hooks[cursor] as T) : nextValue;

    // Object.is()로 값 비교
    if (!Object.is(hooks[cursor], newValue)) {
      // 값이 다르면 상태 업데이트
      hooks[cursor] = newValue;
      // 재렌더링 예약
      enqueueRender();
    }
  };

  // 5. 훅 커서 증가
  context.hooks.cursor.set(path, cursor + 1);

  // 6. [상태, setter] 반환
  return [state, setState];
};

/**
 * 컴포넌트의 사이드 이펙트를 처리하기 위한 훅입니다.
 * @param effect - 실행할 이펙트 함수. 클린업 함수를 반환할 수 있습니다.
 * @param deps - 의존성 배열. 이 값들이 변경될 때만 이펙트가 다시 실행됩니다.
 */
export const useEffect = (effect: () => (() => void) | void, deps?: unknown[]): void => {
  // 1. 현재 컴포넌트의 경로와 훅 커서 가져오기
  const path = context.hooks.currentPath;
  const cursor = context.hooks.currentCursor;
  const hooks = context.hooks.currentHooks;

  // 2. 이전 훅 정보 가져오기
  const prevHook = hooks[cursor] as EffectHook | undefined;

  // 3. 의존성 배열 비교
  let shouldRun = false;

  if (!prevHook) {
    // 첫 렌더링이면 무조건 실행
    shouldRun = true;
  } else if (deps === undefined) {
    // deps가 없으면 매 렌더링마다 실행
    shouldRun = true;
  } else if (prevHook.deps === null) {
    // 이전에 deps가 없었으면 실행
    shouldRun = true;
  } else {
    // shallowEquals로 비교
    shouldRun = !shallowEquals(prevHook.deps, deps);
  }

  // 4. 새로운 훅 정보 저장
  const newHook: EffectHook = {
    kind: HookTypes.EFFECT,
    deps: deps ?? null,
    cleanup: prevHook?.cleanup ?? null,
    effect,
  };
  hooks[cursor] = newHook;

  // 5. 의존성이 변경되었으면 이펙트 실행 예약
  if (shouldRun) {
    context.effects.queue.push({ path, cursor });
  }

  // 6. 훅 커서 증가
  context.hooks.cursor.set(path, cursor + 1);
};
