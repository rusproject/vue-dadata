import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { cloneJson, cloneOptionalJson } from '../io.js';
import { HTTP_METHODS, type HttpMethod, sortPaths } from '../openapi.js';
import { type AnyOfFoldingRule, applyAnyOfFoldingRules } from './anyof-folding.js';
import { type AnyOfSelectionRule, applyAnyOfSelectionRules } from './anyof-selection.js';
import { COMPARISON_INFO, normalizeComparisonDocument } from './comparison-normalization.js';
import {
  applySchemaComponentAliasRules,
  type SchemaComponentAliasRule,
} from './schema-component-aliases.js';
import type { RevisionSliceResult } from './types.js';

/** Extracts the projected path+method inventory that Stage B is allowed to compare. */
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

/** Builds our temporary spec slice with only operations present in the Stage A projection. */
export function buildComparableRevisionSlice(
  comparableOperations: Map<string, Set<HttpMethod>>,
  anyOfSelectionRules: AnyOfSelectionRule[],
  anyOfFoldingRules: AnyOfFoldingRule[],
  schemaComponentAliasRules: SchemaComponentAliasRule[],
  ourSpec: OpenAPIV3_1.Document,
): { document: OpenAPIV3_1.Document; result: RevisionSliceResult } {
  const paths: OpenAPIV3_1.PathsObject = {};
  let operationCount = 0;

  for (const [path, methods] of comparableOperations) {
    const sourcePathItem = ourSpec.paths?.[path];

    if (!sourcePathItem) {
      throw new Error(`Our spec is missing comparable Stage A path: ${path}.`);
    }

    const comparablePathItem: OpenAPIV3_1.PathItemObject = {};

    if (sourcePathItem.parameters) {
      comparablePathItem.parameters = cloneJson(sourcePathItem.parameters);
    }

    for (const method of methods) {
      const operation = sourcePathItem[method];

      if (!operation) {
        throw new Error(
          `Our spec is missing comparable Stage A operation: ${method.toUpperCase()} ${path}.`,
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
    servers: cloneOptionalJson(ourSpec.servers),
    security: cloneOptionalJson(ourSpec.security),
    tags: cloneOptionalJson(ourSpec.tags),
    paths: sortPaths(paths),
    components: cloneOptionalJson(ourSpec.components),
  };

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
