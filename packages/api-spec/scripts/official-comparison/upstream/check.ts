import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { writeText } from '../io.ts';
import { failedCommandMessage, runCommand } from '../process.ts';
import type { FetchedOfficialSource, SourceFetchMetadata } from './fetch.ts';

export interface UpToDateResult {
  family: FetchedOfficialSource['family'];
  fetchedPath: string;
  metadata: SourceFetchMetadata;
  metadataPath: string;
  rawDiffPath: string;
  status: 'up_to_date';
}

export interface ChangedResult {
  family: FetchedOfficialSource['family'];
  fetchedPath: string;
  metadata: SourceFetchMetadata;
  metadataPath: string;
  rawDiffPath: string;
  semanticDiffPath: string;
  status: 'changed_upstream';
}

export type UpstreamComparisonResult = UpToDateResult | ChangedResult;

export function officialSourceChanged(fetched: FetchedOfficialSource): boolean {
  const saved = readFileSync(resolve(fetched.source.localPath), 'utf8');
  const fetchedText = fetched.raw.toString('utf8');

  return normalizeOfficialSource(saved) !== normalizeOfficialSource(fetchedText);
}

export function compareFetchedOfficialSource(
  fetched: FetchedOfficialSource,
  oasdiffBin: string | null,
  artifactsRoot: string,
): UpstreamComparisonResult {
  const savedPath = resolve(fetched.source.localPath);
  const rawDiffPath = resolve(artifactsRoot, `${fetched.family}.source.diff`);
  const semanticDiffPath = resolve(artifactsRoot, `${fetched.family}.semantic-diff.txt`);
  const changed = officialSourceChanged(fetched);

  writeText(rawDiffPath, buildRawDiff(savedPath, fetched.fetchedPath));

  if (!changed) {
    rmSync(semanticDiffPath, { force: true });

    return {
      family: fetched.family,
      fetchedPath: fetched.fetchedPath,
      metadata: fetched.metadata,
      metadataPath: fetched.metadataPath,
      rawDiffPath,
      status: 'up_to_date',
    };
  }

  if (oasdiffBin === null) {
    throw new Error(`Cannot produce the ${fetched.family} semantic diff without oasdiff.`);
  }

  const semanticDiff = runCommand(oasdiffBin, [
    'changelog',
    savedPath,
    fetched.fetchedPath,
    '-f',
    'text',
  ]);

  if (semanticDiff.status !== 0) {
    throw new Error(failedCommandMessage('oasdiff semantic diff failed.', semanticDiff));
  }

  writeText(semanticDiffPath, semanticDiff.stdout);

  return {
    family: fetched.family,
    fetchedPath: fetched.fetchedPath,
    metadata: fetched.metadata,
    metadataPath: fetched.metadataPath,
    rawDiffPath,
    semanticDiffPath,
    status: 'changed_upstream',
  };
}

export function normalizeOfficialSource(source: string): string {
  return source
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/gu, ''))
    .join('\n')
    .trim();
}

function buildRawDiff(savedPath: string, fetchedPath: string): string {
  const result = runCommand('git', [
    'diff',
    '--no-index',
    '--no-ext-diff',
    '--unified=3',
    '--',
    savedPath,
    fetchedPath,
  ]);

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(failedCommandMessage('Raw official-source diff failed.', result));
  }

  return result.stdout;
}
