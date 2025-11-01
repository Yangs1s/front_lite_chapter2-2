/* eslint-disable @typescript-eslint/no-explicit-any */
import { NodeTypes } from "./constants";
import { Instance } from "./types";

/**
 * DOM 요소에 속성(props)을 설정합니다.
 * 이벤트 핸들러, 스타일, className 등 다양한 속성을 처리해야 합니다.
 */
// 단일 속성을 설정하는 helper 함수

function setDomProp(dom: HTMLElement, key: string, value: any) {
  if (key.startsWith("on")) {
    const eventType = key.toLowerCase().substring(2);
    dom.addEventListener(eventType, value);
  } else if (key === "className") {
    dom.className = value || "";
  } else if (key === "style") {
    if (typeof value === "object") {
      Object.assign(dom.style, value);
    }
  } else if (key in dom) {
    // boolean 속성이나 DOM property인 경우 (checked, disabled, value 등)
    (dom as any)[key] = value;
  } else {
    // 일반 HTML 속성
    dom.setAttribute(key, value);
  }
}

export const setDomProps = (dom: HTMLElement, props: Record<string, any>): void => {
  // 여기를 구현하세요.
  for (const key in props) {
    if (key === "children") continue;
    setDomProp(dom, key, props[key]);
  }
};

/**
 * 이전 속성과 새로운 속성을 비교하여 DOM 요소의 속성을 업데이트합니다.
 * 변경된 속성만 효율적으로 DOM에 반영해야 합니다.
 */
export const updateDomProps = (
  dom: HTMLElement,
  prevProps: Record<string, any> = {},
  nextProps: Record<string, any> = {},
): void => {
  // 1. 제거된 속성 처리
  for (const key in prevProps) {
    if (key === "children") continue;

    if (!(key in nextProps)) {
      // 이벤트 핸들러 제거
      if (key.startsWith("on")) {
        const eventType = key.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[key]);
      } else if (key === "className") {
        dom.className = "";
      } else if (key === "style") {
        dom.removeAttribute("style");
      } else if (key in dom) {
        // DOM property 제거
        (dom as any)[key] = "";
      } else {
        dom.removeAttribute(key);
      }
    }
  }

  // 2. 변경되거나 추가된 속성 처리
  for (const key in nextProps) {
    if (key === "children") continue;

    if (prevProps[key] !== nextProps[key]) {
      // 이벤트 핸들러는 이전 것을 제거하고 새로 추가
      if (key.startsWith("on") && prevProps[key]) {
        const eventType = key.toLowerCase().substring(2);
        dom.removeEventListener(eventType, prevProps[key]);
      }
      setDomProp(dom, key, nextProps[key]);
    }
  }
};

/**
 * 주어진 인스턴스에서 실제 DOM 노드(들)를 재귀적으로 찾아 배열로 반환합니다.
 * Fragment나 컴포넌트 인스턴스는 여러 개의 DOM 노드를 가질 수 있습니다.
 */
export const getDomNodes = (instance: Instance | null): (HTMLElement | Text)[] => {
  // 여기를 구현하세요.

  if (!instance) return [];
  if (instance.dom) {
    return [instance.dom];
  }

  // Fragment나 컴포넌트인 경우
  const result: (HTMLElement | Text)[] = [];

  for (const child of instance.children) {
    // 재귀, spread 평탄화
    result.push(...getDomNodes(child));
  }
  return result;
};

/**
 * 주어진 인스턴스에서 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDom = (instance: Instance | null): HTMLElement | Text | null => {
  // 여기를 구현하세요.
  if (!instance) return null;
  if (instance.dom) {
    return instance.dom;
  }
  return getFirstDomFromChildren(instance.children);
};

/**
 * 자식 인스턴스들로부터 첫 번째 실제 DOM 노드를 찾습니다.
 */
export const getFirstDomFromChildren = (children: (Instance | null)[]): HTMLElement | Text | null => {
  // 여기를 구현하세요.
  for (const child of children) {
    const dom = getFirstDom(child);
    if (dom) {
      return dom;
    }
  }
  return null;
};

/**
 * 인스턴스를 부모 DOM에 삽입합니다.
 * anchor 노드가 주어지면 그 앞에 삽입하여 순서를 보장합니다.
 */
export const insertInstance = (
  parentDom: HTMLElement,
  instance: Instance | null,
  anchor: HTMLElement | Text | null = null,
): void => {
  // 여기를 구현하세요.
  if (!instance) return;
  if (instance.kind === NodeTypes.FRAGMENT) {
    instance.children.forEach((child) => {
      insertInstance(parentDom, child, anchor);
    });
    return;
  }
  if (instance.kind === NodeTypes.COMPONENT) {
    instance.children.forEach((child) => {
      insertInstance(parentDom, child, anchor);
    });
    return;
  }
  const dom = instance.dom;
  if (dom) {
    if (anchor) {
      parentDom.insertBefore(dom, anchor);
    } else {
      parentDom.appendChild(dom);
    }
  }
};

/**
 * 부모 DOM에서 인스턴스에 해당하는 모든 DOM 노드를 제거합니다.
 */
export const removeInstance = (parentDom: HTMLElement, instance: Instance | null): void => {
  // 여기를 구현하세요.

  if (!instance) {
    return;
  }
  if (instance.kind === NodeTypes.FRAGMENT) {
    instance.children.forEach((child) => {
      removeInstance(parentDom, child);
    });
    return;
  }
  if (instance.kind === NodeTypes.COMPONENT) {
    instance.children.forEach((child) => {
      removeInstance(parentDom, child);
    });
    return;
  }
  if (instance.dom && instance.dom.parentNode) {
    // 실제 부모 노드를 사용하여 제거
    instance.dom.parentNode.removeChild(instance.dom);
  }
};
