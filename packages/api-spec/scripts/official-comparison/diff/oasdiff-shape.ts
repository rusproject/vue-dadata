// Strict readers for the subset of oasdiff JSON understood by this comparator.
import { isRecord } from '../io.ts';
import { escapeJsonPointerSegment } from '../json-pointer.ts';

export function sortedRecordEntries(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

export function getOptionalRecord(
  parent: Record<string, unknown>,
  key: string,
  diffPath: string[],
): Record<string, unknown> | null {
  return key in parent ? requireRecord(parent[key], diffPath) : null;
}

export function requireRecord(value: unknown, diffPath: string[]): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid oasdiff structure at ${formatDiffPath(diffPath)}: expected an object.`,
    );
  }

  return value;
}

export function requireCollectionItems(value: unknown, diffPath: string[]): unknown[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid oasdiff collection at ${formatDiffPath(diffPath)}: expected an array.`,
    );
  }

  return value;
}

export function assertEmptyCollection(
  value: unknown,
  diffPath: string[],
  description: string,
): void {
  const items = requireCollectionItems(value, diffPath);

  if (items.length > 0) {
    throw new Error(
      `Unsupported ${description} at ${formatDiffPath(diffPath)}: ${JSON.stringify(items)}.`,
    );
  }
}

/** Fails closed when oasdiff adds a field the adapter does not understand. */
export function assertKnownKeys(
  value: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  diffPath: string[],
): void {
  const unknownKeys = Object.keys(value)
    .filter((key) => !knownKeys.has(key))
    .sort();

  if (unknownKeys.length > 0) {
    throw new Error(
      `Unsupported oasdiff key(s) at ${formatDiffPath(diffPath)}: ${unknownKeys.join(', ')}.`,
    );
  }
}

/** Accepts known annotation changes but still verifies their expected object shape. */
export function validateIgnoredRecordDiffs(
  value: Record<string, unknown>,
  ignoredKeys: ReadonlySet<string>,
  diffPath: string[],
): void {
  for (const key of ignoredKeys) {
    if (key in value) {
      requireRecord(value[key], [...diffPath, key]);
    }
  }
}

export function getOptionalTrueMarker(
  value: Record<string, unknown>,
  key: string,
  diffPath: string[],
): boolean {
  if (!(key in value)) {
    return false;
  }

  if (value[key] !== true) {
    throw new Error(
      `Invalid oasdiff marker at ${formatDiffPath(diffPath)}: expected true, received ${JSON.stringify(value[key])}.`,
    );
  }

  return true;
}

export function formatDiffPath(diffPath: string[]): string {
  return `/${diffPath.map(escapeJsonPointerSegment).join('/')}`;
}
