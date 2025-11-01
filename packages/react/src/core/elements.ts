/* eslint-disable @typescript-eslint/no-explicit-any */
import { isEmptyValue } from "../utils";
import { VNode } from "./types";
import { Fragment, TEXT_ELEMENT } from "./constants";

/**
 * 주어진 노드를 VNode 형식으로 정규화합니다.
 * null, undefined, boolean, 배열, 원시 타입 등을 처리하여 일관된 VNode 구조를 보장합니다.
 */
export const normalizeNode = (node: any): VNode | null => {
  // 여기를 구현하세요.
  if (isEmptyValue(node)) return null;

  if (Array.isArray(node)) {
    return {
      type: Fragment,
      props: { children: node.map(normalizeNode).filter(Boolean) as VNode[] },
      key: null,
    };
  }

  if (typeof node === "string") {
    // 공백만 있는 문자열은 null 반환
    if (node.trim() === "") {
      return null;
    }
    return createTextElement(node);
  }

  if (typeof node === "number") {
    return createTextElement(node);
  }

  return node;
};

/**
 * 텍스트 노드를 위한 VNode를 생성합니다.
 */
const createTextElement = (node: string | number): VNode => {
  return {
    type: TEXT_ELEMENT,
    props: { children: [], nodeValue: String(node) },
    key: null,
  };
};

/**
 * JSX로부터 전달된 인자를 VNode 객체로 변환합니다.
 * 이 함수는 JSX 변환기에 의해 호출됩니다. (예: Babel, TypeScript)
 */
export const createElement = (
  type: string | symbol | React.ComponentType<any>,
  originProps?: Record<string, any> | null,
  ...rawChildren: any[]
) => {
  const { key = null, ...props } = originProps || {};

  // Fragment를 재귀적으로 평탄화
  const flatten = (child: any): VNode[] => {
    const normalized = normalizeNode(child);
    if (!normalized) return [];

    // Fragment면 재귀적으로 children 풀기
    if (normalized.type === Fragment) {
      return (normalized.props.children || []).flatMap(flatten);
    }

    return [normalized];
  };

  const children = rawChildren.flatMap(flatten);

  return {
    type,
    props: {
      ...props,
      ...(children.length > 0 ? { children } : {}),
    },
    key,
  };
};

/**
 * 부모 경로와 자식의 key/index를 기반으로 고유한 경로를 생성합니다.
 * 이는 훅의 상태를 유지하고 Reconciliation에서 컴포넌트를 식별하는 데 사용됩니다.
 */
export const createChildPath = (
  parentPath: string,
  key: string | null,
  index: number,
  nodeType?: string | symbol | React.ComponentType,
  siblings?: VNode[],
): string => {
  // 여기를 구현하세요.

  const prefix = typeof nodeType === "function" ? "c" : "i";
  // key가 있는 경우
  if (key !== null) {
    let identifier = `k-${key}`;
    // siblings가 있으면 중복 key 확인
    if (siblings) {
      // 현재 index 이전에 같은 key가 몇 번 나왔는지 세기
      let duplicateCount = 0;
      for (let i = 0; i < index; i++) {
        if (siblings[i]?.key === key) {
          duplicateCount++;
        }
      }
      if (duplicateCount > 0) {
        identifier = `k-${key}-${duplicateCount}`;
      }
    }
    return `${parentPath}.${prefix}${identifier}`;
  }
  // key가 없는 경우 index 사용
  return `${parentPath}.${prefix}${index}`;
};
