// Validates one configured union target, delegates its merge, and records the rewrite.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { cloneJson } from '../io.ts';
import { mergeObjectBranches } from './anyof-folding-merge.ts';
import type {
  AllowedRecursiveMerge,
  AnyOfFoldingRule,
  MergeContext,
} from './anyof-folding-types.ts';
import {
  assertAllowedKeys,
  assertExactNullBranch,
  isNullSchema,
  requireBranchRef,
  resolveSchemaForMerge,
} from './anyof-folding-utils.ts';
import type { ComparisonNormalizationDecision } from './comparison-normalization.ts';
import {
  assertCanonicalSchemaPath,
  findAndMaterializeOperationSchema,
  formatOperationSchemaTarget,
} from './schema-target.ts';

const COMPOSITION_TARGET_KEYS = new Set(['anyOf', 'description']);

export function foldConfiguredAnyOf(
  document: OpenAPIV3_1.Document,
  rule: AnyOfFoldingRule,
): ComparisonNormalizationDecision {
  const root = document as unknown as Record<string, unknown>;
  const targetSchema = findAndMaterializeOperationSchema(document, rule, 'AnyOf folding');
  const decisionPath = formatOperationSchemaTarget(rule);
  const context = createMergeContext(root, rule, decisionPath);
  const decision = foldObjectAnyOf(targetSchema, rule, context);

  assertAllPermissionsUsed(context);

  return decision;
}

function createMergeContext(
  root: Record<string, unknown>,
  rule: AnyOfFoldingRule,
  rulePath: string,
): MergeContext {
  const permissions = new Map<string, AllowedRecursiveMerge>();

  for (const permission of rule.allowedRecursiveMerges) {
    assertCanonicalSchemaPath(
      permission.schemaPath,
      `${rulePath} recursive merge schemaPath`,
      false,
    );

    if (permissions.has(permission.schemaPath)) {
      throw new Error(
        `AnyOf folding has duplicate recursive merge permission ${permission.schemaPath}: ${rulePath}.`,
      );
    }

    permissions.set(permission.schemaPath, permission);
  }

  return {
    permissions,
    root,
    rulePath,
    usedPermissions: new Set(),
  };
}

function foldObjectAnyOf(
  schema: Record<string, unknown>,
  rule: AnyOfFoldingRule,
  context: MergeContext,
): ComparisonNormalizationDecision {
  const anyOf = schema.anyOf;

  if (!Array.isArray(anyOf) || anyOf.length === 0) {
    throw new Error(`AnyOf folding target is missing a non-empty anyOf: ${context.rulePath}.`);
  }

  assertAllowedKeys(schema, COMPOSITION_TARGET_KEYS, '', context);
  const branches = anyOf.map((branch) =>
    resolveSchemaForMerge(branch, context.root, context.rulePath),
  );
  const nullBranches = branches.filter((branch) => isNullSchema(branch.schema));
  const objectBranches = branches.filter((branch) => !isNullSchema(branch.schema));

  if ((nullBranches.length === 1) !== rule.expectedNullBranch) {
    throw new Error(`AnyOf folding found an unexpected null-branch shape: ${context.rulePath}.`);
  }

  if (nullBranches.length > 1) {
    throw new Error(`AnyOf folding found multiple null branches: ${context.rulePath}.`);
  }

  for (const nullBranch of nullBranches) {
    assertExactNullBranch(nullBranch, context);
  }

  const foldedSchema = mergeObjectBranches(
    objectBranches,
    rule.expectedObjectBranches,
    '',
    context,
  );

  if (rule.expectedNullBranch) {
    foldedSchema.type = ['object', 'null'];
  }

  replaceSchemaWithFoldedAnyOf(schema, foldedSchema);

  return {
    branchRefs: objectBranches.map((branch) => requireBranchRef(branch, context.rulePath)),
    compositionKey: 'anyOf',
    kind: 'folded-object-anyof',
    objectBranchCount: objectBranches.length,
    path: context.rulePath,
  };
}

function assertAllPermissionsUsed(context: MergeContext): void {
  const unused = [...context.permissions.keys()].filter(
    (path) => !context.usedPermissions.has(path),
  );

  if (unused.length > 0) {
    throw new Error(
      `AnyOf folding has stale recursive merge permissions ${unused.sort().join(', ')}: ${context.rulePath}.`,
    );
  }
}

/** Replaces the approved anyOf while preserving annotation siblings on the target schema. */
function replaceSchemaWithFoldedAnyOf(
  schema: Record<string, unknown>,
  foldedSchema: Record<string, unknown>,
): void {
  const siblings = cloneJson(schema);

  for (const key of Object.keys(schema)) {
    delete schema[key];
  }

  Object.assign(schema, foldedSchema);

  for (const [key, value] of Object.entries(siblings)) {
    if (key !== 'anyOf' && schema[key] === undefined) {
      schema[key] = value;
    }
  }
}
