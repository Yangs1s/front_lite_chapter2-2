import { context } from "./context";
import { Fragment, HookTypes, NodeTypes, TEXT_ELEMENT } from "./constants";
import { Instance, VNode } from "./types";
import {
  getDomNodes,
  getFirstDomFromChildren,
  insertInstance,
  removeInstance,
  setDomProps,
  updateDomProps,
} from "./dom";
import { createChildPath } from "./elements";
import { isEmptyValue } from "../utils";

/**
 * 인스턴스를 언마운트하고 모든 cleanup 함수를 실행합니다.
 */
function cleanupInstance(instance: Instance | null): void {
  if (!instance) return;

  // 컴포넌트 또는 Fragment의 자식들 정리
  if (instance.kind === NodeTypes.COMPONENT || instance.kind === NodeTypes.FRAGMENT) {
    instance.children.forEach(cleanupInstance);
  }

  // 컴포넌트의 훅 cleanup 실행
  if (instance.kind === NodeTypes.COMPONENT) {
    const hooks = context.hooks.state.get(instance.path);
    if (hooks) {
      for (const hook of hooks) {
        if (hook && hook.kind === HookTypes.EFFECT && hook.cleanup) {
          hook.cleanup();
        }
      }
      // visited에 있으면 다른 컴포넌트가 이 path를 사용하고 있으므로 삭제하지 않음
      if (!context.hooks.visited.has(instance.path)) {
        context.hooks.state.delete(instance.path);
        context.hooks.cursor.delete(instance.path);
      }
    }
  }

  // HOST의 자식들 정리
  if (instance.kind === NodeTypes.HOST) {
    instance.children.forEach(cleanupInstance);
  }
}

/**
 * 이전 인스턴스와 새로운 VNode를 비교하여 DOM을 업데이트하는 재조정 과정을 수행합니다.
 *
 * @param parentDom - 부모 DOM 요소
 * @param instance - 이전 렌더링의 인스턴스
 * @param node - 새로운 VNode
 * @param path - 현재 노드의 고유 경로
 * @returns 업데이트되거나 새로 생성된 인스턴스
 */
export const reconcile = (
  parentDom: HTMLElement,
  instance: Instance | null,
  node: VNode | null,
  path: string,
): Instance | null => {
  // === 1. Unmount ===
  if (node === null) {
    if (instance) {
      cleanupInstance(instance);
      removeInstance(parentDom, instance);
    }
    return null;
  }

  // isEmptyValue로 렌더링 안 할 값 필터링
  if (isEmptyValue(node)) {
    return null;
  }

  // === 2. Mount (새로 생성) ===
  if (!instance) {
    // 2-1. Component
    if (typeof node.type === "function") {
      const componentPath = path;

      // 컴포넌트 스택 추가
      context.hooks.componentStack.push(componentPath);
      // visited에 추가 (cleanupUnusedHooks용)
      context.hooks.visited.add(componentPath);

      try {
        // 컴포넌트 함수 실행
        const childNode = node.type(node.props);

        // 자식 재조정
        const childInstance = reconcile(
          parentDom,
          null,
          childNode,
          createChildPath(componentPath, null, 0, childNode?.type),
        );

        return {
          kind: NodeTypes.COMPONENT,
          dom: null,
          node,
          children: childInstance ? [childInstance] : [],
          key: node.key,
          path: componentPath,
        };
      } finally {
        context.hooks.componentStack.pop();
      }
    }

    // 2-2. TEXT_ELEMENT
    if (node.type === TEXT_ELEMENT) {
      const textNode = document.createTextNode(node.props.nodeValue || "");

      const newInstance: Instance = {
        kind: NodeTypes.TEXT,
        dom: textNode,
        node,
        children: [],
        key: node.key,
        path,
      };

      // insertInstance 사용 (appendChild 대신)
      insertInstance(parentDom, newInstance, null);

      return newInstance;
    }

    // 2-3. Fragment
    if (node.type === Fragment) {
      const children = (node.props.children || [])
        .filter((child) => !isEmptyValue(child)) // 빈 값 필터링
        .map((child, index) =>
          reconcile(parentDom, null, child, createChildPath(path, child?.key, index, child?.type, node.props.children)),
        );

      return {
        kind: NodeTypes.FRAGMENT,
        dom: null,
        node,
        children,
        key: node.key,
        path,
      };
    }

    // 2-4. HOST (일반 DOM)
    const dom = document.createElement(node.type as string);

    // props 설정 (children 제외)
    setDomProps(dom, node.props || {});

    // 자식들 먼저 마운트 (dom 내부에)
    const children = ((node.props && node.props.children) || [])
      .filter((child) => !isEmptyValue(child))
      .map((child, index) =>
        reconcile(
          dom,
          null,
          child,
          createChildPath(path, child?.key, index, child?.type, (node.props && node.props.children) || []),
        ),
      );

    const newInstance: Instance = {
      kind: NodeTypes.HOST,
      dom,
      node,
      children,
      key: node.key,
      path,
    };

    // insertInstance 사용 (appendChild 대신)
    insertInstance(parentDom, newInstance, null);

    return newInstance;
  }

  // === 3. Replace (타입이나 key가 다름) ===
  if (instance.node.type !== node.type || instance.key !== node.key) {
    // cleanup 함수 실행
    cleanupInstance(instance);
    // DOM 제거
    removeInstance(parentDom, instance);
    // 새로 마운트
    return reconcile(parentDom, null, node, path);
  }

  // === 4. Update (같은 타입) ===

  // 4-1. Component 업데이트
  if (typeof node.type === "function") {
    // Hook 상태는 이미 reconcile 전에 이동되었음 (Fragment/HOST UPDATE의 2단계)
    context.hooks.componentStack.push(path); // 새 path 사용
    context.hooks.visited.add(path); // 새 path 사용

    try {
      // 컴포넌트 재실행
      const childNode = node.type(node.props);

      // 자식 재조정
      const oldChildInstance = instance.children[0] || null;
      const childInstance = reconcile(
        parentDom,
        oldChildInstance,
        childNode,
        oldChildInstance?.path || createChildPath(path, null, 0, childNode?.type),
      );

      return {
        ...instance,
        node,
        children: childInstance ? [childInstance] : [],
        path, // path 업데이트
      };
    } finally {
      context.hooks.componentStack.pop();
    }
  }

  // 4-2. TEXT_ELEMENT 업데이트
  if (node.type === TEXT_ELEMENT && instance.dom) {
    const newValue = node.props.nodeValue || "";
    const oldValue = instance.node.props.nodeValue || "";

    // 값이 다르면 업데이트
    if (newValue !== oldValue) {
      (instance.dom as Text).nodeValue = newValue;
    }

    return {
      ...instance,
      node,
    };
  }

  // 4-3. Fragment 업데이트
  if (node.type === Fragment) {
    const newChildren = (node.props.children || []).filter((child) => !isEmptyValue(child));
    const oldChildren = instance.children;

    // key 기반 매칭을 위한 맵 생성
    const oldChildrenByKey = new Map<string, Instance>();
    const oldChildrenByTypeAndIndex = new Map<string | symbol | React.ComponentType, Instance[]>();
    const usedOldChildren = new Set<Instance>();

    for (const oldChild of oldChildren) {
      if (oldChild && oldChild.key !== null) {
        oldChildrenByKey.set(oldChild.key, oldChild);
      } else if (oldChild) {
        // key가 없는 경우 type별로 그룹화
        const type = oldChild.node.type;
        if (!oldChildrenByTypeAndIndex.has(type)) {
          oldChildrenByTypeAndIndex.set(type, []);
        }
        oldChildrenByTypeAndIndex.get(type)!.push(oldChild);
      }
    }

    const typeIndexCounters = new Map<string | symbol | React.ComponentType, number>();

    // 1단계: 매칭 및 path 계산
    const reconcileQueue: Array<{ oldChild: Instance | null; newChild: VNode; childPath: string }> = [];

    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      let oldChild: Instance | null = null;

      // key가 있으면 key로 매칭
      if (newChild?.key !== null && newChild?.key !== undefined) {
        oldChild = oldChildrenByKey.get(newChild.key) || null;
        if (oldChild) {
          usedOldChildren.add(oldChild);
        }
      } else if (newChild) {
        // key가 없으면 같은 type 중에서 아직 사용되지 않은 것 매칭
        const type = newChild.type;
        const sameTypeOldChildren = oldChildrenByTypeAndIndex.get(type) || [];
        const currentTypeIndex = typeIndexCounters.get(type) || 0;

        // 같은 type 중에서 아직 사용되지 않은 첫 번째 것 찾기
        for (let j = currentTypeIndex; j < sameTypeOldChildren.length; j++) {
          const candidate = sameTypeOldChildren[j];
          if (!usedOldChildren.has(candidate)) {
            oldChild = candidate;
            usedOldChildren.add(candidate);
            typeIndexCounters.set(type, j + 1);
            break;
          }
        }
      }

      // key가 있고 oldChild가 있으면 oldChild의 path 유지 (hook 상태 보존)
      // key가 없으면 항상 새로운 path 생성 (인덱스 기반, path 충돌 방지)
      const childPath =
        newChild?.key !== null && newChild?.key !== undefined && oldChild
          ? oldChild.path
          : createChildPath(path, newChild?.key, i, newChild?.type, newChildren);

      reconcileQueue.push({ oldChild, newChild, childPath });
    }

    // 2단계: hook 상태 이동 (COMPONENT UPDATE 케이스, reconcile 전에 먼저 처리)
    for (const { oldChild, childPath } of reconcileQueue) {
      if (oldChild && oldChild.kind === NodeTypes.COMPONENT && oldChild.path !== childPath) {
        const hooks = context.hooks.state.get(oldChild.path);
        if (hooks) {
          context.hooks.state.set(childPath, hooks);
          context.hooks.state.delete(oldChild.path);
        }
        // cursor는 이동하지 않음 - 렌더링 시 0부터 시작해야 함
        // 대신 old path의 cursor는 삭제
        context.hooks.cursor.delete(oldChild.path);
      }
    }

    // 3단계: reconcile
    const children: (Instance | null)[] = [];
    for (const { oldChild, newChild, childPath } of reconcileQueue) {
      const childInstance = reconcile(parentDom, oldChild, newChild, childPath);
      children.push(childInstance);
    }

    // 사용되지 않은 old children 제거
    for (const oldChild of oldChildren) {
      if (oldChild && !usedOldChildren.has(oldChild)) {
        cleanupInstance(oldChild);
        removeInstance(parentDom, oldChild);
      }
    }

    // DOM 순서 조정 (역순으로 순회하여 올바른 위치에 배치)
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (!child) continue;

      // 다음 형제의 첫 DOM을 anchor로 찾기
      const anchor = getFirstDomFromChildren(children.slice(i + 1));

      // DOM 노드를 올바른 위치로 이동
      const childDoms = getDomNodes(child);
      for (const dom of childDoms) {
        if (anchor) {
          // anchor 앞에 삽입
          if (dom.nextSibling !== anchor) {
            parentDom.insertBefore(dom, anchor);
          }
        } else {
          // 마지막에 추가
          if (dom.parentNode !== parentDom || parentDom.lastChild !== dom) {
            parentDom.appendChild(dom);
          }
        }
      }
    }

    return {
      ...instance,
      node,
      children,
    };
  }

  // 4-4. HOST 업데이트
  if (instance.dom) {
    // props 업데이트
    updateDomProps(instance.dom as HTMLElement, instance.node.props || {}, node.props || {});

    const newChildren = ((node.props && node.props.children) || []).filter((child) => !isEmptyValue(child));
    const oldChildren = instance.children;

    // key 기반 매칭을 위한 맵 생성
    const oldChildrenByKey = new Map<string, Instance>();
    const oldChildrenByTypeAndIndex = new Map<string | symbol | React.ComponentType, Instance[]>();
    const usedOldChildren = new Set<Instance>();

    for (const oldChild of oldChildren) {
      if (oldChild && oldChild.key !== null) {
        oldChildrenByKey.set(oldChild.key, oldChild);
      } else if (oldChild) {
        // key가 없는 경우 type별로 그룹화
        const type = oldChild.node.type;
        if (!oldChildrenByTypeAndIndex.has(type)) {
          oldChildrenByTypeAndIndex.set(type, []);
        }
        oldChildrenByTypeAndIndex.get(type)!.push(oldChild);
      }
    }

    const typeIndexCounters = new Map<string | symbol | React.ComponentType, number>();

    // 1단계: 매칭 및 path 계산
    const reconcileQueue: Array<{ oldChild: Instance | null; newChild: VNode; childPath: string }> = [];

    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      let oldChild: Instance | null = null;

      // key가 있으면 key로 매칭
      if (newChild?.key !== null && newChild?.key !== undefined) {
        oldChild = oldChildrenByKey.get(newChild.key) || null;
        if (oldChild) {
          usedOldChildren.add(oldChild);
        }
      } else if (newChild) {
        // key가 없으면 같은 type 중에서 아직 사용되지 않은 것 매칭
        const type = newChild.type;
        const sameTypeOldChildren = oldChildrenByTypeAndIndex.get(type) || [];
        const currentTypeIndex = typeIndexCounters.get(type) || 0;

        // 같은 type 중에서 아직 사용되지 않은 첫 번째 것 찾기
        for (let j = currentTypeIndex; j < sameTypeOldChildren.length; j++) {
          const candidate = sameTypeOldChildren[j];
          if (!usedOldChildren.has(candidate)) {
            oldChild = candidate;
            usedOldChildren.add(candidate);
            typeIndexCounters.set(type, j + 1);
            break;
          }
        }
      }

      // key가 있고 oldChild가 있으면 oldChild의 path 유지 (hook 상태 보존)
      // key가 없으면 항상 새로운 path 생성 (인덱스 기반, path 충돌 방지)
      const childPath =
        newChild?.key !== null && newChild?.key !== undefined && oldChild
          ? oldChild.path
          : createChildPath(path, newChild?.key, i, newChild?.type, newChildren);

      reconcileQueue.push({ oldChild, newChild, childPath });
    }

    // 2단계: hook 상태 이동 (COMPONENT UPDATE 케이스, reconcile 전에 먼저 처리)
    for (const { oldChild, childPath } of reconcileQueue) {
      if (oldChild && oldChild.kind === NodeTypes.COMPONENT && oldChild.path !== childPath) {
        const hooks = context.hooks.state.get(oldChild.path);
        if (hooks) {
          context.hooks.state.set(childPath, hooks);
          context.hooks.state.delete(oldChild.path);
        }
        // cursor는 이동하지 않음 - 렌더링 시 0부터 시작해야 함
        // 대신 old path의 cursor는 삭제
        context.hooks.cursor.delete(oldChild.path);
      }
    }

    // 3단계: reconcile
    const children: (Instance | null)[] = [];
    for (const { oldChild, newChild, childPath } of reconcileQueue) {
      const childInstance = reconcile(instance.dom as HTMLElement, oldChild, newChild, childPath);
      children.push(childInstance);
    }

    // 사용되지 않은 old children 제거
    for (const oldChild of oldChildren) {
      if (oldChild && !usedOldChildren.has(oldChild)) {
        cleanupInstance(oldChild);
        removeInstance(instance.dom as HTMLElement, oldChild);
      }
    }

    // DOM 순서 조정 (역순으로 순회하여 올바른 위치에 배치)
    const parentDomElement = instance.dom as HTMLElement;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (!child) continue;

      // 다음 형제의 첫 DOM을 anchor로 찾기
      const anchor = getFirstDomFromChildren(children.slice(i + 1));

      // DOM 노드를 올바른 위치로 이동
      const childDoms = getDomNodes(child);
      for (const dom of childDoms) {
        if (anchor) {
          // anchor 앞에 삽입
          if (dom.nextSibling !== anchor) {
            parentDomElement.insertBefore(dom, anchor);
          }
        } else {
          // 마지막에 추가
          if (dom.parentNode !== parentDomElement || parentDomElement.lastChild !== dom) {
            parentDomElement.appendChild(dom);
          }
        }
      }
    }

    return {
      ...instance,
      node,
      children,
    };
  }

  return instance;
};
