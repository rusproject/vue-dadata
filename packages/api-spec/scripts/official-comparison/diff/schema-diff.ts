// Parses schema-level oasdiff JSON. Unknown keys fail closed instead of disappearing.
import {
  collectAddedRemovedUnit,
  collectFromToUnit,
  collectTrueMarkerUnit,
  pushUnit,
} from './emit.ts';
import {
  assertKnownKeys,
  formatDiffPath,
  getOptionalRecord,
  getOptionalTrueMarker,
  requireCollectionItems,
  requireRecord,
  sortedRecordEntries,
  validateIgnoredRecordDiffs,
} from './oasdiff-shape.ts';
import type { UnitContext } from './types.ts';

const IGNORED_SCHEMA_DIFF_KEYS = new Set([
  'description',
  'example',
  'examples',
  'extensions',
  'externalDocs',
  'title',
]);

const SCHEMA_VALUE_DIFF_KEYS = new Set([
  'additionalPropertiesAllowed',
  'default',
  'format',
  'max',
  'maxItems',
  'maxLength',
  'maximum',
  'min',
  'minItems',
  'minLength',
  'minimum',
  'pattern',
]);

const SCHEMA_NESTED_DIFF_KEYS = new Set(['additionalProperties', 'items', 'not']);
const SCHEMA_COMPOSITION_DIFF_KEYS = new Set(['allOf', 'anyOf', 'oneOf']);

export function collectSchemaUnits(
  value: unknown,
  location: string[],
  context: UnitContext,
  diffPath: string[],
): void {
  const schemaDiff = requireRecord(value, diffPath);

  assertKnownKeys(
    schemaDiff,
    new Set([
      'circularRef',
      'enum',
      'listOfTypes',
      'properties',
      'required',
      'schemaAdded',
      'schemaDeleted',
      'type',
      ...IGNORED_SCHEMA_DIFF_KEYS,
      ...SCHEMA_COMPOSITION_DIFF_KEYS,
      ...SCHEMA_NESTED_DIFF_KEYS,
      ...SCHEMA_VALUE_DIFF_KEYS,
    ]),
    diffPath,
  );
  validateIgnoredRecordDiffs(schemaDiff, IGNORED_SCHEMA_DIFF_KEYS, diffPath);

  collectTrueMarkerUnit(schemaDiff.schemaAdded, context, 'schema-added', location, [
    ...diffPath,
    'schemaAdded',
  ]);
  collectTrueMarkerUnit(schemaDiff.schemaDeleted, context, 'schema-deleted', location, [
    ...diffPath,
    'schemaDeleted',
  ]);
  collectTrueMarkerUnit(schemaDiff.circularRef, context, 'schema-circular-ref-changed', location, [
    ...diffPath,
    'circularRef',
  ]);
  collectAddedRemovedUnit(schemaDiff.type, context, 'schema-type-changed', location, [
    ...diffPath,
    'type',
  ]);
  collectAddedRemovedUnit(
    schemaDiff.listOfTypes,
    context,
    'schema-composition-types-changed',
    location,
    [...diffPath, 'listOfTypes'],
  );
  collectEnumUnits(schemaDiff.enum, context, location, [...diffPath, 'enum']);
  collectRequiredUnits(schemaDiff.required, context, location, [...diffPath, 'required']);
  collectPropertyUnits(schemaDiff.properties, context, location, [...diffPath, 'properties']);

  for (const key of SCHEMA_VALUE_DIFF_KEYS) {
    collectFromToUnit(schemaDiff[key], context, `schema-${key}-changed`, location, [
      ...diffPath,
      key,
    ]);
  }

  for (const key of SCHEMA_NESTED_DIFF_KEYS) {
    if (key in schemaDiff) {
      collectSchemaUnits(schemaDiff[key], [...location, key], context, [...diffPath, key]);
    }
  }

  for (const key of SCHEMA_COMPOSITION_DIFF_KEYS) {
    collectCompositionUnits(schemaDiff[key], context, location, key, [...diffPath, key]);
  }
}

function collectPropertyUnits(
  value: unknown,
  context: UnitContext,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const properties = requireRecord(value, diffPath);

  assertKnownKeys(properties, new Set(['added', 'deleted', 'modified']), diffPath);

  for (const propertyName of requireCollectionItems(properties.added, [...diffPath, 'added'])) {
    pushUnit(context, 'schema-property-added', [...location, String(propertyName)], {
      added: propertyName,
    });
  }

  for (const propertyName of requireCollectionItems(properties.deleted, [...diffPath, 'deleted'])) {
    pushUnit(context, 'schema-property-deleted', [...location, String(propertyName)], {
      removed: propertyName,
    });
  }

  const modified = getOptionalRecord(properties, 'modified', [...diffPath, 'modified']);

  if (!modified) {
    return;
  }

  for (const [propertyName, propertyDiff] of sortedRecordEntries(modified)) {
    collectSchemaUnits(propertyDiff, [...location, propertyName], context, [
      ...diffPath,
      'modified',
      propertyName,
    ]);
  }
}

function collectRequiredUnits(
  value: unknown,
  context: UnitContext,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const required = requireRecord(value, diffPath);

  assertKnownKeys(required, new Set(['added', 'deleted']), diffPath);

  for (const propertyName of requireCollectionItems(required.added, [...diffPath, 'added'])) {
    pushUnit(context, 'schema-required-added', [...location, String(propertyName)], {
      added: propertyName,
    });
  }

  for (const propertyName of requireCollectionItems(required.deleted, [...diffPath, 'deleted'])) {
    pushUnit(context, 'schema-required-deleted', [...location, String(propertyName)], {
      removed: propertyName,
    });
  }
}

function collectEnumUnits(
  value: unknown,
  context: UnitContext,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const enumDiff = requireRecord(value, diffPath);

  assertKnownKeys(enumDiff, new Set(['added', 'deleted', 'enumAdded', 'enumDeleted']), diffPath);

  const added = requireCollectionItems(enumDiff.added, [...diffPath, 'added']);
  const removed = requireCollectionItems(enumDiff.deleted, [...diffPath, 'deleted']);
  const enumAdded = getOptionalTrueMarker(enumDiff, 'enumAdded', [...diffPath, 'enumAdded']);
  const enumDeleted = getOptionalTrueMarker(enumDiff, 'enumDeleted', [...diffPath, 'enumDeleted']);

  if (enumAdded && enumDeleted) {
    throw new Error(
      `Invalid oasdiff enum diff at ${formatDiffPath(diffPath)}: enumAdded and enumDeleted cannot both be true.`,
    );
  }

  if (enumAdded) {
    if (added.length === 0 || removed.length > 0) {
      throw new Error(
        `Invalid oasdiff enum addition at ${formatDiffPath(diffPath)}: expected added values and no deleted values.`,
      );
    }

    pushUnit(context, 'schema-enum-added', location, { added });
    return;
  }

  if (enumDeleted) {
    if (removed.length === 0 || added.length > 0) {
      throw new Error(
        `Invalid oasdiff enum deletion at ${formatDiffPath(diffPath)}: expected deleted values and no added values.`,
      );
    }

    pushUnit(context, 'schema-enum-deleted', location, { removed });
    return;
  }

  for (const enumValue of added) {
    pushUnit(context, 'schema-enum-value-added', location, { added: enumValue });
  }

  for (const enumValue of removed) {
    pushUnit(context, 'schema-enum-value-deleted', location, { removed: enumValue });
  }
}

function collectCompositionUnits(
  value: unknown,
  context: UnitContext,
  location: string[],
  composition: string,
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const compositionDiff = requireRecord(value, diffPath);

  assertKnownKeys(compositionDiff, new Set(['added', 'deleted', 'modified']), diffPath);

  const added = requireCollectionItems(compositionDiff.added, [...diffPath, 'added']);
  const removed = requireCollectionItems(compositionDiff.deleted, [...diffPath, 'deleted']);

  if (added.length > 0 || removed.length > 0) {
    pushUnit(context, `schema-${composition}-changed`, [...location, composition], {
      added,
      removed,
    });
  }

  const modified = compositionDiff.modified;

  if (modified === undefined) {
    return;
  }

  if (Array.isArray(modified)) {
    collectMatchedCompositionBranchUnits(modified, context, location, composition, diffPath);
    return;
  }

  const modifiedRecord = requireRecord(modified, [...diffPath, 'modified']);

  for (const [branch, child] of sortedRecordEntries(modifiedRecord)) {
    collectSchemaUnits(child, [...location, composition, branch], context, [
      ...diffPath,
      'modified',
      branch,
    ]);
  }
}

function collectMatchedCompositionBranchUnits(
  modified: unknown[],
  context: UnitContext,
  location: string[],
  composition: string,
  diffPath: string[],
): void {
  for (const [index, value] of modified.entries()) {
    const entryPath = [...diffPath, 'modified', String(index)];
    const entry = requireRecord(value, entryPath);

    assertKnownKeys(entry, new Set(['base', 'diff', 'revision']), entryPath);

    if (!('base' in entry) || !('diff' in entry) || !('revision' in entry)) {
      throw new Error(
        `Invalid oasdiff matched composition branch at ${formatDiffPath(entryPath)}: expected base, diff, and revision.`,
      );
    }

    const base = requireCompositionBranchDescriptor(entry.base, [...entryPath, 'base']);
    const revision = requireCompositionBranchDescriptor(entry.revision, [...entryPath, 'revision']);

    if (!base.component || !revision.component || base.component !== revision.component) {
      throw new Error(
        `Unsupported oasdiff matched composition branches at ${formatDiffPath(entryPath)}: expected the same named component on both sides.`,
      );
    }

    collectSchemaUnits(entry.diff, [...location, composition, base.component], context, [
      ...entryPath,
      'diff',
    ]);
  }
}

function requireCompositionBranchDescriptor(
  value: unknown,
  diffPath: string[],
): { component?: string; index: number } {
  const descriptor = requireRecord(value, diffPath);

  assertKnownKeys(descriptor, new Set(['component', 'index']), diffPath);

  if (!Number.isInteger(descriptor.index) || (descriptor.index as number) < 0) {
    throw new Error(
      `Invalid oasdiff composition branch at ${formatDiffPath(diffPath)}: expected a non-negative integer index.`,
    );
  }

  if (
    'component' in descriptor &&
    (typeof descriptor.component !== 'string' || descriptor.component.length === 0)
  ) {
    throw new Error(
      `Invalid oasdiff composition branch at ${formatDiffPath(diffPath)}: component must be a non-empty string.`,
    );
  }

  return descriptor as { component?: string; index: number };
}
