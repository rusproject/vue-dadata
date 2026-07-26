// Selects one explicitly expected branch from broad official anyOf responses.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { isRecord } from '../io.ts';
import { parseCanonicalLocalRef } from '../json-pointer.ts';
import type { ComparisonNormalizationDecision } from './comparison-normalization.ts';
import {
  type ComparisonTarget,
  type OperationSchemaTarget,
  findAndMaterializeOperationSchema,
  formatOperationSchemaTarget,
} from './schema-target.ts';

export interface AnyOfSelectionRule extends OperationSchemaTarget {
  expectedBranchRefs: string[];
  selectedRef: string;
  target: ComparisonTarget;
}

const ANNOTATION_KEYS = new Set(['description']);
const TARGET_KEYS = new Set(['anyOf', ...ANNOTATION_KEYS]);

/** Selects explicitly curated branches from operation-local anyOf schemas. */
export function applyAnyOfSelectionRules(
  document: OpenAPIV3_1.Document,
  rules: AnyOfSelectionRule[],
): ComparisonNormalizationDecision[] {
  return rules.map((rule) => applyAnyOfSelectionRule(document, rule));
}

function applyAnyOfSelectionRule(
  document: OpenAPIV3_1.Document,
  rule: AnyOfSelectionRule,
): ComparisonNormalizationDecision {
  const path = formatOperationSchemaTarget(rule);
  const schema = findAndMaterializeOperationSchema(document, rule, 'AnyOf selection');
  const unsupportedKeys = Object.keys(schema).filter((key) => !TARGET_KEYS.has(key));

  if (unsupportedKeys.length > 0) {
    throw new Error(
      `AnyOf selection found unsupported schema keywords ${unsupportedKeys.sort().join(', ')} at ${path}.`,
    );
  }

  if (!Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
    throw new Error(`AnyOf selection target is missing a non-empty anyOf: ${path}.`);
  }

  parseCanonicalLocalRef(rule.selectedRef, `${path} selectedRef`);
  const expectedBranchRefs = rule.expectedBranchRefs.map((ref, index) => {
    parseCanonicalLocalRef(ref, `${path} expectedBranchRefs[${index}]`);
    return ref;
  });

  const branchRefs = schema.anyOf.map((branch, index) => {
    if (!isRecord(branch) || Object.keys(branch).length !== 1 || typeof branch.$ref !== 'string') {
      throw new Error(
        `AnyOf selection requires exact local-$ref branches at ${path} anyOf[${index}].`,
      );
    }

    parseCanonicalLocalRef(branch.$ref, `${path} anyOf[${index}] $ref`);
    return branch.$ref;
  });

  if (new Set(branchRefs).size !== branchRefs.length) {
    throw new Error(`AnyOf selection found duplicate branch refs at ${path}.`);
  }

  if (!sameStringSet(branchRefs, expectedBranchRefs)) {
    throw new Error(
      `AnyOf selection found unexpected branch refs at ${path}: expected [${expectedBranchRefs
        .toSorted()
        .join(', ')}], actual [${branchRefs.toSorted().join(', ')}].`,
    );
  }

  const selectedCount = branchRefs.filter((ref) => ref === rule.selectedRef).length;

  if (selectedCount !== 1) {
    throw new Error(
      `AnyOf selection expected selectedRef ${rule.selectedRef} exactly once at ${path}; found ${selectedCount}.`,
    );
  }

  delete schema.anyOf;
  schema.$ref = rule.selectedRef;

  return {
    branchRefs,
    compositionKey: 'anyOf',
    kind: 'selected-anyof-branch',
    path,
    ref: rule.selectedRef,
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  const sortedRight = right.toSorted();

  return (
    left.length === right.length &&
    left.toSorted().every((value, index) => value === sortedRight[index])
  );
}
