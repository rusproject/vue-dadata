// Builds the normalized slice of our spec matching the projected official operations.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { cloneJson, cloneOptionalJson } from '../io.ts';
import { HTTP_METHODS, type HttpMethod, sortPaths } from '../openapi.ts';
import { type AnyOfFoldingRule, applyAnyOfFoldingRules } from './anyof-folding.ts';
import { type AnyOfSelectionRule, applyAnyOfSelectionRules } from './anyof-selection.ts';
import {
  COMPARISON_INFO,
  type ComparisonNormalizationDecision,
  normalizeComparisonDocument,
} from './comparison-normalization.ts';
import {
  type SchemaComponentAliasRule,
  applySchemaComponentAliasRules,
} from './schema-component-aliases.ts';

/** Метаданные среза нашей спецификации, сделанного для сравнения */
export interface RevisionSliceResult {
  /** Описания всех изменений, сделанных при нормализации среза */
  normalizationDecisions: ComparisonNormalizationDecision[];
  /** Количество операций, вошедших в срез */
  operationCount: number;
}

/** Extracts the exact path+method inventory represented by the official projection. */
export function extractComparableOperations(
  document: OpenAPIV3_1.Document,
  family: string,
): Map<string, Set<HttpMethod>> {
  const operations = new Map<string, Set<HttpMethod>>();

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    const methods = new Set<HttpMethod>();

    for (const method of HTTP_METHODS) {
      if (pathItem?.[method]) {
        methods.add(method);
      }
    }

    if (methods.size > 0) {
      operations.set(path, methods);
    }
  }

  if (operations.size === 0) {
    throw new Error(`Projected official ${family} spec has no comparable operations.`);
  }

  return operations;
}

/** Builds our comparison copy with only operations present in the official projection. */
export function buildComparableRevisionSlice(
  comparableOperations: Map<string, Set<HttpMethod>>,
  anyOfSelectionRules: AnyOfSelectionRule[],
  anyOfFoldingRules: AnyOfFoldingRule[],
  schemaComponentAliasRules: SchemaComponentAliasRule[],
  ourSpec: OpenAPIV3_1.Document,
): { document: OpenAPIV3_1.Document; result: RevisionSliceResult } {
  const paths: OpenAPIV3_1.PathsObject = {};
  let operationCount = 0;

  // Собираем новый объект `paths` только из операций official projection, не меняя исходную спецификацию
  for (const [path, methods] of comparableOperations) {
    const sourcePathItem = ourSpec.paths?.[path];

    if (!sourcePathItem) {
      throw new Error(`Our spec is missing projected official path: ${path}.`);
    }

    const comparablePathItem: OpenAPIV3_1.PathItemObject = {};

    if (sourcePathItem.parameters) {
      comparablePathItem.parameters = cloneJson(sourcePathItem.parameters);
    }

    for (const method of methods) {
      const operation = sourcePathItem[method];

      if (!operation) {
        throw new Error(
          `Our spec is missing projected official operation: ${method.toUpperCase()} ${path}.`,
        );
      }

      comparablePathItem[method] = cloneJson(operation);
      operationCount += 1;
    }

    paths[path] = comparablePathItem;
  }

  const document: OpenAPIV3_1.Document = {
    openapi: ourSpec.openapi ?? '3.1.1',
    info: cloneJson(COMPARISON_INFO),
    paths: sortPaths(paths),
    components: cloneOptionalJson(ourSpec.components),
  };

  // Последовательно применяем к копии общую и project-specific нормализацию
  const normalizationDecisions = normalizeComparisonDocument(document, document.openapi ?? '3.1.1');
  normalizationDecisions.push(...applyAnyOfSelectionRules(document, anyOfSelectionRules));
  normalizationDecisions.push(...applyAnyOfFoldingRules(document, anyOfFoldingRules));
  normalizationDecisions.push(
    ...applySchemaComponentAliasRules(document, schemaComponentAliasRules),
  );

  return {
    document,
    result: {
      normalizationDecisions,
      operationCount,
    },
  };
}
