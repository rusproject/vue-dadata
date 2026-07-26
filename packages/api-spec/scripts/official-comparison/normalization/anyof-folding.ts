// Public surface for the fail-closed, comparison-only folding of configured object unions.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { foldConfiguredAnyOf } from './anyof-folding-rule.ts';
import type { AnyOfFoldingRule } from './anyof-folding-types.ts';
import type { ComparisonNormalizationDecision } from './comparison-normalization.ts';

export type {
  AllowedRecursiveMerge,
  AnyOfFoldingRule,
  ExpectedObjectBranch,
} from './anyof-folding-types.ts';

export function applyAnyOfFoldingRules(
  document: OpenAPIV3_1.Document,
  rules: AnyOfFoldingRule[],
): ComparisonNormalizationDecision[] {
  return rules.map((rule) => foldConfiguredAnyOf(document, rule));
}
