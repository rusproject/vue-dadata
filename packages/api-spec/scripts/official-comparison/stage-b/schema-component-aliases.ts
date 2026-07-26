import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { isRecord } from '../io.js';
import { escapeJsonPointerSegment } from '../json-pointer.js';
import type { ComparisonNormalizationDecision } from './comparison-normalization.js';
import type { ComparisonTarget } from './schema-target.js';

export interface SchemaComponentAliasRule {
  canonicalName: string;
  sourceName: string;
  target: ComparisonTarget;
}

/** Renames explicitly paired schema components and every exact local ref to them. */
export function applySchemaComponentAliasRules(
  document: OpenAPIV3_1.Document,
  rules: SchemaComponentAliasRule[],
): ComparisonNormalizationDecision[] {
  if (rules.length === 0) {
    return [];
  }

  assertIndependentAliases(rules);

  const schemas = document.components?.schemas;

  if (!isRecord(schemas)) {
    throw new Error('Schema component aliases require components.schemas.');
  }

  for (const rule of rules) {
    if (!Object.hasOwn(schemas, rule.sourceName)) {
      throw new Error(
        `Schema component alias source is missing: ${formatSchemaRef(rule.sourceName)}.`,
      );
    }

    if (Object.hasOwn(schemas, rule.canonicalName)) {
      throw new Error(
        `Schema component alias target already exists: ${formatSchemaRef(rule.canonicalName)}.`,
      );
    }
  }

  return rules.map((rule) => {
    const sourceRef = formatSchemaRef(rule.sourceName);
    const canonicalRef = formatSchemaRef(rule.canonicalName);
    const rewrittenRefCount = rewriteExactRefs(document, sourceRef, canonicalRef);

    if (rewrittenRefCount === 0) {
      throw new Error(`Schema component alias source is not referenced: ${sourceRef}.`);
    }

    schemas[rule.canonicalName] = schemas[rule.sourceName];
    delete schemas[rule.sourceName];

    return {
      canonicalName: rule.canonicalName,
      kind: 'aliased-schema-component',
      path: sourceRef,
      ref: canonicalRef,
      rewrittenRefCount,
      sourceName: rule.sourceName,
    };
  });
}

function assertIndependentAliases(rules: SchemaComponentAliasRule[]): void {
  const sourceNames = rules.map((rule) => rule.sourceName);
  const canonicalNames = rules.map((rule) => rule.canonicalName);

  if (new Set(sourceNames).size !== sourceNames.length) {
    throw new Error('Schema component aliases must not contain duplicate source names.');
  }

  if (new Set(canonicalNames).size !== canonicalNames.length) {
    throw new Error('Schema component aliases must not contain duplicate canonical names.');
  }

  const sourceSet = new Set(sourceNames);
  const overlappingNames = canonicalNames.filter((name) => sourceSet.has(name));

  if (overlappingNames.length > 0) {
    throw new Error(
      `Schema component aliases must not form chains or cycles: ${overlappingNames.sort().join(', ')}.`,
    );
  }
}

function rewriteExactRefs(value: unknown, sourceRef: string, canonicalRef: string): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, item) => count + rewriteExactRefs(item, sourceRef, canonicalRef),
      0,
    );
  }

  if (!isRecord(value)) {
    return 0;
  }

  let count = 0;

  if (value.$ref === sourceRef) {
    value.$ref = canonicalRef;
    count += 1;
  }

  for (const child of Object.values(value)) {
    count += rewriteExactRefs(child, sourceRef, canonicalRef);
  }

  return count;
}

function formatSchemaRef(name: string): string {
  return `#/components/schemas/${escapeJsonPointerSegment(name)}`;
}
