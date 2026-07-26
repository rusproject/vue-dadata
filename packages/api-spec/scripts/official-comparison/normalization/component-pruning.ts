// Keeps only operation-reachable components so unrelated names do not dominate the diff.
// Comparison-only component pruning. The source specs stay untouched; temporary specs keep only reachable refs.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { isRecord } from '../io.ts';
import {
  escapeJsonPointerSegment,
  formatLocalRef,
  parseCanonicalLocalRef,
} from '../json-pointer.ts';

export interface ComponentPruningResult {
  after: Record<string, number>;
  before: Record<string, number>;
  kept: Record<string, string[]>;
  removed: Record<string, string[]>;
  validatedLocalRefCount: number;
}

interface LocalRefValidationResult {
  localRefCount: number;
  unresolvedRefs: string[];
}

const COMPONENT_COLLECTION_KEYS = new Set([
  'callbacks',
  'examples',
  'headers',
  'links',
  'parameters',
  'pathItems',
  'requestBodies',
  'responses',
  'schemas',
  'securitySchemes',
]);

/** Removes unreferenced standard component entries after all comparison normalizations are complete. */
export function pruneUnreferencedComponents(
  document: OpenAPIV3_1.Document,
): ComponentPruningResult {
  const root = document as unknown as Record<string, unknown>;
  const before = countComponents(root.components);
  const requiredComponents = new Map<string, Set<string>>();
  const visitedRefs = new Set<string>();
  const unresolvedRefs: string[] = [];

  collectReachableComponentRefs(
    root.paths,
    root,
    '#/paths',
    requiredComponents,
    visitedRefs,
    unresolvedRefs,
  );

  if (unresolvedRefs.length > 0) {
    throw new Error(
      `Cannot prune comparison components; unresolved local refs: ${unresolvedRefs
        .sort((left, right) => left.localeCompare(right))
        .join(', ')}`,
    );
  }

  const { kept, removed } = pruneComponents(root, requiredComponents);
  const validation = validateLocalRefs(root);

  if (validation.unresolvedRefs.length > 0) {
    throw new Error(
      `Component pruning left unresolved local refs: ${validation.unresolvedRefs
        .sort((left, right) => left.localeCompare(right))
        .join(', ')}`,
    );
  }

  return {
    after: countComponents(root.components),
    before,
    kept,
    removed,
    validatedLocalRefCount: validation.localRefCount,
  };
}

/** Walks a value, follows local refs recursively, and records component roots that must survive. */
function collectReachableComponentRefs(
  value: unknown,
  root: Record<string, unknown>,
  path: string,
  requiredComponents: Map<string, Set<string>>,
  visitedRefs: Set<string>,
  unresolvedRefs: string[],
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectReachableComponentRefs(
        item,
        root,
        `${path}/${index}`,
        requiredComponents,
        visitedRefs,
        unresolvedRefs,
      );
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const ref = value.$ref;

  if ('$ref' in value && typeof ref !== 'string') {
    throw new Error(`Cannot prune comparison components; non-string $ref at ${path}.`);
  }

  if (typeof ref === 'string' && isLocalRef(ref)) {
    const pointer = parseCanonicalLocalRef(ref, `${path} $ref`);
    const canonicalRef = formatLocalRef(pointer);

    markRequiredComponent(pointer, requiredComponents);

    if (!visitedRefs.has(canonicalRef)) {
      visitedRefs.add(canonicalRef);

      const resolved = resolvePointer(root, pointer);

      if (resolved === undefined) {
        unresolvedRefs.push(`${path} -> ${ref}`);
      } else {
        collectReachableComponentRefs(
          resolved,
          root,
          canonicalRef,
          requiredComponents,
          visitedRefs,
          unresolvedRefs,
        );
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    collectReachableComponentRefs(
      child,
      root,
      `${path}/${escapeJsonPointerSegment(key)}`,
      requiredComponents,
      visitedRefs,
      unresolvedRefs,
    );
  }
}

/** Removes entries from standard components collections unless traversal marked them as reachable. */
function pruneComponents(
  root: Record<string, unknown>,
  requiredComponents: Map<string, Set<string>>,
): Pick<ComponentPruningResult, 'kept' | 'removed'> {
  const components = root.components;
  const kept: Record<string, string[]> = {};
  const removed: Record<string, string[]> = {};

  if (!isRecord(components)) {
    return { kept, removed };
  }

  for (const [section, collection] of Object.entries(components)) {
    if (!COMPONENT_COLLECTION_KEYS.has(section) || !isRecord(collection)) {
      continue;
    }

    const requiredNames = requiredComponents.get(section) ?? new Set<string>();

    for (const name of Object.keys(collection)) {
      if (requiredNames.has(name)) {
        (kept[section] ??= []).push(name);
        continue;
      }

      delete collection[name];
      (removed[section] ??= []).push(name);
    }

    if (Object.keys(collection).length === 0) {
      delete components[section];
    }
  }

  if (Object.keys(components).length === 0) {
    delete root.components;
  }

  sortComponentNameRecords(kept);
  sortComponentNameRecords(removed);

  return { kept, removed };
}

/** Validates that every local ref still present after pruning resolves in the pruned document. */
function validateLocalRefs(root: Record<string, unknown>): LocalRefValidationResult {
  const result: LocalRefValidationResult = {
    localRefCount: 0,
    unresolvedRefs: [],
  };

  collectLocalRefValidationIssues(root, root, '#', result);

  return result;
}

/** Walks a document without following refs and records unresolved local ref pointers. */
function collectLocalRefValidationIssues(
  value: unknown,
  root: Record<string, unknown>,
  path: string,
  result: LocalRefValidationResult,
): void {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectLocalRefValidationIssues(item, root, `${path}/${index}`, result);
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const ref = value.$ref;

  if ('$ref' in value && typeof ref !== 'string') {
    throw new Error(`Component pruning left non-string $ref at ${path}.`);
  }

  if (typeof ref === 'string' && isLocalRef(ref)) {
    result.localRefCount += 1;

    const pointer = parseCanonicalLocalRef(ref, `${path} $ref`);

    if (resolvePointer(root, pointer) === undefined) {
      result.unresolvedRefs.push(`${path} -> ${ref}`);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    collectLocalRefValidationIssues(
      child,
      root,
      `${path}/${escapeJsonPointerSegment(key)}`,
      result,
    );
  }
}

/** Counts entries in standard OpenAPI components collections. */
function countComponents(components: unknown): Record<string, number> {
  const counts: Record<string, number> = {};

  if (!isRecord(components)) {
    return counts;
  }

  for (const [section, collection] of Object.entries(components)) {
    if (!COMPONENT_COLLECTION_KEYS.has(section) || !isRecord(collection)) {
      continue;
    }

    counts[section] = Object.keys(collection).length;
  }

  return counts;
}

/** Marks the root component entry for a local component pointer, including nested refs. */
function markRequiredComponent(
  pointer: string[],
  requiredComponents: Map<string, Set<string>>,
): void {
  if (pointer[0] !== 'components' || pointer.length < 3) {
    return;
  }

  const section = pointer[1];
  const name = pointer[2];

  if (!section || !name) {
    return;
  }

  const names = requiredComponents.get(section) ?? new Set<string>();

  names.add(name);
  requiredComponents.set(section, names);
}

/** Resolves a parsed JSON pointer against an object root. */
function resolvePointer(root: Record<string, unknown>, pointer: string[]): unknown {
  let current: unknown = root;

  for (const segment of pointer) {
    if (!isRecord(current) && !Array.isArray(current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isLocalRef(ref: string): boolean {
  return ref === '#' || ref.startsWith('#/');
}

function sortComponentNameRecords(records: Record<string, string[]>): void {
  for (const names of Object.values(records)) {
    names.sort((left, right) => left.localeCompare(right));
  }
}
