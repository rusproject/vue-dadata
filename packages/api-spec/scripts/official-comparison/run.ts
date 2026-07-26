import { join } from 'node:path';

import {
  type CompareCommand,
  type UpstreamCompareCommand,
  officialHelp,
  parseOfficialCommand,
} from './cli.ts';
import {
  type PreparedFamilyComparison,
  applyFamilyComparisonSnapshot,
  compareOfficialFamily,
} from './compare.ts';
import { OFFICIAL_FAMILY_CONFIGS } from './family-config.ts';
import { OFFICIAL_SOURCES } from './official-sources.ts';
import { printComparisonError, printFamilyComparison } from './report.ts';
import {
  type FetchedOfficialSource,
  type OfficialFetchFailure,
  type OfficialFetchResult,
  fetchOfficialSource,
} from './upstream/fetch.ts';
import { runOfficialUpstream } from './upstream/run.ts';

export async function runOfficial(args = process.argv.slice(2)): Promise<void> {
  const command = parseOfficialCommand(args);

  if (command.kind === 'help') {
    console.info(officialHelp());
    return;
  }

  const ok =
    command.kind === 'upstream'
      ? await runOfficialUpstream(command)
      : await runOfficialComparison(command);

  if (!ok) {
    process.exitCode = 1;
  }
}

async function runOfficialComparison(options: CompareCommand): Promise<boolean> {
  const upstreamSources =
    options.source === 'upstream' ? await fetchUpstreamComparisonSources(options) : null;

  if (upstreamSources === false) {
    return false;
  }

  const prepared: PreparedFamilyComparison[] = [];
  let failed = false;
  const comparisonArtifactsRoot =
    options.source === 'upstream'
      ? join(options.artifactsRoot, 'comparison')
      : options.artifactsRoot;

  for (const family of options.families) {
    try {
      prepared.push(
        await compareOfficialFamily(OFFICIAL_FAMILY_CONFIGS[family], {
          artifactsRoot: comparisonArtifactsRoot,
          officialSourcePath: comparisonSourcePath(options, upstreamSources, family),
          oasdiffBin: options.oasdiffBin,
        }),
      );
    } catch (error: unknown) {
      printComparisonError(family, error);
      failed = true;
    }
  }

  if (failed) {
    return false;
  }

  const results = prepared.map((comparison) =>
    applyFamilyComparisonSnapshot(comparison, options.accept),
  );

  for (const result of results) {
    printFamilyComparison(result, options.source);
  }

  return results.every((result) => result.snapshot.ok);
}

async function fetchUpstreamComparisonSources(
  options: UpstreamCompareCommand,
): Promise<Map<FetchedOfficialSource['family'], FetchedOfficialSource> | false> {
  const sourceArtifactsRoot = join(options.artifactsRoot, 'source');
  const results = await Promise.all(
    options.families.map((family) =>
      fetchOfficialSource(OFFICIAL_SOURCES[family], sourceArtifactsRoot),
    ),
  );
  const failures = results.filter(isFetchFailure);

  if (failures.length > 0) {
    for (const failure of failures) {
      const http = failure.httpStatus ? `HTTP ${failure.httpStatus} ` : '';

      printComparisonError(
        failure.family,
        `upstream fetch failed (${http}${failure.message})\n${failure.url}`,
      );
    }

    return false;
  }

  return new Map(results.filter(isFetched).map((source) => [source.family, source] as const));
}

function comparisonSourcePath(
  options: CompareCommand,
  upstreamSources: Map<FetchedOfficialSource['family'], FetchedOfficialSource> | null,
  family: FetchedOfficialSource['family'],
): string {
  if (options.source === 'saved') {
    return OFFICIAL_SOURCES[family].localPath;
  }

  const fetched = upstreamSources?.get(family);

  if (!fetched) {
    throw new Error(`No fetched upstream source is available for ${family}.`);
  }

  return fetched.fetchedPath;
}

function isFetched(result: OfficialFetchResult): result is FetchedOfficialSource {
  return result.status === 'fetched';
}

function isFetchFailure(result: OfficialFetchResult): result is OfficialFetchFailure {
  return result.status === 'fetch_failed';
}
