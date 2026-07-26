// Comparison-only normalization used before external diff tools see the temporary specs.
// Keep each transform narrow and logged; source specs must not be rewritten here.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { cloneJson, isRecord } from '../io.ts';
import { escapeJsonPointerSegment, parseCanonicalLocalRef } from '../json-pointer.ts';

type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';
type CompositionKey = 'anyOf' | 'oneOf';

export interface ComparisonNormalizationDecision {
  branchRefs?: string[];
  canonicalName?: string;
  compositionKey?: CompositionKey;
  kind:
    | 'aliased-schema-component'
    | 'flattened-nullable-composition'
    | 'folded-object-anyof'
    | 'inlined-nullable-object-ref'
    | 'selected-anyof-branch';
  objectBranchCount?: number;
  path: string;
  ref?: string;
  rewrittenRefCount?: number;
  sourceName?: string;
}

export const COMPARISON_INFO = {
  title: 'DaData official comparison',
  version: '0.0.0',
};

const HTTP_METHODS: HttpMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

/** Normalizes a temporary comparison document and returns every schema rewrite decision. */
export function normalizeComparisonDocument(
  document: OpenAPIV3_1.Document,
  openapiVersion: string,
): ComparisonNormalizationDecision[] {
  const root = document as unknown as Record<string, unknown>;
  const decisions: ComparisonNormalizationDecision[] = [];

  root.openapi = openapiVersion;
  root.info = cloneJson(COMPARISON_INFO);
  delete root.servers;
  delete root.security;
  delete root.tags;
  delete root.externalDocs;

  const components = root.components;

  if (isRecord(components)) {
    delete components.securitySchemes;
  }

  normalizeNullableSchemas(root, root, '#', decisions);
  normalizeComparisonOperations(document);

  return decisions;
}

/** Removes operation metadata that is not part of the current payload comparison. */
function normalizeComparisonOperations(document: OpenAPIV3_1.Document): void {
  for (const pathItem of Object.values(document.paths ?? {})) {
    if (!isRecord(pathItem)) {
      continue;
    }

    delete pathItem.servers;

    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!isRecord(operation)) {
        continue;
      }

      delete operation.tags;
      delete operation.summary;
      delete operation.description;
      delete operation.externalDocs;
      delete operation.operationId;
      delete operation.security;
      delete operation.servers;

      for (const key of Object.keys(operation)) {
        if (key.startsWith('x-')) {
          delete operation[key];
        }
      }
    }
  }
}

/** Walks the document and canonicalizes only narrow nullable schema shapes. */
function normalizeNullableSchemas(
  value: unknown,
  root: Record<string, unknown>,
  path: string,
  decisions: ComparisonNormalizationDecision[],
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      normalizeNullableSchemas(item, root, `${path}/${index}`, decisions);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  canonicalizeNullableComposition(value, root, path, decisions);

  if (value.nullable === true) {
    delete value.nullable;
    addNullType(value);
    addNullEnumValue(value);
  } else if (value.nullable === false) {
    delete value.nullable;
  }

  for (const [key, child] of Object.entries(value)) {
    normalizeNullableSchemas(child, root, `${path}/${escapeJsonPointerSegment(key)}`, decisions);
  }
}

/** Rewrites two-branch nullable compositions when the non-null branch is safe to flatten. */
function canonicalizeNullableComposition(
  schema: Record<string, unknown>,
  root: Record<string, unknown>,
  path: string,
  decisions: ComparisonNormalizationDecision[],
): void {
  const compositionKey = getNullableCompositionKey(schema);

  if (!compositionKey) {
    return;
  }

  const composition = schema[compositionKey];

  if (!Array.isArray(composition) || composition.length !== 2) {
    return;
  }

  const nullBranchIndex = composition.findIndex(isNullSchema);

  if (nullBranchIndex === -1) {
    return;
  }

  const nonNullBranch = composition[nullBranchIndex === 0 ? 1 : 0];

  if (!isRecord(nonNullBranch)) {
    return;
  }

  if (canFlattenNullableBranch(nonNullBranch)) {
    replaceCompositionWithSchema(schema, compositionKey, nonNullBranch);
    addNullType(schema);
    addNullEnumValue(schema);
    decisions.push({
      compositionKey,
      kind: 'flattened-nullable-composition',
      path,
    });
    return;
  }

  const ref = getPlainRef(nonNullBranch);

  if (!ref) {
    return;
  }

  const resolved = resolveLocalRef(root, ref);

  if (!isRecord(resolved) || !canFlattenNullableObjectRefTarget(resolved)) {
    return;
  }

  replaceCompositionWithSchema(schema, compositionKey, resolved);
  addNullType(schema);
  decisions.push({
    compositionKey,
    kind: 'inlined-nullable-object-ref',
    path,
    ref,
  });
}

/** Replaces the composition keyword with a cloned branch while preserving local siblings. */
function replaceCompositionWithSchema(
  schema: Record<string, unknown>,
  compositionKey: CompositionKey,
  replacement: Record<string, unknown>,
): void {
  delete schema[compositionKey];

  for (const [key, value] of Object.entries(replacement)) {
    if (schema[key] === undefined || key === 'type' || key === 'enum' || key === 'format') {
      schema[key] = cloneJson(value);
    }
  }
}

function getNullableCompositionKey(schema: Record<string, unknown>): CompositionKey | null {
  if (Array.isArray(schema.anyOf)) {
    return 'anyOf';
  }

  if (Array.isArray(schema.oneOf)) {
    return 'oneOf';
  }

  return null;
}

/** Checks for non-composed inline schemas that can safely absorb a null type. */
function canFlattenNullableBranch(schema: Record<string, unknown>): boolean {
  return (
    !('$ref' in schema) &&
    !('allOf' in schema) &&
    !('anyOf' in schema) &&
    !('oneOf' in schema) &&
    !('not' in schema) &&
    schema.type !== undefined
  );
}

/** Checks for plain object ref targets that can be inlined as object-or-null. */
function canFlattenNullableObjectRefTarget(schema: Record<string, unknown>): boolean {
  const type = schema.type;

  return (
    !('$ref' in schema) &&
    !('allOf' in schema) &&
    !('anyOf' in schema) &&
    !('oneOf' in schema) &&
    !('not' in schema) &&
    (type === 'object' || (Array.isArray(type) && type.includes('object')))
  );
}

function getPlainRef(schema: Record<string, unknown>): string | null {
  const keys = Object.keys(schema);

  if (keys.length !== 1 || typeof schema.$ref !== 'string') {
    return null;
  }

  return schema.$ref;
}

/** Resolves local JSON Pointer refs inside the temporary comparison document. */
function resolveLocalRef(root: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith('#/')) {
    return null;
  }

  let current: unknown = root;

  for (const segment of parseCanonicalLocalRef(ref, 'comparison normalization $ref')) {
    if (!isRecord(current) && !Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isNullSchema(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const type = value.type;

  return type === 'null' || (Array.isArray(type) && type.length === 1 && type[0] === 'null');
}

function addNullType(schema: Record<string, unknown>): void {
  const type = schema.type;

  if (typeof type === 'string') {
    schema.type = type === 'null' ? type : [type, 'null'];
    return;
  }

  if (Array.isArray(type)) {
    schema.type = type.includes('null') ? type : [...type, 'null'];
  }
}

function addNullEnumValue(schema: Record<string, unknown>): void {
  const enumValues = schema.enum;

  if (!Array.isArray(enumValues) || enumValues.includes(null)) {
    return;
  }

  schema.enum = [...enumValues, null];
}
