// Merges only the branch differences named by one folding rule.
import { cloneJson } from '../io.ts';
import { escapeJsonPointerSegment } from '../json-pointer.ts';
import type { ExpectedObjectBranch, MergeContext, ResolvedSchema } from './anyof-folding-types.ts';
import {
  ANNOTATION_KEYS,
  ARRAY_KEYS,
  OBJECT_KEYS,
  assertAllowedKeys,
  assertStringSetEqual,
  difference,
  intersectSets,
  joinSchemaPath,
  mergeIdenticalKeyword,
  pathLabel,
  readRequired,
  requireBranchRef,
  requireRecord,
  resolveSchemaForMerge,
  stringifyCanonical,
} from './anyof-folding-utils.ts';

/** Объединяет object-ветки в общую schema, проверяя refs и branch-only поля по folding rule */
export function mergeObjectBranches(
  branches: ResolvedSchema[],
  expectedBranches: ExpectedObjectBranch[],
  schemaPath: string,
  context: MergeContext,
): Record<string, unknown> {
  assertExpectedObjectBranches(branches, expectedBranches, schemaPath, context);

  const propertyMaps = branches.map((branch) =>
    requireRecord(branch.schema.properties, `properties at ${pathLabel(schemaPath, context)}`),
  );
  const requiredSets = branches.map((branch) =>
    readRequired(branch.schema.required, schemaPath, context),
  );
  assertBranchLocalDifferences(
    branches,
    propertyMaps,
    requiredSets,
    expectedBranches,
    schemaPath,
    context,
  );

  const properties: Record<string, unknown> = {};
  const propertyNames = new Set(
    propertyMaps.flatMap((propertiesForBranch) => Object.keys(propertiesForBranch)),
  );

  for (const propertyName of [...propertyNames].sort((left, right) => left.localeCompare(right))) {
    const propertySchemas = propertyMaps
      .map((propertiesForBranch) => propertiesForBranch[propertyName])
      .filter((value): value is unknown => value !== undefined);
    const propertyPath = joinSchemaPath(
      schemaPath,
      `properties/${escapeJsonPointerSegment(propertyName)}`,
    );

    properties[propertyName] = mergeSchemaVariants(propertySchemas, propertyPath, context);
  }

  const foldedSchema: Record<string, unknown> = { type: 'object' };
  const required = intersectSets(requiredSets);
  const additionalProperties = mergeIdenticalKeyword(
    branches,
    'additionalProperties',
    schemaPath,
    context,
  );

  if (Object.keys(properties).length > 0) {
    foldedSchema.properties = properties;
  }

  if (required.size > 0) {
    foldedSchema.required = [...required].sort((left, right) => left.localeCompare(right));
  }

  if (additionalProperties !== undefined) {
    foldedSchema.additionalProperties = additionalProperties;
  }

  return foldedSchema;
}

/** Копирует одинаковые варианты schema или выполняет явно разрешённый recursive merge */
function mergeSchemaVariants(
  variants: unknown[],
  schemaPath: string,
  context: MergeContext,
): unknown {
  const first = variants[0];

  if (variants.every((variant) => stringifyCanonical(variant) === stringifyCanonical(first))) {
    return cloneJson(first);
  }

  const permission = context.permissions.get(schemaPath);

  if (!permission) {
    throw new Error(
      `AnyOf folding found an unapproved divergent schema at ${pathLabel(schemaPath, context)}.`,
    );
  }

  context.usedPermissions.add(schemaPath);

  if (
    permission.expectedBranchCount !== undefined &&
    variants.length !== permission.expectedBranchCount
  ) {
    throw new Error(
      `AnyOf folding found an unexpected branch count at ${pathLabel(schemaPath, context)}.`,
    );
  }

  const resolved = variants.map((variant) =>
    resolveSchemaForMerge(variant, context.root, pathLabel(schemaPath, context)),
  );
  assertExpectedRefs(
    resolved,
    permission.expectedBranchRefs,
    schemaPath,
    context,
    permission.kind === 'object',
  );

  if (permission.kind === 'object') {
    return mergeObjectBranches(
      resolved,
      permission.expectedObjectBranches ?? [],
      schemaPath,
      context,
    );
  }

  if (permission.expectedObjectBranches !== undefined) {
    throw new Error(
      `Array merge permission must not define expectedObjectBranches: ${pathLabel(schemaPath, context)}.`,
    );
  }

  return mergeArrayBranches(resolved, schemaPath, context);
}

/** Объединяет array-ветки, удаляя annotations и рекурсивно сливая items */
function mergeArrayBranches(
  branches: ResolvedSchema[],
  schemaPath: string,
  context: MergeContext,
): Record<string, unknown> {
  for (const branch of branches) {
    assertAllowedKeys(branch.schema, ARRAY_KEYS, schemaPath, context);

    if (branch.schema.type !== 'array') {
      throw new Error(`AnyOf folding expected an array at ${pathLabel(schemaPath, context)}.`);
    }
  }

  const folded = cloneJson(branches[0]?.schema ?? {});
  const items = branches.map((branch) => branch.schema.items);

  if (items.some((item) => typeof item !== 'object' || item === null || Array.isArray(item))) {
    throw new Error(
      `AnyOf folding requires schema-object array items at ${pathLabel(schemaPath, context)}.`,
    );
  }

  for (const key of Object.keys(folded)) {
    if (ANNOTATION_KEYS.has(key)) {
      delete folded[key];
    } else if (key !== 'items') {
      folded[key] = mergeIdenticalKeyword(branches, key, schemaPath, context);
    }
  }

  folded.items = mergeSchemaVariants(items, joinSchemaPath(schemaPath, 'items'), context);

  return folded;
}

/** Проверяет число, refs, type и разрешённые keywords object-веток */
function assertExpectedObjectBranches(
  branches: ResolvedSchema[],
  expectedBranches: ExpectedObjectBranch[],
  schemaPath: string,
  context: MergeContext,
): void {
  assertExpectedRefs(
    branches,
    expectedBranches.map((branch) => branch.ref),
    schemaPath,
    context,
    true,
  );

  if (branches.length < 2) {
    throw new Error(
      `AnyOf folding requires at least two object branches at ${pathLabel(schemaPath, context)}.`,
    );
  }

  for (const branch of branches) {
    assertAllowedKeys(branch.schema, OBJECT_KEYS, schemaPath, context);

    if (branch.schema.type !== 'object') {
      throw new Error(`AnyOf folding expected an object at ${pathLabel(schemaPath, context)}.`);
    }
  }
}

/** Проверяет точное соответствие branch-only `properties` и `required` условиям folding rule */
function assertBranchLocalDifferences(
  branches: ResolvedSchema[],
  propertyMaps: Record<string, unknown>[],
  requiredSets: Set<string>[],
  expectedBranches: ExpectedObjectBranch[],
  schemaPath: string,
  context: MergeContext,
): void {
  const commonProperties = intersectSets(
    propertyMaps.map((properties) => new Set(Object.keys(properties))),
  );
  const commonRequired = intersectSets(requiredSets);
  const expectedByRef = new Map(expectedBranches.map((branch) => [branch.ref, branch]));

  for (let index = 0; index < branches.length; index += 1) {
    const ref = requireBranchRef(branches[index], pathLabel(schemaPath, context));
    const expected = expectedByRef.get(ref);

    if (!expected) {
      throw new Error(
        `AnyOf folding has no expectation for branch ${ref}: ${pathLabel(schemaPath, context)}.`,
      );
    }

    assertStringSetEqual(
      difference(new Set(Object.keys(propertyMaps[index] ?? {})), commonProperties),
      new Set(expected.onlyProperties),
      `branch-only properties for ${ref} at ${pathLabel(schemaPath, context)}`,
    );
    assertStringSetEqual(
      difference(requiredSets[index] ?? new Set(), commonRequired),
      new Set(expected.onlyRequired),
      `branch-only required fields for ${ref} at ${pathLabel(schemaPath, context)}`,
    );
  }
}

function assertExpectedRefs(
  branches: ResolvedSchema[],
  expectedRefs: string[],
  schemaPath: string,
  context: MergeContext,
  requireEveryBranchRef: boolean,
): void {
  const actualRefs = branches.flatMap((branch) => (branch.ref ? [branch.ref] : []));

  if (requireEveryBranchRef && actualRefs.length !== branches.length) {
    throw new Error(
      `AnyOf folding requires explicitly referenced branches at ${pathLabel(schemaPath, context)}.`,
    );
  }

  if (
    actualRefs.length !== expectedRefs.length ||
    actualRefs.some((ref, index) => ref !== expectedRefs[index])
  ) {
    throw new Error(
      `AnyOf folding found unexpected ordered branch refs at ${pathLabel(schemaPath, context)}: expected [${expectedRefs.join(
        ', ',
      )}], actual [${actualRefs.join(', ')}].`,
    );
  }
}
