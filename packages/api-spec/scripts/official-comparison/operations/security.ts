// Compares operation security before payload-only normalization removes it.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import type { SecurityComparisonConfig } from '../family-config.ts';
import { HTTP_METHODS } from '../openapi.ts';

export function compareOperationSecurity(
  officialProjection: OpenAPIV3_1.Document,
  ourSpec: OpenAPIV3_1.Document,
  config: SecurityComparisonConfig,
): string[] {
  const issues: string[] = [];

  for (const [path, pathItem] of Object.entries(officialProjection.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const officialOperation = pathItem?.[method];

      if (!officialOperation) {
        continue;
      }

      const ourOperation = ourSpec.paths?.[path]?.[method];

      if (!ourOperation) {
        continue;
      }

      const officialDeclared =
        officialOperation.security !== undefined || officialProjection.security !== undefined;
      const expectedSecurity = officialDeclared
        ? (officialOperation.security ?? officialProjection.security ?? [])
        : (config.whenOfficialUndeclaredByPath?.[path] ?? config.whenOfficialUndeclared);
      const ourSecurity = ourOperation.security ?? ourSpec.security ?? [];

      if (!securityRequirementsEqual(expectedSecurity, ourSecurity)) {
        issues.push(
          `Security differs for ${method.toUpperCase()} ${path}: expected ${formatSecurity(
            expectedSecurity,
          )}, ours ${formatSecurity(ourSecurity)}.`,
        );
      }
    }
  }

  return issues;
}

function securityRequirementsEqual(
  left: OpenAPIV3_1.SecurityRequirementObject[],
  right: OpenAPIV3_1.SecurityRequirementObject[],
): boolean {
  return JSON.stringify(normalizeSecurity(left)) === JSON.stringify(normalizeSecurity(right));
}

function normalizeSecurity(
  requirements: OpenAPIV3_1.SecurityRequirementObject[],
): OpenAPIV3_1.SecurityRequirementObject[] {
  return requirements
    .map((requirement) =>
      Object.fromEntries(
        Object.entries(requirement)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, scopes]) => [name, [...scopes].sort()]),
      ),
    )
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function formatSecurity(requirements: OpenAPIV3_1.SecurityRequirementObject[]): string {
  return requirements.length === 0 ? 'none' : JSON.stringify(normalizeSecurity(requirements));
}
