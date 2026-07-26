import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { writeJson } from '../io.ts';
import {
  type OfficialFamily,
  type OfficialSource,
  officialSourceFileName,
} from '../official-sources.ts';

export interface SourceFetchMetadata {
  etag: string | null;
  httpStatus: number;
  lastModified: string | null;
  fetchedBytes: number;
  fetchedSha256: string;
  savedBytes: number;
  savedSha256: string;
  url: string;
}

export interface FetchedOfficialSource {
  family: OfficialFamily;
  fetchedPath: string;
  metadata: SourceFetchMetadata;
  metadataPath: string;
  raw: Buffer;
  source: OfficialSource;
  status: 'fetched';
}

export interface OfficialFetchFailure {
  family: OfficialFamily;
  httpStatus?: number;
  message: string;
  status: 'fetch_failed';
  url: string;
}

export type OfficialFetchResult = FetchedOfficialSource | OfficialFetchFailure;

export async function fetchOfficialSource(
  source: OfficialSource,
  artifactsRoot: string,
): Promise<OfficialFetchResult> {
  const fetchedPath = resolve(artifactsRoot, officialSourceFileName(source));
  const metadataPath = resolve(artifactsRoot, `${source.family}.metadata.json`);

  mkdirSync(resolve(artifactsRoot), { recursive: true });
  rmSync(fetchedPath, { force: true });
  rmSync(metadataPath, { force: true });

  let response: Response;

  try {
    response = await fetch(source.url, {
      headers: {
        Accept: 'application/yaml, text/yaml, text/plain;q=0.9, */*;q=0.8',
        'User-Agent': 'dadata-sdk official spec checker',
      },
    });
  } catch (error: unknown) {
    return fetchFailure(source, error instanceof Error ? error.message : String(error));
  }

  if (!response.ok) {
    return fetchFailure(source, response.statusText || 'HTTP request failed', response.status);
  }

  const raw = Buffer.from(await response.arrayBuffer());
  const savedRaw = readFileSync(resolve(source.localPath));
  const metadata: SourceFetchMetadata = {
    etag: response.headers.get('etag'),
    httpStatus: response.status,
    lastModified: response.headers.get('last-modified'),
    fetchedBytes: raw.byteLength,
    fetchedSha256: sha256(raw),
    savedBytes: savedRaw.byteLength,
    savedSha256: sha256(savedRaw),
    url: source.url,
  };

  writeFileSync(fetchedPath, raw);
  writeJson(metadataPath, {
    checkedAt: new Date().toISOString(),
    family: source.family,
    ...metadata,
  });

  return {
    family: source.family,
    fetchedPath,
    metadata,
    metadataPath,
    raw,
    source,
    status: 'fetched',
  };
}

export function promoteFetchedOfficialSources(sources: FetchedOfficialSource[]): void {
  for (const fetched of sources) {
    writeFileSync(resolve(fetched.source.localPath), fetched.raw);
  }
}

function fetchFailure(
  source: OfficialSource,
  message: string,
  httpStatus?: number,
): OfficialFetchFailure {
  return {
    family: source.family,
    ...(httpStatus === undefined ? {} : { httpStatus }),
    message,
    status: 'fetch_failed',
    url: source.url,
  };
}

function sha256(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
