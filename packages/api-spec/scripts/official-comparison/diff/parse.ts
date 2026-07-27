// Adapts version-pinned oasdiff JSON into stable, fail-closed difference records.
import {
  assertEmptyCollection,
  assertKnownKeys,
  getOptionalRecord,
  requireCollectionItems,
  requireRecord,
  sortedRecordEntries,
  validateIgnoredRecordDiffs,
} from './oasdiff-shape.ts';
import { collectOperationDiffUnits } from './operation-diff.ts';
import { sortDiffUnits } from './render.ts';
import type { DiffUnit } from './types.ts';

const IGNORED_ROOT_DIFF_KEYS = new Set([
  'components',
  'extensions',
  'externalDocs',
  'info',
  'tags',
]);
const IGNORED_PATH_DIFF_KEYS = new Set(['description', 'extensions', 'summary']);
const IGNORED_OPERATION_DIFF_KEYS = new Set([
  'description',
  'extensions',
  'externalDocs',
  'operationID',
  'summary',
  'tags',
]);

export function buildDiffUnits(diff: Record<string, unknown>): DiffUnit[] {
  const units: DiffUnit[] = [];

  assertKnownKeys(diff, new Set(['paths', ...IGNORED_ROOT_DIFF_KEYS]), []);
  validateIgnoredRecordDiffs(diff, IGNORED_ROOT_DIFF_KEYS, []);

  const pathsDiff = getOptionalRecord(diff, 'paths', ['paths']);

  if (!pathsDiff) {
    return units;
  }

  assertKnownKeys(pathsDiff, new Set(['added', 'deleted', 'modified']), ['paths']);
  assertEmptyCollection(pathsDiff.added, ['paths', 'added'], 'added paths');
  assertEmptyCollection(pathsDiff.deleted, ['paths', 'deleted'], 'deleted paths');

  const paths = getOptionalRecord(pathsDiff, 'modified', ['paths', 'modified']);

  if (!paths) {
    return units;
  }

  for (const [path, pathDiffValue] of sortedRecordEntries(paths)) {
    collectPathUnits(path, pathDiffValue, units);
  }

  return sortDiffUnits(units);
}

function collectPathUnits(path: string, value: unknown, units: DiffUnit[]): void {
  const pathDiffPath = ['paths', 'modified', path];
  const pathDiff = requireRecord(value, pathDiffPath);

  assertKnownKeys(pathDiff, new Set(['operations', ...IGNORED_PATH_DIFF_KEYS]), pathDiffPath);
  validateIgnoredRecordDiffs(pathDiff, IGNORED_PATH_DIFF_KEYS, pathDiffPath);

  const operationsPath = [...pathDiffPath, 'operations'];
  const operations = getOptionalRecord(pathDiff, 'operations', operationsPath);

  if (!operations) {
    return;
  }

  assertKnownKeys(operations, new Set(['added', 'deleted', 'modified']), operationsPath);
  collectOperationPresenceUnits(operations.added, path, units, 'operation-added', [
    ...operationsPath,
    'added',
  ]);
  collectOperationPresenceUnits(operations.deleted, path, units, 'operation-deleted', [
    ...operationsPath,
    'deleted',
  ]);

  const modifiedPath = [...operationsPath, 'modified'];
  const modifiedOperations = getOptionalRecord(operations, 'modified', modifiedPath);

  if (!modifiedOperations) {
    return;
  }

  for (const [method, operationDiffValue] of sortedRecordEntries(modifiedOperations)) {
    const diffPath = [...modifiedPath, method];
    const operationDiff = requireRecord(operationDiffValue, diffPath);

    assertKnownKeys(
      operationDiff,
      new Set(['requestBody', 'responses', ...IGNORED_OPERATION_DIFF_KEYS]),
      diffPath,
    );
    validateIgnoredRecordDiffs(operationDiff, IGNORED_OPERATION_DIFF_KEYS, diffPath);
    collectOperationDiffUnits(path, method, operationDiff, units, diffPath);
  }
}

function collectOperationPresenceUnits(
  value: unknown,
  path: string,
  units: DiffUnit[],
  kind: string,
  diffPath: string[],
): void {
  for (const method of requireCollectionItems(value, diffPath)) {
    units.push({
      kind,
      location: '<operation>',
      method: String(method).toUpperCase(),
      path,
      scope: 'operation',
    });
  }
}
