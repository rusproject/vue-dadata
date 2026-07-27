// Parses request bodies, response statuses, media types, and their schemas.
import { collectFromToUnit, collectTrueMarkerUnit, pushUnit } from './emit.ts';
import {
  assertKnownKeys,
  getOptionalRecord,
  requireCollectionItems,
  requireRecord,
  sortedRecordEntries,
  validateIgnoredRecordDiffs,
} from './oasdiff-shape.ts';
import { collectSchemaUnits } from './schema-diff.ts';
import type { DiffUnit, UnitContext } from './types.ts';

const IGNORED_REQUEST_BODY_DIFF_KEYS = new Set(['description', 'extensions']);
const IGNORED_RESPONSE_DIFF_KEYS = new Set(['description', 'extensions']);
const IGNORED_MEDIA_TYPE_DIFF_KEYS = new Set(['example', 'examples', 'extensions']);

export function collectOperationDiffUnits(
  path: string,
  method: string,
  operationDiff: Record<string, unknown>,
  units: DiffUnit[],
  diffPath: string[],
): void {
  collectRequestBodyUnits(path, method, operationDiff, units, diffPath);
  collectResponseUnits(path, method, operationDiff, units, diffPath);
}

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

  const context: UnitContext = { method, path, scope: 'request', units };

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
  collectResponseStatusUnits(responses.added, path, method, units, 'response-status-added', [
    ...responsesPath,
    'added',
  ]);
  collectResponseStatusUnits(responses.deleted, path, method, units, 'response-status-deleted', [
    ...responsesPath,
    'deleted',
  ]);

  const modifiedResponses = getOptionalRecord(responses, 'modified', [
    ...responsesPath,
    'modified',
  ]);

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
        { method, path, scope: 'response', status, units },
        [...responseDiffPath, 'content'],
      );
    }
  }
}

function collectContentUnits(value: unknown, context: UnitContext, diffPath: string[]): void {
  const content = requireRecord(value, diffPath);

  assertKnownKeys(content, new Set(['added', 'deleted', 'modified']), diffPath);

  for (const mediaType of requireCollectionItems(content.added, [...diffPath, 'added'])) {
    pushUnit({ ...context, mediaType: String(mediaType) }, 'media-type-added', ['<content>']);
  }

  for (const mediaType of requireCollectionItems(content.deleted, [...diffPath, 'deleted'])) {
    pushUnit({ ...context, mediaType: String(mediaType) }, 'media-type-deleted', ['<content>']);
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
      collectSchemaUnits(mediaTypeDiff.schema, [], { ...context, mediaType }, [
        ...mediaTypeDiffPath,
        'schema',
      ]);
    }
  }
}

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
      scope: 'response',
      status: String(status),
    });
  }
}
