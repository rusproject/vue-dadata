import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

import type { OfficialFamilyConfig } from './family-config.ts';
import { readJson } from './io.ts';
import {
  compareOperationInventory,
  extractOfficialOperations,
  extractOurFamilyOperations,
} from './operations/inventory.ts';
import { buildProjectedOfficialSpec } from './operations/projection.ts';
import { compareOperationSecurity } from './operations/security.ts';
import type { OperationFamilyConfig, ProjectionResult } from './operations/types.ts';

const OUR_SPEC_PATH = resolve('dadata.json');

export interface FamilyProjection {
  ourSpec: OpenAPIV3_1.Document;
  projection: ProjectionResult;
}

/**
 * Maps one official family onto our concrete operation surface.
 *
 * Generic official endpoints are expanded only through the explicit typed mappings in
 * `family-config.ts`. Local-only extensions are accounted for but excluded from the comparable
 * projection. Security is checked here because the official files currently omit requirements
 * which the live APIs enforce.
 */
export function buildFamilyProjection(
  config: OfficialFamilyConfig,
  officialSourcePath = config.officialSourcePath,
): FamilyProjection {
  const officialSpec = YAML.parse(
    readFileSync(resolve(officialSourcePath), 'utf8'),
  ) as OpenAPIV3_1.Document;
  const ourSpec = readJson<OpenAPIV3_1.Document>(OUR_SPEC_PATH, 'our dadata.json');
  const operationConfig = operationFamilyConfig(config);
  const officialOperations = extractOfficialOperations(officialSpec, operationConfig);
  const ourFamilyOperations = extractOurFamilyOperations(ourSpec, officialOperations);
  const comparison = compareOperationInventory(
    officialOperations,
    ourFamilyOperations,
    config.operations,
    operationConfig,
  );

  if (comparison.issues.length > 0) {
    throw comparisonError(config, comparison.issues);
  }

  const projection = buildProjectedOfficialSpec(
    comparison.units,
    officialOperations,
    officialSpec,
    operationConfig,
  );
  const securityIssues = compareOperationSecurity(projection.document, ourSpec, config.security);

  if (securityIssues.length > 0) {
    throw comparisonError(config, securityIssues);
  }

  return { ourSpec, projection };
}

function operationFamilyConfig(config: OfficialFamilyConfig): OperationFamilyConfig {
  return {
    family: config.family,
    officialPathPrefix: config.officialPathPrefix,
  };
}

function comparisonError(config: OfficialFamilyConfig, issues: string[]): Error {
  return new Error(
    `Official ${config.family} operation mapping failed:\n${issues
      .map((issue) => `- ${issue}`)
      .join('\n')}`,
  );
}
