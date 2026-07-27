import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type DiffUnit, buildDiffUnitsByPath, renderDiffUnitSnapshot } from './diff-units.ts';

const baseUnit = {
  location: 'suggestions/items/data/geo_lat',
  mediaType: 'application/json',
  method: 'POST',
  path: '/suggest/metro',
  scope: 'response',
  status: '200',
} satisfies Omit<DiffUnit, 'kind'>;

describe('buildDiffUnitsByPath', () => {
  it('keeps operation-presence differences separate from request-contract differences', () => {
    const operationUnit: DiffUnit = {
      kind: 'operation-added',
      location: '<operation>',
      method: 'POST',
      path: '/test',
      scope: 'operation',
    };
    const requestUnit: DiffUnit = {
      kind: 'request-body-added',
      location: '<requestBody>',
      method: 'POST',
      path: '/test',
      scope: 'request',
    };

    assert.deepEqual(buildDiffUnitsByPath([requestUnit, operationUnit]), {
      '/test': {
        post: {
          operation: [operationUnit],
          request: [requestUnit],
          responses: {},
          responseStatuses: [],
        },
      },
    });
  });
});

describe('renderDiffUnitSnapshot', () => {
  it('coalesces property additions and deletions with matching requiredness changes', () => {
    const units: DiffUnit[] = [
      {
        ...baseUnit,
        added: 'geo_lat',
        kind: 'schema-property-added',
      },
      {
        ...baseUnit,
        added: 'geo_lat',
        kind: 'schema-required-added',
      },
      {
        ...baseUnit,
        location: 'suggestions/items/data/old_field',
        kind: 'schema-property-deleted',
        removed: 'old_field',
      },
      {
        ...baseUnit,
        location: 'suggestions/items/data/old_field',
        kind: 'schema-required-deleted',
        removed: 'old_field',
      },
    ];

    assert.equal(
      renderDiffUnitSnapshot(units),
      [
        '/suggest/metro POST response 200 application/json suggestions/items/data/geo_lat schema-property-added added="geo_lat" required=true',
        '/suggest/metro POST response 200 application/json suggestions/items/data/old_field schema-property-deleted removed="old_field" required=true',
        '',
      ].join('\n'),
    );
  });

  it('keeps standalone requiredness changes as separate review lines', () => {
    const unit: DiffUnit = {
      ...baseUnit,
      added: 'geo_lat',
      kind: 'schema-required-added',
    };

    assert.equal(
      renderDiffUnitSnapshot([unit]),
      '/suggest/metro POST response 200 application/json suggestions/items/data/geo_lat schema-required-added added="geo_lat"\n',
    );
  });
});
