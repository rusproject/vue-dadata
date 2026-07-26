// Converts raw oasdiff full JSON into small report units. This is intentionally path-schema focused.
import { isRecord } from '../io.js';
import { escapeJsonPointerSegment } from '../json-pointer.js';

export interface DiffUnit {
  added?: unknown;
  from?: unknown;
  kind: string;
  location: string;
  mediaType?: string;
  method: string;
  path: string;
  removed?: unknown;
  side: 'request' | 'response';
  status?: string;
  to?: unknown;
}

interface SnapshotDiffUnit extends DiffUnit {
  required?: boolean;
}

export interface DiffUnitsByPathOperation {
  request: DiffUnit[];
  responses: Record<string, DiffUnit[]>;
  responseStatuses: DiffUnit[];
}

export type DiffUnitsByPath = Record<string, Record<string, DiffUnitsByPathOperation>>;

interface UnitContext {
  mediaType?: string;
  method: string;
  path: string;
  side: DiffUnit['side'];
  status?: string;
  units: DiffUnit[];
}

const IGNORED_ROOT_DIFF_KEYS = new Set([
  'components',
  'extensions',
  'externalDocs',
  'info',
  'tags',
]);
const IGNORED_PATH_DIFF_KEYS = new Set(['description', 'extensions', 'summary']);
const IGNORED_OPERATION_DIFF_KEYS = new Set([
  'description',
  'extensions',
  'externalDocs',
  'operationID',
  'summary',
  'tags',
]);
const IGNORED_REQUEST_BODY_DIFF_KEYS = new Set(['description', 'extensions']);
const IGNORED_RESPONSE_DIFF_KEYS = new Set(['description', 'extensions']);
const IGNORED_MEDIA_TYPE_DIFF_KEYS = new Set(['example', 'examples', 'extensions']);
const IGNORED_SCHEMA_DIFF_KEYS = new Set([
  'description',
  'example',
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

/** Builds deterministic path-level diff units from oasdiff full JSON output. */
export function buildDiffUnits(diff: Record<string, unknown>): DiffUnit[] {
  const units: DiffUnit[] = [];

  assertKnownKeys(diff, new Set(['paths', ...IGNORED_ROOT_DIFF_KEYS]), []);
  validateIgnoredRecordDiffs(diff, IGNORED_ROOT_DIFF_KEYS, []);

  const pathsDiff = getOptionalRecord(diff, 'paths', ['paths']);

  if (!pathsDiff) {
    return units;
  }

  assertKnownKeys(pathsDiff, new Set(['added', 'deleted', 'modified']), ['paths']);
  assertEmptyCollection(pathsDiff.added, ['paths', 'added'], 'added paths');
  assertEmptyCollection(pathsDiff.deleted, ['paths', 'deleted'], 'deleted paths');

  const paths = getOptionalRecord(pathsDiff, 'modified', ['paths', 'modified']);

  if (!paths) {
    return units;
  }

  for (const [path, pathDiffValue] of sortedRecordEntries(paths)) {
    const pathDiff = requireRecord(pathDiffValue, ['paths', 'modified', path]);

    assertKnownKeys(
      pathDiff,
      new Set(['operations', ...IGNORED_PATH_DIFF_KEYS]),
      ['paths', 'modified', path],
    );
    validateIgnoredRecordDiffs(pathDiff, IGNORED_PATH_DIFF_KEYS, ['paths', 'modified', path]);

    const operations = getOptionalRecord(pathDiff, 'operations', [
      'paths',
      'modified',
      path,
      'operations',
    ]);

    if (!operations) {
      continue;
    }

    assertKnownKeys(operations, new Set(['added', 'deleted', 'modified']), [
      'paths',
      'modified',
      path,
      'operations',
    ]);
    collectOperationUnits(
      operations.added,
      path,
      units,
      'operation-added',
      ['paths', 'modified', path, 'operations', 'added'],
    );
    collectOperationUnits(
      operations.deleted,
      path,
      units,
      'operation-deleted',
      ['paths', 'modified', path, 'operations', 'deleted'],
    );

    const modifiedOperations = getOptionalRecord(operations, 'modified', [
      'paths',
      'modified',
      path,
      'operations',
      'modified',
    ]);

    if (!modifiedOperations) {
      continue;
    }

    for (const [method, operationDiffValue] of sortedRecordEntries(modifiedOperations)) {
      const diffPath = ['paths', 'modified', path, 'operations', 'modified', method];
      const operationDiff = requireRecord(operationDiffValue, diffPath);

      assertKnownKeys(
        operationDiff,
        new Set(['requestBody', 'responses', ...IGNORED_OPERATION_DIFF_KEYS]),
        diffPath,
      );
      validateIgnoredRecordDiffs(operationDiff, IGNORED_OPERATION_DIFF_KEYS, diffPath);
      collectRequestBodyUnits(path, method, operationDiff, units, diffPath);
      collectResponseUnits(path, method, operationDiff, units, diffPath);
    }
  }

  return sortDiffUnits(units);
}

/** Groups flat diff units by OpenAPI path first, then lowercase method. */
export function buildDiffUnitsByPath(units: DiffUnit[]): DiffUnitsByPath {
  const grouped: DiffUnitsByPath = {};

  for (const unit of units) {
    const method = unit.method.toLowerCase();
    const pathGroup = (grouped[unit.path] ??= {});
    const operationGroup = (pathGroup[method] ??= {
      request: [],
      responses: {},
      responseStatuses: [],
    });

    if (unit.side === 'request') {
      operationGroup.request.push(unit);
      continue;
    }

    if (unit.kind === 'response-status-added' || unit.kind === 'response-status-deleted') {
      operationGroup.responseStatuses.push(unit);
      continue;
    }

    const status = unit.status ?? '<unknown>';

    (operationGroup.responses[status] ??= []).push(unit);
  }

  return sortDiffUnitsByPath(grouped);
}

/** Renders deterministic review-oriented lines while leaving raw diff units unchanged. */
export function renderDiffUnitSnapshot(units: DiffUnit[]): string {
  const lines = sortDiffUnits(coalesceDiffUnitsForSnapshot(units)).map(formatDiffUnitSnapshotLine);

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

/** Coalesces derivative requiredness changes into matching property add/delete units. */
function coalesceDiffUnitsForSnapshot(units: DiffUnit[]): SnapshotDiffUnit[] {
  const unitIdentities = new Set(units.map(getDiffUnitIdentity));

  return units.flatMap((unit): SnapshotDiffUnit[] => {
    const counterpartKind = getRequirednessCounterpartKind(unit.kind);

    if (!counterpartKind || !unitIdentities.has(getDiffUnitIdentity({ ...unit, kind: counterpartKind }))) {
      return [{ ...unit }];
    }

    return unit.kind === 'schema-property-added' || unit.kind === 'schema-property-deleted'
      ? [{ ...unit, required: true }]
      : [];
  });
}

/** Extracts request schema units from one operation diff. */
function collectRequestBodyUnits(
  path: string,
  method: string,
  operationDiff: Record<string, unknown>,
  units: DiffUnit[],
  operationDiffPath: string[],
): void {
  const requestBodyPath = [...operationDiffPath, 'requestBody'];
  const requestBody = getOptionalRecord(operationDiff, 'requestBody', requestBodyPath);

  if (!requestBody) {
    return;
  }

  assertKnownKeys(
    requestBody,
    new Set(['added', 'content', 'deleted', 'required', ...IGNORED_REQUEST_BODY_DIFF_KEYS]),
    requestBodyPath,
  );
  validateIgnoredRecordDiffs(requestBody, IGNORED_REQUEST_BODY_DIFF_KEYS, requestBodyPath);

  const context: UnitContext = {
    method,
    path,
    side: 'request',
    units,
  };

  collectTrueMarkerUnit(
    requestBody.added,
    context,
    'request-body-added',
    ['<requestBody>'],
    [...requestBodyPath, 'added'],
  );
  collectTrueMarkerUnit(
    requestBody.deleted,
    context,
    'request-body-deleted',
    ['<requestBody>'],
    [...requestBodyPath, 'deleted'],
  );
  collectFromToUnit(
    requestBody.required,
    context,
    'request-body-required-changed',
    ['<requestBody>'],
    [...requestBodyPath, 'required'],
  );

  if ('content' in requestBody) {
    collectContentUnits(requestBody.content, context, [...requestBodyPath, 'content']);
  }
}

/** Extracts response status and response schema units from one operation diff. */
function collectResponseUnits(
  path: string,
  method: string,
  operationDiff: Record<string, unknown>,
  units: DiffUnit[],
  operationDiffPath: string[],
): void {
  const responsesPath = [...operationDiffPath, 'responses'];
  const responses = getOptionalRecord(operationDiff, 'responses', responsesPath);

  if (!responses) {
    return;
  }

  assertKnownKeys(responses, new Set(['added', 'deleted', 'modified']), responsesPath);
  collectResponseStatusUnits(
    responses.added,
    path,
    method,
    units,
    'response-status-added',
    [...responsesPath, 'added'],
  );
  collectResponseStatusUnits(
    responses.deleted,
    path,
    method,
    units,
    'response-status-deleted',
    [...responsesPath, 'deleted'],
  );

  const modifiedResponses = getOptionalRecord(responses, 'modified', [...responsesPath, 'modified']);

  if (!modifiedResponses) {
    return;
  }

  for (const [status, responseDiffValue] of sortedRecordEntries(modifiedResponses)) {
    const responseDiffPath = [...responsesPath, 'modified', status];
    const responseDiff = requireRecord(responseDiffValue, responseDiffPath);

    assertKnownKeys(
      responseDiff,
      new Set(['content', ...IGNORED_RESPONSE_DIFF_KEYS]),
      responseDiffPath,
    );
    validateIgnoredRecordDiffs(responseDiff, IGNORED_RESPONSE_DIFF_KEYS, responseDiffPath);

    if ('content' in responseDiff) {
      collectContentUnits(
        responseDiff.content,
        {
          method,
          path,
          side: 'response',
          status,
          units,
        },
        [...responseDiffPath, 'content'],
      );
    }
  }
}

/** Extracts media-type and schema units from one request or response content diff. */
function collectContentUnits(value: unknown, context: UnitContext, diffPath: string[]): void {
  const content = requireRecord(value, diffPath);

  assertKnownKeys(content, new Set(['added', 'deleted', 'modified']), diffPath);

  for (const mediaType of requireCollectionItems(content.added, [...diffPath, 'added'])) {
    pushUnit(
      { ...context, mediaType: String(mediaType) },
      'media-type-added',
      ['<content>'],
    );
  }

  for (const mediaType of requireCollectionItems(content.deleted, [...diffPath, 'deleted'])) {
    pushUnit(
      { ...context, mediaType: String(mediaType) },
      'media-type-deleted',
      ['<content>'],
    );
  }

  const modifiedContent = getOptionalRecord(content, 'modified', [...diffPath, 'modified']);

  if (!modifiedContent) {
    return;
  }

  for (const [mediaType, mediaTypeDiffValue] of sortedRecordEntries(modifiedContent)) {
    const mediaTypeDiffPath = [...diffPath, 'modified', mediaType];
    const mediaTypeDiff = requireRecord(mediaTypeDiffValue, mediaTypeDiffPath);

    assertKnownKeys(
      mediaTypeDiff,
      new Set(['schema', ...IGNORED_MEDIA_TYPE_DIFF_KEYS]),
      mediaTypeDiffPath,
    );
    validateIgnoredRecordDiffs(mediaTypeDiff, IGNORED_MEDIA_TYPE_DIFF_KEYS, mediaTypeDiffPath);

    if ('schema' in mediaTypeDiff) {
      collectSchemaUnits(
        mediaTypeDiff.schema,
        [],
        { ...context, mediaType },
        [...mediaTypeDiffPath, 'schema'],
      );
    }
  }
}

/** Walks a schema diff subtree and emits contract-level units. */
function collectSchemaUnits(
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

  collectTrueMarkerUnit(
    schemaDiff.schemaAdded,
    context,
    'schema-added',
    location,
    [...diffPath, 'schemaAdded'],
  );
  collectTrueMarkerUnit(
    schemaDiff.schemaDeleted,
    context,
    'schema-deleted',
    location,
    [...diffPath, 'schemaDeleted'],
  );
  collectTrueMarkerUnit(
    schemaDiff.circularRef,
    context,
    'schema-circular-ref-changed',
    location,
    [...diffPath, 'circularRef'],
  );

  collectAddedRemovedUnit(
    schemaDiff.type,
    context,
    'schema-type-changed',
    location,
    [...diffPath, 'type'],
  );
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
    collectFromToUnit(
      schemaDiff[key],
      context,
      `schema-${key}-changed`,
      location,
      [...diffPath, key],
    );
  }

  for (const key of SCHEMA_NESTED_DIFF_KEYS) {
    if (key in schemaDiff) {
      collectSchemaUnits(
        schemaDiff[key],
        [...location, key],
        context,
        [...diffPath, key],
      );
    }
  }

  for (const key of SCHEMA_COMPOSITION_DIFF_KEYS) {
    collectCompositionUnits(
      schemaDiff[key],
      context,
      location,
      key,
      [...diffPath, key],
    );
  }
}

/** Emits added/deleted operation units from collection diffs. */
function collectOperationUnits(
  value: unknown,
  path: string,
  units: DiffUnit[],
  kind: string,
  diffPath: string[],
): void {
  for (const method of requireCollectionItems(value, diffPath)) {
    units.push({
      kind,
      location: '<operation>',
      method: String(method).toUpperCase(),
      path,
      side: 'request',
    });
  }
}

/** Emits added/deleted response status units from collection diffs. */
function collectResponseStatusUnits(
  value: unknown,
  path: string,
  method: string,
  units: DiffUnit[],
  kind: string,
  diffPath: string[],
): void {
  for (const status of requireCollectionItems(value, diffPath)) {
    units.push({
      kind,
      location: '<response>',
      method,
      path,
      side: 'response',
      status: String(status),
    });
  }
}

/** Emits schema property added/deleted units and recurses into modified properties. */
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
    collectSchemaUnits(
      propertyDiff,
      [...location, propertyName],
      context,
      [...diffPath, 'modified', propertyName],
    );
  }
}

/** Emits required property added/deleted units. */
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

/** Emits whole-enum or per-value units without losing enum constraint identity. */
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

    pushUnit(context, 'schema-enum-added', location, {
      added,
    });
    return;
  }

  if (enumDeleted) {
    if (removed.length === 0 || added.length > 0) {
      throw new Error(
        `Invalid oasdiff enum deletion at ${formatDiffPath(diffPath)}: expected deleted values and no added values.`,
      );
    }

    pushUnit(context, 'schema-enum-deleted', location, {
      removed,
    });
    return;
  }

  for (const enumValue of added) {
    pushUnit(context, 'schema-enum-value-added', location, {
      added: enumValue,
    });
  }

  for (const enumValue of removed) {
    pushUnit(context, 'schema-enum-value-deleted', location, {
      removed: enumValue,
    });
  }
}

/** Emits composition membership changes and recurses into modified branches. */
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

/** Recurses into oasdiff's matched composition-branch array representation. */
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

/** Emits one unit for a scalar `{ from, to }` diff. */
function collectFromToUnit(
  value: unknown,
  context: UnitContext,
  kind: string,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const valueDiff = requireRecord(value, diffPath);

  assertKnownKeys(valueDiff, new Set(['from', 'to']), diffPath);

  if (!('from' in valueDiff) || !('to' in valueDiff)) {
    throw new Error(
      `Invalid oasdiff value diff at ${formatDiffPath(diffPath)}: expected both "from" and "to".`,
    );
  }

  pushUnit(context, kind, location, {
    from: valueDiff.from,
    to: valueDiff.to,
  });
}

/** Emits one unit for an added/deleted collection diff. */
function collectAddedRemovedUnit(
  value: unknown,
  context: UnitContext,
  kind: string,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  const collectionDiff = requireRecord(value, diffPath);

  assertKnownKeys(collectionDiff, new Set(['added', 'deleted']), diffPath);

  const added = requireCollectionItems(collectionDiff.added, [...diffPath, 'added']);
  const removed = requireCollectionItems(collectionDiff.deleted, [...diffPath, 'deleted']);

  if (added.length === 0 && removed.length === 0) {
    throw new Error(
      `Invalid oasdiff collection diff at ${formatDiffPath(diffPath)}: expected added or deleted items.`,
    );
  }

  pushUnit(context, kind, location, {
    added,
    removed,
  });
}

/** Emits a marker unit only when oasdiff supplies the expected literal true. */
function collectTrueMarkerUnit(
  value: unknown,
  context: UnitContext,
  kind: string,
  location: string[],
  diffPath: string[],
): void {
  if (value === undefined) {
    return;
  }

  if (value !== true) {
    throw new Error(
      `Invalid oasdiff marker at ${formatDiffPath(diffPath)}: expected true, received ${JSON.stringify(value)}.`,
    );
  }

  pushUnit(context, kind, location);
}

/** Adds a normalized unit to the current collection. */
function pushUnit(
  context: UnitContext,
  kind: string,
  location: string[],
  extra: Partial<Pick<DiffUnit, 'added' | 'from' | 'removed' | 'to'>> = {},
): void {
  const unit: DiffUnit = {
    kind,
    location: formatLocation(location),
    mediaType: context.mediaType,
    method: context.method.toUpperCase(),
    path: context.path,
    side: context.side,
    status: context.status,
  };

  Object.assign(unit, extra);
  context.units.push(unit);
}

/** Returns object entries sorted by key for deterministic output. */
function sortedRecordEntries(value: Record<string, unknown>): [string, unknown][] {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

/** Returns an optional record field and rejects malformed present values. */
function getOptionalRecord(
  parent: Record<string, unknown>,
  key: string,
  diffPath: string[],
): Record<string, unknown> | null {
  return key in parent ? requireRecord(parent[key], diffPath) : null;
}

/** Requires an oasdiff object at the given JSON path. */
function requireRecord(value: unknown, diffPath: string[]): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(
      `Invalid oasdiff structure at ${formatDiffPath(diffPath)}: expected an object.`,
    );
  }

  return value;
}

/** Requires an optional oasdiff collection to be an array. */
function requireCollectionItems(value: unknown, diffPath: string[]): unknown[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid oasdiff collection at ${formatDiffPath(diffPath)}: expected an array.`,
    );
  }

  return value;
}

/** Rejects nonempty path additions/deletions that Stage A should have prevented. */
function assertEmptyCollection(value: unknown, diffPath: string[], description: string): void {
  const items = requireCollectionItems(value, diffPath);

  if (items.length > 0) {
    throw new Error(
      `Unsupported ${description} at ${formatDiffPath(diffPath)}: ${JSON.stringify(items)}.`,
    );
  }
}

/** Rejects every unknown or unsupported key at a traversed oasdiff layer. */
function assertKnownKeys(
  value: Record<string, unknown>,
  knownKeys: ReadonlySet<string>,
  diffPath: string[],
): void {
  const unknownKeys = Object.keys(value).filter((key) => !knownKeys.has(key)).sort();

  if (unknownKeys.length > 0) {
    throw new Error(
      `Unsupported oasdiff key(s) at ${formatDiffPath(diffPath)}: ${unknownKeys.join(', ')}.`,
    );
  }
}

/** Validates ignored annotation diffs as records while intentionally not traversing them. */
function validateIgnoredRecordDiffs(
  value: Record<string, unknown>,
  ignoredKeys: ReadonlySet<string>,
  diffPath: string[],
): void {
  for (const key of ignoredKeys) {
    if (key in value) {
      requireRecord(value[key], [...diffPath, key]);
    }
  }
}

/** Parses an optional bool marker that must be the literal true when present. */
function getOptionalTrueMarker(
  value: Record<string, unknown>,
  key: string,
  diffPath: string[],
): boolean {
  if (!(key in value)) {
    return false;
  }

  if (value[key] !== true) {
    throw new Error(
      `Invalid oasdiff marker at ${formatDiffPath(diffPath)}: expected true, received ${JSON.stringify(value[key])}.`,
    );
  }

  return true;
}

/** Formats an oasdiff JSON path as a canonical JSON Pointer. */
function formatDiffPath(diffPath: string[]): string {
  return `/${diffPath.map(escapeJsonPointerSegment).join('/')}`;
}

/** Formats a schema location with the same compact style as the old breaking output. */
function formatLocation(location: string[]): string {
  return location.length === 0 ? '<schema>' : location.join('/');
}

/** Sorts units so JSON artifacts and report samples are stable. */
function sortDiffUnits(units: DiffUnit[]): DiffUnit[] {
  return units.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.method.localeCompare(right.method) ||
      left.side.localeCompare(right.side) ||
      (left.status ?? '').localeCompare(right.status ?? '') ||
      left.location.localeCompare(right.location) ||
      left.kind.localeCompare(right.kind) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

/** Maps property and requiredness kinds to their coalescing counterpart. */
function getRequirednessCounterpartKind(kind: string): string | null {
  if (kind === 'schema-property-added') {
    return 'schema-required-added';
  }

  if (kind === 'schema-property-deleted') {
    return 'schema-required-deleted';
  }

  if (kind === 'schema-required-added') {
    return 'schema-property-added';
  }

  return kind === 'schema-required-deleted' ? 'schema-property-deleted' : null;
}

/** Builds a stable complete identity for one diff unit. */
function getDiffUnitIdentity(unit: DiffUnit): string {
  return JSON.stringify(canonicalizeSnapshotValue(unit));
}

/** Sorts grouped units so the path-first JSON artifact is stable. */
function sortDiffUnitsByPath(grouped: DiffUnitsByPath): DiffUnitsByPath {
  const sorted: DiffUnitsByPath = {};

  for (const path of Object.keys(grouped).sort((left, right) => left.localeCompare(right))) {
    const methods = grouped[path] ?? {};
    sorted[path] = {};

    for (const method of Object.keys(methods).sort((left, right) => left.localeCompare(right))) {
      const operation = methods[method] ?? {
        request: [],
        responses: {},
        responseStatuses: [],
      };
      const responses: Record<string, DiffUnit[]> = {};

      for (const status of Object.keys(operation.responses).sort((left, right) => left.localeCompare(right))) {
        responses[status] = sortDiffUnits([...operation.responses[status]]);
      }

      sorted[path][method] = {
        request: sortDiffUnits([...operation.request]),
        responses,
        responseStatuses: sortDiffUnits([...operation.responseStatuses]),
      };
    }
  }

  return sorted;
}

/** Formats one diff unit as a stable single-line snapshot record. */
function formatDiffUnitSnapshotLine(unit: SnapshotDiffUnit): string {
  return [
    unit.path,
    unit.method,
    unit.side,
    unit.status,
    unit.mediaType,
    unit.location,
    unit.kind,
    ...formatDiffUnitValueFields(unit),
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');
}

/** Formats changed value fields in a fixed order. */
function formatDiffUnitValueFields(unit: DiffUnit): string[] {
  const fields: string[] = [];

  appendDiffUnitValueField(fields, unit, 'added');
  appendDiffUnitValueField(fields, unit, 'removed');
  appendDiffUnitValueField(fields, unit, 'from');
  appendDiffUnitValueField(fields, unit, 'to');

  if ('required' in unit) {
    fields.push(`required=${String(unit.required)}`);
  }

  return fields;
}

/** Appends a value field only when the unit explicitly contains that property. */
function appendDiffUnitValueField(
  fields: string[],
  unit: DiffUnit,
  key: 'added' | 'from' | 'removed' | 'to',
): void {
  if (Object.prototype.hasOwnProperty.call(unit, key)) {
    fields.push(`${key}=${stringifySnapshotValue(unit[key])}`);
  }
}

/** Stringifies values after recursively sorting unordered collections from oasdiff. */
function stringifySnapshotValue(value: unknown): string {
  return JSON.stringify(canonicalizeSnapshotValue(value));
}

/** Canonicalizes values for stable one-line snapshots. */
function canonicalizeSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeSnapshotValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    sorted[key] = canonicalizeSnapshotValue(child);
  }

  return sorted;
}
