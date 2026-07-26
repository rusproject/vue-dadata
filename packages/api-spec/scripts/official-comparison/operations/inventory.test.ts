import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compareOperationInventory } from './inventory.ts';
import type {
  OfficialOperationInventory,
  OfficialTemplateOperationRecord,
  OperationRecord,
} from './types.ts';

const FAMILY = {
  family: 'test',
  officialPathPrefix: '/api',
};

describe('compareOperationInventory', () => {
  it('requires every official template to have an explicit concrete expansion', () => {
    const template = templateOperation('/suggest/{name}', '/suggest/');
    const official: OfficialOperationInventory = {
      concrete: new Map(),
      templates: [template],
    };

    const result = compareOperationInventory(
      official,
      new Map(),
      { extensions: [], templateExpansions: [] },
      FAMILY,
    );

    assert.deepEqual(result.issues, [
      'Official template has no explicit concrete expansion: POST /suggest/{name}',
    ]);
  });

  it('accepts a template only when its concrete operation and mapping agree', () => {
    const template = templateOperation('/suggest/{name}', '/suggest/');
    const ours = operation('/suggest/address', 'post');
    const official: OfficialOperationInventory = {
      concrete: new Map(),
      templates: [template],
    };

    const result = compareOperationInventory(
      official,
      new Map([['post:/suggest/address', ours]]),
      {
        extensions: [],
        templateExpansions: [
          {
            official: { pathTemplate: '/suggest/{name}', method: 'post' },
            our: { path: '/suggest/address', method: 'post' },
          },
        ],
      },
      FAMILY,
    );

    assert.deepEqual(result.issues, []);
    assert.equal(result.units.length, 1);
    assert.equal(result.units[0]?.kind, 'template-expansion');
  });
});

function operation(path: string, method: 'get' | 'post'): OperationRecord {
  return {
    path,
    method,
    operation: { responses: {} } as OpenAPIV3_1.OperationObject,
    requestRef: null,
    responseRef: null,
  };
}

function templateOperation(path: string, prefix: string): OfficialTemplateOperationRecord {
  return {
    ...operation(path, 'post'),
    prefix,
  };
}
