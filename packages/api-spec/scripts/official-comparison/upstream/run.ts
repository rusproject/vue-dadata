import { resolveOasdiffBin } from '../diff/oasdiff.ts';
import { OFFICIAL_SOURCES, type OfficialFamily } from '../official-sources.ts';
import {
  type UpstreamComparisonResult,
  compareFetchedOfficialSource,
  officialSourceChanged,
} from './check.ts';
import {
  type FetchedOfficialSource,
  type OfficialFetchFailure,
  type OfficialFetchResult,
  fetchOfficialSource,
  promoteFetchedOfficialSources,
} from './fetch.ts';
import { printUpstreamFetchFailures, printUpstreamReport, printUpstreamUpdate } from './report.ts';

export interface UpstreamRunOptions {
  action: 'check' | 'update';
  artifactsRoot: string;
  families: OfficialFamily[];
  oasdiffBin: string | null;
}

export async function runOfficialUpstream(options: UpstreamRunOptions): Promise<boolean> {
  const fetchResults = await Promise.all(
    options.families.map((family) =>
      fetchOfficialSource(OFFICIAL_SOURCES[family], options.artifactsRoot),
    ),
  );
  const fetched = fetchResults.filter(isFetched);
  const failures = fetchResults.filter(isFetchFailure);

  if (failures.length > 0) {
    printUpstreamFetchFailures(failures);
    return false;
  }

  const anyChanged = fetched.some(officialSourceChanged);
  const oasdiffBin = anyChanged ? await resolveOasdiffBin(options.oasdiffBin) : null;
  const comparisons = fetched.map((source) => {
    try {
      return compareFetchedOfficialSource(source, oasdiffBin, options.artifactsRoot);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      throw new Error(`${source.family} upstream comparison failed: ${message}`);
    }
  });
  const results = orderResults(options.families, comparisons);

  printUpstreamReport(results, options.action);

  if (options.action === 'update') {
    promoteFetchedOfficialSources(fetched);
    printUpstreamUpdate(fetched);
    return true;
  }

  return comparisons.every((result) => result.status === 'up_to_date');
}

function isFetched(result: OfficialFetchResult): result is FetchedOfficialSource {
  return result.status === 'fetched';
}

function isFetchFailure(result: OfficialFetchResult): result is OfficialFetchFailure {
  return result.status === 'fetch_failed';
}

function orderResults(
  families: OfficialFamily[],
  comparisons: UpstreamComparisonResult[],
): UpstreamComparisonResult[] {
  const byFamily = new Map(comparisons.map((result) => [result.family, result] as const));

  return families.map((family) => {
    const result = byFamily.get(family);

    if (!result) {
      throw new Error(`No upstream result was produced for ${family}.`);
    }

    return result;
  });
}
