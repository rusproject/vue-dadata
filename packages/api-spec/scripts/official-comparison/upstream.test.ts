import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import {
  compareFetchedOfficialSource,
  normalizeOfficialSource,
  officialSourceChanged,
} from './upstream/check.ts';
import { type FetchedOfficialSource, promoteFetchedOfficialSources } from './upstream/fetch.ts';

describe('official upstream source handling', () => {
  it('ignores line-ending and trailing-whitespace noise when checking revisions', () => {
    assert.equal(normalizeOfficialSource('openapi: 3.0.0  \r\ninfo:\r\n'), 'openapi: 3.0.0\ninfo:');
  });

  it('uses the fetched file name and removes a stale semantic diff for an unchanged source', () => {
    withTemporaryDirectory((directory) => {
      const savedPath = join(directory, 'saved.yml');
      const fetchedPath = join(directory, 'cleaner.yml');
      const semanticDiffPath = join(directory, 'cleaner.semantic-diff.txt');
      const fetched = fetchedSource(savedPath, fetchedPath, Buffer.from('openapi: 3.0.0  \r\n'));

      writeFileSync(savedPath, 'openapi: 3.0.0\n', 'utf8');
      writeFileSync(fetchedPath, fetched.raw);
      writeFileSync(semanticDiffPath, 'stale', 'utf8');

      assert.equal(officialSourceChanged(fetched), false);

      const result = compareFetchedOfficialSource(fetched, null, directory);

      assert.equal(result.status, 'up_to_date');
      assert.equal(result.fetchedPath, fetchedPath);
      assert.equal(result.rawDiffPath, join(directory, 'cleaner.source.diff'));
      assert.equal(existsSync(semanticDiffPath), false);
    });
  });

  it('promotes the exact fetched bytes to every selected saved source', () => {
    withTemporaryDirectory((directory) => {
      const firstSaved = join(directory, 'first.yml');
      const secondSaved = join(directory, 'second.yml');
      const firstRaw = Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a]);
      const secondRaw = Buffer.from('b\n', 'utf8');
      const fetched = [
        fetchedSource(firstSaved, join(directory, 'cleaner.yml'), firstRaw),
        fetchedSource(secondSaved, join(directory, 'profile.yml'), secondRaw, 'profile'),
      ];

      writeFileSync(firstSaved, 'old first\n', 'utf8');
      writeFileSync(secondSaved, 'old second\n', 'utf8');

      promoteFetchedOfficialSources(fetched);

      assert.deepEqual(readFileSync(firstSaved), firstRaw);
      assert.deepEqual(readFileSync(secondSaved), secondRaw);
    });
  });
});

function fetchedSource(
  savedPath: string,
  fetchedPath: string,
  raw: Buffer,
  family: FetchedOfficialSource['family'] = 'cleaner',
): FetchedOfficialSource {
  return {
    family,
    fetchedPath,
    metadata: {
      etag: null,
      httpStatus: 200,
      lastModified: null,
      fetchedBytes: raw.byteLength,
      fetchedSha256: 'fetched',
      savedBytes: 0,
      savedSha256: 'saved',
      url: `https://example.test/${family}.yml`,
    },
    metadataPath: join(dirname(fetchedPath), `${family}.metadata.json`),
    raw,
    source: {
      family,
      localPath: savedPath,
      url: `https://example.test/${family}.yml`,
    },
    status: 'fetched',
  };
}

function withTemporaryDirectory(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'dadata-upstream-test-'));

  try {
    run(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
