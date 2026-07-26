import type { UpstreamComparisonResult } from './check.ts';
import type { FetchedOfficialSource, OfficialFetchFailure } from './fetch.ts';

type UpstreamResult = UpstreamComparisonResult | OfficialFetchFailure;

export function printUpstreamReport(results: UpstreamResult[], action: 'check' | 'update'): void {
  const lines = results.flatMap((result) => formatUpstreamResult(result, action));
  const changed = results.filter((result) => result.status === 'changed_upstream').length;
  const failed = results.filter((result) => result.status === 'fetch_failed').length;
  const upToDate = results.length - changed - failed;

  lines.push(
    `Official sources: ${upToDate} unchanged, ${changed} changed, ${failed} fetch failed.`,
  );

  const report = lines.join('\n');
  const unsuccessful = failed > 0 || (action === 'check' && changed > 0);

  if (unsuccessful) {
    console.error(report);
  } else {
    console.info(report);
  }
}

export function printUpstreamUpdate(sources: FetchedOfficialSource[]): void {
  console.info(
    `✓ Updated saved official sources from the fetched files: ${sources
      .map((source) => source.family)
      .join(', ')}`,
  );
}

export function printUpstreamFetchFailures(failures: OfficialFetchFailure[]): void {
  console.error(
    failures
      .flatMap((failure) => formatUpstreamResult(failure, 'check'))
      .concat('No saved official source was updated.')
      .join('\n'),
  );
}

function formatUpstreamResult(result: UpstreamResult, action: 'check' | 'update'): string[] {
  if (result.status === 'up_to_date') {
    return [`✓ ${result.family}: saved official source matches upstream`];
  }

  if (result.status === 'fetch_failed') {
    const http = result.httpStatus ? `HTTP ${result.httpStatus} ` : '';

    return [
      `✗ ${result.family}: upstream fetch failed (${http}${result.message})`,
      `  ${result.url}`,
    ];
  }

  return [
    `${action === 'check' ? '✗' : '△'} ${result.family}: official source changed upstream`,
    `  fetched:      ${result.fetchedPath}`,
    `  raw diff:     ${result.rawDiffPath}`,
    `  semantic diff: ${result.semanticDiffPath}`,
  ];
}
