import type { FamilyComparisonResult } from './compare.ts';

const MAX_DELTA_LINES = 24;

export function printFamilyComparison(
  result: FamilyComparisonResult,
  source: 'saved' | 'upstream',
): void {
  const { snapshot } = result;
  const lineCount = snapshot.currentLineCount;
  const noun = lineCount === 1 ? 'difference' : 'differences';

  if (snapshot.reason === 'matched') {
    console.info(
      `✓ ${result.family}: ${lineCount} accepted ${noun}; ${result.operationCount} operations`,
    );
  } else if (snapshot.reason === 'updated') {
    console.info(
      `✓ ${result.family}: updated baseline to ${lineCount} ${noun} (${formatDeltaCounts(
        snapshot.delta.added.length,
        snapshot.delta.removed.length,
      )})`,
    );
  } else if (snapshot.reason === 'missing') {
    console.error(`✗ ${result.family}: accepted snapshot is missing`);
    console.error(`  ${snapshot.path}`);
  } else {
    console.error(
      `✗ ${result.family}: accepted snapshot mismatch (${formatDeltaCounts(
        snapshot.delta.added.length,
        snapshot.delta.removed.length,
      )})`,
    );
    printSnapshotDelta(snapshot.delta.removed, snapshot.delta.added);

    if (snapshot.delta.added.length === 0 && snapshot.delta.removed.length === 0) {
      console.error('  Snapshot records are equal but their text formatting or order changed.');
    }

    console.error(`  baseline: ${snapshot.path}`);
    if (source === 'saved') {
      console.error(`  accept: pnpm official compare saved --accept --family ${result.family}`);
    } else {
      console.error('  review and save the upstream revision before accepting its differences');
    }
  }

  if (result.artifactsDirectory) {
    console.info(`  artifacts: ${result.artifactsDirectory}`);
  }
}

export function printComparisonError(family: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`✗ ${family}: comparison failed`);
  console.error(indent(message, '  '));
}

function printSnapshotDelta(removed: string[], added: string[]): void {
  const changes = [...removed.map((line) => `- ${line}`), ...added.map((line) => `+ ${line}`)];
  const visible = changes.slice(0, MAX_DELTA_LINES);

  for (const line of visible) {
    console.error(`  ${line}`);
  }

  if (changes.length > visible.length) {
    console.error(`  … ${changes.length - visible.length} more changed snapshot records`);
  }
}

function formatDeltaCounts(added: number, removed: number): string {
  return `+${added}, -${removed}`;
}

function indent(value: string, prefix: string): string {
  return value
    .split(/\r?\n/u)
    .map((line) => `${prefix}${line}`)
    .join('\n');
}
