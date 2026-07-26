import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { readText, writeText } from './io.ts';

export interface SnapshotDelta {
  added: string[];
  removed: string[];
}

export interface SnapshotResult {
  currentLineCount: number;
  delta: SnapshotDelta;
  expectedLineCount: number | null;
  mode: 'check' | 'update';
  ok: boolean;
  path: string;
  reason: 'matched' | 'missing' | 'mismatched' | 'updated';
}

export function applySnapshot(
  current: string,
  configuredPath: string,
  update: boolean,
): SnapshotResult {
  const path = resolve(configuredPath);
  const currentLines = snapshotLines(current);

  if (update) {
    const existed = existsSync(path);
    const expected = existed ? readText(path) : '';

    mkdirSync(dirname(path), { recursive: true });
    writeText(path, current);

    return {
      currentLineCount: currentLines.length,
      delta: lineDelta(expected, current),
      expectedLineCount: existed ? snapshotLines(expected).length : null,
      mode: 'update',
      ok: true,
      path,
      reason: 'updated',
    };
  }

  if (!existsSync(path)) {
    return {
      currentLineCount: currentLines.length,
      delta: { added: currentLines, removed: [] },
      expectedLineCount: null,
      mode: 'check',
      ok: false,
      path,
      reason: 'missing',
    };
  }

  const expected = readText(path);
  const ok = expected === current;

  return {
    currentLineCount: currentLines.length,
    delta: ok ? { added: [], removed: [] } : lineDelta(expected, current),
    expectedLineCount: snapshotLines(expected).length,
    mode: 'check',
    ok,
    path,
    reason: ok ? 'matched' : 'mismatched',
  };
}

/** Compares sorted snapshot records while preserving duplicate lines if they ever occur. */
export function lineDelta(expected: string, current: string): SnapshotDelta {
  const expectedLines = snapshotLines(expected).sort(compareLines);
  const currentLines = snapshotLines(current).sort(compareLines);
  const added: string[] = [];
  const removed: string[] = [];
  let expectedIndex = 0;
  let currentIndex = 0;

  while (expectedIndex < expectedLines.length || currentIndex < currentLines.length) {
    const expectedLine = expectedLines[expectedIndex];
    const currentLine = currentLines[currentIndex];

    if (expectedLine === undefined) {
      added.push(currentLine as string);
      currentIndex += 1;
      continue;
    }

    if (currentLine === undefined) {
      removed.push(expectedLine);
      expectedIndex += 1;
      continue;
    }

    const comparison = compareLines(expectedLine, currentLine);

    if (comparison === 0) {
      expectedIndex += 1;
      currentIndex += 1;
    } else if (comparison < 0) {
      removed.push(expectedLine);
      expectedIndex += 1;
    } else {
      added.push(currentLine);
      currentIndex += 1;
    }
  }

  return { added, removed };
}

function snapshotLines(value: string): string[] {
  return value.split(/\r?\n/u).filter((line) => line.length > 0);
}

function compareLines(left: string, right: string): number {
  return left.localeCompare(right);
}
