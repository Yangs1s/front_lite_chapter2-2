import { context } from "./context";
// import { getDomNodes, insertInstance } from "./dom";
import { reconcile } from "./reconciler";
import { cleanupUnusedHooks } from "./hooks";
import { enqueue, withEnqueue } from "../utils";

/**
 * 루트 컴포넌트의 렌더링을 수행하는 함수입니다.
 * `enqueueRender`에 의해 스케줄링되어 호출됩니다.
 */
export const render = (): void => {
  const { container, node } = context.root;

  if (!container) return;

  // 1. 훅 커서 초기화 (새 렌더링 시작)
  for (const path of context.hooks.cursor.keys()) {
    context.hooks.cursor.set(path, 0);
  }

  // 2. visited Set 초기화
  context.hooks.visited.clear();

  // 3. reconcile 함수를 호출하여 루트 노드를 재조정
  const newInstance = reconcile(container, context.root.instance, node, "0");
  context.root.instance = newInstance;

  // 4. 사용되지 않은 훅들을 정리
  cleanupUnusedHooks();

  // 5. 예약된 이펙트들을 비동기로 실행
  const effectsToRun = [...context.effects.queue];
  context.effects.queue.length = 0;

  if (effectsToRun.length > 0) {
    enqueue(() => {
      for (const { path, cursor } of effectsToRun) {
        const hooks = context.hooks.state.get(path);
        if (!hooks) continue;

        const hook = hooks[cursor];
        if (!hook || hook.kind !== "effect") continue;

        // 이전 cleanup 함수 실행
        if (hook.cleanup) {
          hook.cleanup();
        }

        // 새 이펙트 실행
        const cleanup = hook.effect();
        if (typeof cleanup === "function") {
          hook.cleanup = cleanup;
        } else {
          hook.cleanup = null;
        }
      }
    });
  }
};

/**
 * `render` 함수를 마이크로태스크 큐에 추가하여 중복 실행을 방지합니다.
 */
export const enqueueRender = withEnqueue(render);
