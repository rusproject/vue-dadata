// Locates and materializes operation-local schemas targeted by explicit rules.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { cloneJson, isRecord } from '../io.ts';
import {
  escapeJsonPointerSegment,
  parseCanonicalLocalRef,
  unescapeJsonPointerSegment,
} from '../json-pointer.ts';
import type { HttpMethod } from '../openapi.ts';

export type ComparisonTarget = 'official' | 'ours';

export interface OperationSchemaTarget {
  operation: {
    method: HttpMethod;
    path: string;
  };
  request?: {
    mediaType: string;
  };
  response?: {
    mediaType: string;
    status: string;
  };
  schemaPath: string;
}

const ANNOTATION_KEYS = new Set(['description']);

/** Validates the canonical comparison schema-path grammar. */
export function assertCanonicalSchemaPath(value: string, path: string, allowEmpty: boolean): void {
  if (value === '') {
    if (allowEmpty) {
      return;
    }

    throw new Error(`${path} must not be empty.`);
  }

  const segments = value.split('/');

  if (segments.some((segment) => segment.length === 0)) {
    throw new Error(`${path} must not contain empty path segments.`);
  }

  for (let index = 0; index < segments.length; ) {
    const segment = segments[index];

    if (segment === 'items') {
      index += 1;
      continue;
    }

    if (segment !== 'properties' || index + 1 >= segments.length) {
      throw new Error(`${path} must use only properties/<escaped-name> and items segments.`);
    }

    const propertySegment = segments[index + 1] ?? '';

    if (escapeJsonPointerSegment(unescapeJsonPointerSegment(propertySegment)) !== propertySegment) {
      throw new Error(`${path} contains a noncanonical JSON Pointer property segment.`);
    }

    index += 2;
  }
}

/** Finds and materializes one operation-local request or response schema target. */
export function findAndMaterializeOperationSchema(
  document: OpenAPIV3_1.Document,
  target: OperationSchemaTarget,
  transformName: string,
): Record<string, unknown> {
  assertCanonicalSchemaPath(
    target.schemaPath,
    `${formatOperationSchemaTarget(target)} schemaPath`,
    true,
  );

  const root = document as unknown as Record<string, unknown>;
  const pathItem = document.paths?.[target.operation.path];

  if (!isRecord(pathItem)) {
    throw new Error(`${transformName} rule points to missing path: ${target.operation.path}.`);
  }

  const operation = pathItem[target.operation.method];

  if (!isRecord(operation)) {
    throw new Error(
      `${transformName} rule points to missing operation: ${target.operation.method.toUpperCase()} ${target.operation.path}.`,
    );
  }

  const schema = target.request
    ? findRequestSchema(root, operation, target, transformName)
    : target.response
      ? findResponseSchema(root, operation, target, transformName)
      : null;

  if (!schema) {
    throw new Error(
      `${transformName} rule must specify request or response: ${formatOperationSchemaTarget(target)}.`,
    );
  }

  return materializeSchemaPath(
    root,
    schema,
    target.schemaPath,
    formatOperationSchemaTarget(target),
    transformName,
  );
}

/** Clones a local $ref schema target and preserves annotation siblings. */
export function materializeSchema(
  root: Record<string, unknown>,
  schema: Record<string, unknown>,
  context: string,
  transformName: string,
  visitedRefs = new Set<string>(),
): Record<string, unknown> {
  if (!('$ref' in schema)) {
    return schema;
  }

  if (typeof schema.$ref !== 'string') {
    throw new Error(`${context} has a non-string $ref.`);
  }

  assertRefHasOnlyAnnotationSiblings(schema, context, transformName);
  const ref = schema.$ref;

  if (visitedRefs.has(ref)) {
    throw new Error(`${context} has a cyclic local $ref chain at ${ref}.`);
  }

  const resolved = resolveLocalRef(root, ref, context);

  if (!isRecord(resolved)) {
    throw new Error(`Failed to resolve local schema ref ${ref}.`);
  }

  const nextVisitedRefs = new Set(visitedRefs);
  nextVisitedRefs.add(ref);
  const materialized = materializeSchema(
    root,
    cloneJson(resolved),
    `${context} -> ${ref}`,
    transformName,
    nextVisitedRefs,
  );

  for (const [key, value] of Object.entries(schema)) {
    if (key !== '$ref') {
      materialized[key] = cloneJson(value);
    }
  }

  return materialized;
}

export function formatOperationSchemaTarget(target: OperationSchemaTarget): string {
  const operation = `${target.operation.method.toUpperCase()} ${target.operation.path}`;
  const schemaPath = target.schemaPath ? ` ${target.schemaPath}` : '';

  if (target.request) {
    return `${operation} request ${target.request.mediaType}${schemaPath}`;
  }

  if (target.response) {
    return `${operation} response ${target.response.status} ${target.response.mediaType}${schemaPath}`;
  }

  return `${operation}${schemaPath}`;
}

function findRequestSchema(
  root: Record<string, unknown>,
  operation: Record<string, unknown>,
  target: OperationSchemaTarget,
  transformName: string,
): Record<string, unknown> {
  const mediaType = target.request?.mediaType;
  const requestBody = requireRecord(
    operation.requestBody,
    `requestBody for ${formatOperationSchemaTarget(target)}`,
  );
  const content = requireRecord(
    requestBody.content,
    `requestBody.content for ${formatOperationSchemaTarget(target)}`,
  );
  const media = requireRecord(
    content[mediaType ?? ''],
    `request media ${mediaType} for ${formatOperationSchemaTarget(target)}`,
  );

  return materializeSchemaProperty(
    root,
    media,
    'schema',
    `request schema for ${formatOperationSchemaTarget(target)}`,
    transformName,
  );
}

function findResponseSchema(
  root: Record<string, unknown>,
  operation: Record<string, unknown>,
  target: OperationSchemaTarget,
  transformName: string,
): Record<string, unknown> {
  const response = target.response;
  const responses = requireRecord(
    operation.responses,
    `responses for ${formatOperationSchemaTarget(target)}`,
  );
  const responseObject = requireRecord(
    responses[response?.status ?? ''],
    `response ${response?.status} for ${formatOperationSchemaTarget(target)}`,
  );
  const content = requireRecord(
    responseObject.content,
    `response.content for ${formatOperationSchemaTarget(target)}`,
  );
  const media = requireRecord(
    content[response?.mediaType ?? ''],
    `response media ${response?.mediaType} for ${formatOperationSchemaTarget(target)}`,
  );

  return materializeSchemaProperty(
    root,
    media,
    'schema',
    `response schema for ${formatOperationSchemaTarget(target)}`,
    transformName,
  );
}

function materializeSchemaPath(
  root: Record<string, unknown>,
  schema: Record<string, unknown>,
  schemaPath: string,
  targetIdentity: string,
  transformName: string,
): Record<string, unknown> {
  const segments = schemaPath === '' ? [] : schemaPath.split('/');
  let current = schema;

  for (let index = 0; index < segments.length; ) {
    const segment = segments[index] ?? '';

    if (segment === 'items') {
      current = materializeSchemaProperty(
        root,
        current,
        'items',
        `${targetIdentity} schemaPath ${schemaPath}`,
        transformName,
      );
      index += 1;
      continue;
    }

    const propertySegment = segments[index + 1] ?? '';
    const propertyName = unescapeJsonPointerSegment(propertySegment);
    const prefix = segments.slice(0, index).join('/') || '<schema>';
    const properties = requireRecord(
      current.properties,
      `${targetIdentity} properties at ${prefix}`,
    );

    current = materializeSchemaProperty(
      root,
      properties,
      propertyName,
      `${targetIdentity} property ${propertyName} in schemaPath ${schemaPath}`,
      transformName,
    );
    index += 2;
  }

  return current;
}

function materializeSchemaProperty(
  root: Record<string, unknown>,
  owner: Record<string, unknown>,
  key: string,
  context: string,
  transformName: string,
): Record<string, unknown> {
  const value = owner[key];

  if (!isRecord(value)) {
    throw new Error(`${context} must be a schema object.`);
  }

  const materialized = materializeSchema(root, value, context, transformName);

  if (materialized !== value) {
    owner[key] = materialized;
  }

  return materialized;
}

function assertRefHasOnlyAnnotationSiblings(
  schema: Record<string, unknown>,
  path: string,
  transformName: string,
): void {
  const unsupportedSiblings = Object.keys(schema).filter(
    (key) => key !== '$ref' && !ANNOTATION_KEYS.has(key),
  );

  if (unsupportedSiblings.length > 0) {
    throw new Error(
      `${transformName} found structural $ref siblings ${unsupportedSiblings.sort().join(', ')} at ${path}.`,
    );
  }
}

function resolveLocalRef(root: Record<string, unknown>, ref: string, context: string): unknown {
  let current: unknown = root;

  for (const segment of parseCanonicalLocalRef(ref, `${context} $ref`)) {
    if (!isRecord(current) && !Array.isArray(current)) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value;
}
