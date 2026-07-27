// Shared validation and schema helpers for configured anyOf folding.
import { cloneJson, isRecord } from '../io.ts';
import type { MergeContext, ResolvedSchema } from './anyof-folding-types.ts';
import { materializeSchema } from './schema-target.ts';

/** Annotation keywords, которые не влияют на результат merge */
export const ANNOTATION_KEYS = new Set(['description']);

/** Keywords, разрешённые в object-ветках folding rule */
export const OBJECT_KEYS = new Set([
  'additionalProperties',
  'description',
  'properties',
  'required',
  'type',
]);

/** Keywords, разрешённые в array-ветках folding rule */
export const ARRAY_KEYS = new Set(['description', 'items', 'type']);

/**
 * Резолвит $ref, возвращая как зарезолвленную схему так и исходный реф (для проверки ожидаемых веток)
 */
export function resolveSchemaForMerge(
  value: unknown,
  root: Record<string, unknown>,
  path: string,
): ResolvedSchema {
  if (!isRecord(value)) {
    throw new Error(`AnyOf folding branch must be a schema object: ${path}.`);
  }

  const ref = typeof value.$ref === 'string' ? value.$ref : null;

  return {
    ref,
    schema: ref ? materializeSchema(root, value, path, 'AnyOf folding') : value,
  };
}

/** Проверяет, что schema содержит только разрешённые keywords */
export function assertAllowedKeys(
  schema: Record<string, unknown>,
  allowedKeys: Set<string>,
  schemaPath: string,
  context: MergeContext,
): void {
  const unexpected = Object.keys(schema).filter((key) => !allowedKeys.has(key));

  if (unexpected.length > 0) {
    throw new Error(
      `AnyOf folding found unsupported schema keywords ${unexpected.sort().join(', ')} at ${pathLabel(schemaPath, context)}.`,
    );
  }
}

export function assertExactNullBranch(branch: ResolvedSchema, context: MergeContext): void {
  if (branch.ref || stringifyCanonical(branch.schema) !== '{"type":"null"}') {
    throw new Error(`AnyOf folding requires the exact null schema at ${context.rulePath}.`);
  }
}

/** Проверяет что значение `key` одинаковое во всех ветках и возвращает его копию */
export function mergeIdenticalKeyword(
  branches: ResolvedSchema[],
  key: string,
  schemaPath: string,
  context: MergeContext,
): unknown {
  const values = branches.map((branch) => branch.schema[key]);
  const first = values[0];

  if (!values.every((value) => stringifyCanonical(value) === stringifyCanonical(first))) {
    throw new Error(`AnyOf folding found divergent ${key} at ${pathLabel(schemaPath, context)}.`);
  }

  return first === undefined ? undefined : cloneJson(first);
}

/** Проверяет что в `required` только строки и они уникальные. Возвращает Set */
export function readRequired(
  value: unknown,
  schemaPath: string,
  context: MergeContext,
): Set<string> {
  if (value === undefined) {
    return new Set();
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(
      `AnyOf folding found invalid required fields at ${pathLabel(schemaPath, context)}.`,
    );
  }

  const required = new Set(value);

  if (required.size !== value.length) {
    throw new Error(
      `AnyOf folding found duplicate required fields at ${pathLabel(schemaPath, context)}.`,
    );
  }

  return required as Set<string>;
}

export function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value;
}

/** Проверяет что ветка содержит $ref и возвращает его */
export function requireBranchRef(branch: ResolvedSchema | undefined, path: string): string {
  if (!branch?.ref) {
    throw new Error(`AnyOf folding requires explicitly referenced object branches at ${path}.`);
  }

  return branch.ref;
}

export function isNullSchema(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const type = value.type;

  return type === 'null' || (Array.isArray(type) && type.length === 1 && type[0] === 'null');
}

/** Добавляет schemaPath к пути текущего folding rule для сообщений об ошибках */
export function pathLabel(schemaPath: string, context: MergeContext): string {
  return `${context.rulePath} ${schemaPath || '<schema>'}`;
}

export function joinSchemaPath(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child;
}

/** Сериализует значение в JSON с отсортированными ключами объектов */
export function stringifyCanonical(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function intersectSets(sets: Set<string>[]): Set<string> {
  const first = sets[0] ?? new Set<string>();

  return new Set([...first].filter((item) => sets.every((set) => set.has(item))));
}

export function difference(left: Set<string>, right: Set<string>): Set<string> {
  return new Set([...left].filter((item) => !right.has(item)));
}

export function assertStringSetEqual(
  actual: Set<string>,
  expected: Set<string>,
  label: string,
): void {
  if (actual.size !== expected.size || [...actual].some((item) => !expected.has(item))) {
    throw new Error(
      `AnyOf folding found unexpected ${label}: expected [${[...expected].sort().join(', ')}], actual [${[
        ...actual,
      ]
        .sort()
        .join(', ')}].`,
    );
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (!isRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    sorted[key] = canonicalize(child);
  }

  return sorted;
}
