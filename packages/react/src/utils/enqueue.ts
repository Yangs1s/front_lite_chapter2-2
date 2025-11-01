import type { AnyFunction } from "../types";

/**
 * 작업을 마이크로태스크 큐에 추가하여 비동기적으로 실행합니다.
 * 브라우저의 `queueMicrotask` 또는 `Promise.resolve().then()`을 사용합니다.
 */
export const enqueue = (callback: () => void) => {
  // 여기를 구현하세요.
  queueMicrotask(callback);
};

/**
 * 함수가 여러 번 호출되더라도 실제 실행은 한 번만 스케줄링되도록 보장하는 고차 함수입니다.
 * 렌더링이나 이펙트 실행과 같은 작업의 중복을 방지하는 데 사용됩니다.
 */
export const withEnqueue = (fn: AnyFunction) => {
  // 여기를 구현하세요.
  // scheduled 플래그를 사용하여 fn이 한 번만 예약되도록 구현합니다.
  let scheduled = false;

  return () => {
    if (scheduled) return;

    scheduled = true;
    enqueue(() => {
      scheduled = false;
      fn();
    });
  };
};
