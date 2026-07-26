// Small deterministic helpers shared by operation inventory and projection.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import type { HttpMethod } from '../openapi.ts';
import type { ComparisonUnit, OperationIdentity, OperationRecord, RefIdentity } from './types.ts';

export function operationKey(path: string, method: HttpMethod): string {
  return `${method}:${path}`;
}

export function formatOperation(operation: OperationRecord): string {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

export function formatOperationIdentity(operation: OperationIdentity): string {
  return `${operation.method.toUpperCase()} ${operation.path}`;
}

export function formatNullable(value: RefIdentity | string): string {
  return value ?? 'null';
}

export function assignOperation(
  pathItem: OpenAPIV3_1.PathItemObject,
  method: HttpMethod,
  operation: OpenAPIV3_1.OperationObject,
): void {
  pathItem[method] = operation;
}

export function slugifyPath(path: string): string {
  return path
    .replace(/^\//u, '')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

export function sortOperationRecords(records: OperationRecord[]): OperationRecord[] {
  return [...records].sort(compareOperationRecords);
}

export function sortComparisonUnits(units: ComparisonUnit[]): ComparisonUnit[] {
  return [...units].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.method.localeCompare(right.method) ||
      left.kind.localeCompare(right.kind),
  );
}

export function compareOperationRecords(left: OperationRecord, right: OperationRecord): number {
  return left.path.localeCompare(right.path) || left.method.localeCompare(right.method);
}
