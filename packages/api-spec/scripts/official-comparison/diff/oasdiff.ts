// Resolves and invokes the version-pinned external OpenAPI diff engine.
import { existsSync } from 'node:fs';

import { isRecord, parseJson } from '../io.ts';
import { failedCommandMessage, runCommand } from '../process.ts';
import { assertExpectedOasdiffVersion, installPinnedOasdiff } from './oasdiff-install.ts';

export type OasdiffDiff = Record<string, unknown>;

/** Uses an explicit binary when supplied; otherwise installs the pinned official release. */
export async function resolveOasdiffBin(explicitPath: string | null): Promise<string> {
  const envPath = process.env.OASDIFF_BIN;
  const configuredPath = explicitPath ?? envPath;

  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw new Error(`Configured oasdiff executable does not exist: ${configuredPath}.`);
    }

    assertExpectedOasdiffVersion(configuredPath);
    return configuredPath;
  }

  return installPinnedOasdiff();
}

/** Runs the full oasdiff JSON report used to build our stable snapshot records. */
export function runOasdiffDiff(
  oasdiffBin: string,
  projectionPath: string,
  revisionPath: string,
  matchPathRegex: string,
): OasdiffDiff {
  const result = runCommand(oasdiffBin, [
    'diff',
    projectionPath,
    revisionPath,
    '-f',
    'json',
    '--match-path',
    matchPathRegex,
  ]);

  if (result.status !== 0) {
    throw new Error(failedCommandMessage('oasdiff diff failed.', result));
  }

  const parsed = parseJson<unknown>(result.stdout, 'oasdiff full diff JSON');

  if (!isRecord(parsed)) {
    throw new Error('oasdiff full diff JSON must be an object.');
  }

  return parsed;
}
