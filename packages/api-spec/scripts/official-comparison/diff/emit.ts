// Turns validated oasdiff fragments into normalized DiffUnit records.
import {
  assertKnownKeys,
  formatDiffPath,
  requireCollectionItems,
  requireRecord,
} from './oasdiff-shape.ts';
import type { DiffUnit, UnitContext } from './types.ts';

export function collectFromToUnit(
  value: unknown,
  context: UnitContext,
  kind: string,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const valueDiff = requireRecord(value, diffPath);

  assertKnownKeys(valueDiff, new Set(['from', 'to']), diffPath);

  if (!('from' in valueDiff) || !('to' in valueDiff)) {
    throw new Error(
      `Invalid oasdiff value diff at ${formatDiffPath(diffPath)}: expected both "from" and "to".`,
    );
  }

  pushUnit(context, kind, location, {
    from: valueDiff.from,
    to: valueDiff.to,
  });
}

export function collectAddedRemovedUnit(
  value: unknown,
  context: UnitContext,
  kind: string,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const collectionDiff = requireRecord(value, diffPath);

  assertKnownKeys(collectionDiff, new Set(['added', 'deleted']), diffPath);

  const added = requireCollectionItems(collectionDiff.added, [...diffPath, 'added']);
  const removed = requireCollectionItems(collectionDiff.deleted, [...diffPath, 'deleted']);

  if (added.length === 0 && removed.length === 0) {
    throw new Error(
      `Invalid oasdiff collection diff at ${formatDiffPath(diffPath)}: expected added or deleted items.`,
    );
  }

  pushUnit(context, kind, location, { added, removed });
}

export function collectTrueMarkerUnit(
  value: unknown,
  context: UnitContext,
  kind: string,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  if (value !== true) {
    throw new Error(
      `Invalid oasdiff marker at ${formatDiffPath(diffPath)}: expected true, received ${JSON.stringify(value)}.`,
    );
  }

  pushUnit(context, kind, location);
}

export function pushUnit(
  context: UnitContext,
  kind: string,
  location: string[],
  extra: Partial<Pick<DiffUnit, 'added' | 'from' | 'removed' | 'to'>> = {},
): void {
  const unit: DiffUnit = {
    kind,
    location: location.length === 0 ? '<schema>' : location.join('/'),
    mediaType: context.mediaType,
    method: context.method.toUpperCase(),
    path: context.path,
    scope: context.scope,
    status: context.status,
  };

  Object.assign(unit, extra);
  context.units.push(unit);
}
