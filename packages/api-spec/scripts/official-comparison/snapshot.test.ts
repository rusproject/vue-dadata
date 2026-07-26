import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { applySnapshot, lineDelta } from './snapshot.ts';

describe('lineDelta', () => {
  it('reports new and disappeared records independently of snapshot order', () => {
    assert.deepEqual(lineDelta('beta\nalpha\nold\n', 'alpha\nbeta\nnew\n'), {
      added: ['new'],
      removed: ['old'],
    });
  });

  it('preserves duplicate records instead of treating snapshots as sets', () => {
    assert.deepEqual(lineDelta('same\n', 'same\nsame\n'), {
      added: ['same'],
      removed: [],
    });
  });
});

describe('applySnapshot', () => {
  it('accepts an exact snapshot and rejects a changed snapshot', () => {
    withTemporaryDirectory((directory) => {
      const path = join(directory, 'accepted.txt');
      writeFileSync(path, 'accepted\n', 'utf8');

      const matched = applySnapshot('accepted\n', path, false);
      assert.equal(matched.ok, true);
      assert.equal(matched.reason, 'matched');
      assert.deepEqual(matched.delta, { added: [], removed: [] });

      const mismatched = applySnapshot('new\n', path, false);
      assert.equal(mismatched.ok, false);
      assert.equal(mismatched.reason, 'mismatched');
      assert.deepEqual(mismatched.delta, {
        added: ['new'],
        removed: ['accepted'],
      });
    });
  });

  it('describes a missing snapshot without creating it in check mode', () => {
    withTemporaryDirectory((directory) => {
      const path = join(directory, 'missing.txt');
      const result = applySnapshot('new\n', path, false);

      assert.equal(result.ok, false);
      assert.equal(result.reason, 'missing');
      assert.equal(result.expectedLineCount, null);
      assert.deepEqual(result.delta, { added: ['new'], removed: [] });
    });
  });

  it('distinguishes creating a baseline from replacing an existing one', () => {
    withTemporaryDirectory((directory) => {
      const path = join(directory, 'nested', 'accepted.txt');
      const created = applySnapshot('first\n', path, true);

      assert.equal(created.expectedLineCount, null);
      assert.deepEqual(created.delta, { added: ['first'], removed: [] });
      assert.equal(readFileSync(path, 'utf8'), 'first\n');

      const replaced = applySnapshot('second\n', path, true);
      assert.equal(replaced.expectedLineCount, 1);
      assert.deepEqual(replaced.delta, {
        added: ['second'],
        removed: ['first'],
      });
      assert.equal(readFileSync(path, 'utf8'), 'second\n');
    });
  });
});

function withTemporaryDirectory(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'dadata-snapshot-test-'));

  try {
    run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
