// Locks the permitted union folds and rejects structural drift.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { OFFICIAL_FAMILY_CONFIGS } from '../family-config.ts';
import { type AnyOfFoldingRule, applyAnyOfFoldingRules } from './anyof-folding.ts';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

function buildDocument(): OpenAPIV3_1.Document {
  return {
    openapi: '3.1.1',
    info: { title: 'test', version: '0' },
    paths: {
      '/test': {
        post: {
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: ref('Root'),
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Root: {
          anyOf: [ref('RootA'), ref('RootB')],
        },
        RootA: {
          type: 'object',
          properties: {
            list: { type: 'array', items: ref('ItemA') },
            onlyRootA: { type: 'string' },
          },
          required: ['list', 'onlyRootA'],
        },
        RootB: {
          type: 'object',
          properties: {
            list: { type: 'array', items: ref('ItemB') },
            onlyRootB: { type: 'string' },
          },
          required: ['list'],
        },
        ItemA: {
          type: 'object',
          properties: {
            data: ref('DataA'),
            value: { type: 'string' },
          },
          required: ['data', 'value'],
        },
        ItemB: {
          type: 'object',
          properties: {
            data: ref('DataB'),
            value: { type: 'string' },
          },
          required: ['data', 'value'],
        },
        DataA: {
          type: 'object',
          properties: {
            aOnly: { type: 'string' },
            shared: { type: 'string' },
          },
          required: ['aOnly', 'shared'],
        },
        DataB: {
          type: 'object',
          properties: {
            bOnly: { type: 'string' },
            shared: { type: 'string' },
          },
          required: ['shared'],
        },
      },
    },
  };
}

function buildRule(): AnyOfFoldingRule {
  return {
    target: 'ours',
    operation: { method: 'post', path: '/test' },
    response: { mediaType: 'application/json', status: '200' },
    schemaPath: '',
    expectedNullBranch: false,
    expectedObjectBranches: [
      {
        ref: '#/components/schemas/RootA',
        onlyProperties: ['onlyRootA'],
        onlyRequired: ['onlyRootA'],
      },
      {
        ref: '#/components/schemas/RootB',
        onlyProperties: ['onlyRootB'],
        onlyRequired: [],
      },
    ],
    allowedRecursiveMerges: [
      {
        schemaPath: 'properties/list',
        kind: 'array',
        expectedBranchCount: 2,
        expectedBranchRefs: [],
      },
      {
        schemaPath: 'properties/list/items',
        kind: 'object',
        expectedBranchRefs: ['#/components/schemas/ItemA', '#/components/schemas/ItemB'],
        expectedObjectBranches: [
          { ref: '#/components/schemas/ItemA', onlyProperties: [], onlyRequired: [] },
          { ref: '#/components/schemas/ItemB', onlyProperties: [], onlyRequired: [] },
        ],
      },
      {
        schemaPath: 'properties/list/items/properties/data',
        kind: 'object',
        expectedBranchRefs: ['#/components/schemas/DataA', '#/components/schemas/DataB'],
        expectedObjectBranches: [
          { ref: '#/components/schemas/DataA', onlyProperties: ['aOnly'], onlyRequired: ['aOnly'] },
          { ref: '#/components/schemas/DataB', onlyProperties: ['bOnly'], onlyRequired: [] },
        ],
      },
    ],
  };
}

function responseSchema(document: OpenAPIV3_1.Document): Record<string, unknown> {
  return document.paths?.['/test']?.post?.responses?.['200'] &&
    'content' in document.paths['/test'].post.responses['200']
    ? (document.paths['/test'].post.responses['200'].content?.['application/json']
        ?.schema as Record<string, unknown>)
    : {};
}

describe('applyAnyOfFoldingRules', () => {
  it('keeps every configured fold valid against the current generated spec', () => {
    const document = JSON.parse(
      readFileSync(resolve('dadata.json'), 'utf8'),
    ) as OpenAPIV3_1.Document;
    const curation = OFFICIAL_FAMILY_CONFIGS.suggestions.comparison;

    const decisions = applyAnyOfFoldingRules(
      document,
      curation.anyOfFolding.filter((rule) => rule.target === 'ours'),
    );

    assert.deepEqual(
      decisions.map((decision) => decision.path),
      [
        'POST /suggest/address response 200 application/json',
        'POST /geolocate/address response 200 application/json',
        'POST /findById/address response 200 application/json',
        'POST /iplocate/address response 200 application/json properties/location',
      ],
    );
  });

  it('recursively folds only the explicitly described branch differences', () => {
    const document = buildDocument();

    applyAnyOfFoldingRules(document, [buildRule()]);

    assert.deepEqual(responseSchema(document), {
      type: 'object',
      properties: {
        list: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  aOnly: { type: 'string' },
                  bOnly: { type: 'string' },
                  shared: { type: 'string' },
                },
                required: ['shared'],
              },
              value: { type: 'string' },
            },
            required: ['data', 'value'],
          },
        },
        onlyRootA: { type: 'string' },
        onlyRootB: { type: 'string' },
      },
      required: ['list'],
    });
  });

  it('rejects a new branch-only property', () => {
    const document = buildDocument();
    const dataB = document.components?.schemas?.DataB as OpenAPIV3_1.SchemaObject;

    dataB.properties = { ...dataB.properties, unexpected: { type: 'string' } };

    assert.throws(
      () => applyAnyOfFoldingRules(document, [buildRule()]),
      /unexpected branch-only properties for #\/components\/schemas\/DataB/,
    );
  });

  it('rejects an unapproved shared-property divergence', () => {
    const document = buildDocument();
    const itemB = document.components?.schemas?.ItemB as OpenAPIV3_1.SchemaObject;

    itemB.properties = { ...itemB.properties, value: { type: 'number' } };

    assert.throws(
      () => applyAnyOfFoldingRules(document, [buildRule()]),
      /unapproved divergent schema at .*properties\/list\/items\/properties\/value/,
    );
  });

  it('rejects swapped recursive branch lineage', () => {
    const document = buildDocument();
    const rootA = document.components?.schemas?.RootA as OpenAPIV3_1.SchemaObject;
    const rootB = document.components?.schemas?.RootB as OpenAPIV3_1.SchemaObject;

    rootA.properties = { ...rootA.properties, list: { type: 'array', items: ref('ItemB') } };
    rootB.properties = { ...rootB.properties, list: { type: 'array', items: ref('ItemA') } };

    assert.throws(
      () => applyAnyOfFoldingRules(document, [buildRule()]),
      /unexpected ordered branch refs at .*properties\/list\/items/,
    );
  });

  it('rejects structural constraints beside the target anyOf', () => {
    const document = buildDocument();
    const root = document.components?.schemas?.Root as OpenAPIV3_1.SchemaObject;

    root.required = ['targetOnly'];

    assert.throws(
      () => applyAnyOfFoldingRules(document, [buildRule()]),
      /unsupported schema keywords required/,
    );
  });

  it('rejects structural ref siblings while traversing to the fold target', () => {
    const document = buildDocument();
    const schemas = document.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>;
    const target = schemas.Root;
    const rule = buildRule();

    schemas.Target = target;
    schemas.Root = {
      type: 'object',
      properties: {
        target: {
          ...ref('Target'),
          properties: { hidden: { type: 'string' } },
        },
      },
    };
    rule.schemaPath = 'properties/target';

    assert.throws(
      () => applyAnyOfFoldingRules(document, [rule]),
      /structural \$ref siblings properties/,
    );
  });

  it('rejects structural ref siblings in a transitive selector ref', () => {
    const document = buildDocument();
    const schemas = document.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>;
    const target = schemas.Root;
    const rule = buildRule();

    schemas.Target = target;
    schemas.Alias = {
      ...ref('Target'),
      properties: { hidden: { type: 'string' } },
    };
    schemas.Root = {
      type: 'object',
      properties: {
        target: ref('Alias'),
      },
    };
    rule.schemaPath = 'properties/target';

    assert.throws(
      () => applyAnyOfFoldingRules(document, [rule]),
      /structural \$ref siblings properties/,
    );
  });

  it('rejects a non-string ref in a transitive selector ref', () => {
    const document = buildDocument();
    const schemas = document.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>;
    const rule = buildRule();

    schemas.Alias = { $ref: 42 } as unknown as OpenAPIV3_1.SchemaObject;
    schemas.Root = {
      type: 'object',
      properties: {
        target: ref('Alias'),
      },
    };
    rule.schemaPath = 'properties/target';

    assert.throws(() => applyAnyOfFoldingRules(document, [rule]), /has a non-string \$ref/);
  });

  it('rejects malformed local-ref escaping while traversing to the fold target', () => {
    const document = buildDocument();
    const schemas = document.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>;
    const target = schemas.Root;
    const rule = buildRule();

    schemas['Target~Bad'] = target;
    schemas.Root = {
      type: 'object',
      properties: {
        target: { $ref: '#/components/schemas/Target~Bad' },
      },
    };
    rule.schemaPath = 'properties/target';

    assert.throws(
      () => applyAnyOfFoldingRules(document, [rule]),
      /noncanonical JSON Pointer escaping/,
    );
  });

  it('rejects stale recursive permissions', () => {
    const document = buildDocument();
    const rule = buildRule();

    rule.allowedRecursiveMerges.push({
      schemaPath: 'properties/never-used',
      kind: 'array',
      expectedBranchCount: 2,
      expectedBranchRefs: [],
    });

    assert.throws(
      () => applyAnyOfFoldingRules(document, [rule]),
      /stale recursive merge permissions properties\/never-used/,
    );
  });

  it('rejects newly introduced structural keywords', () => {
    const document = buildDocument();
    const dataB = document.components?.schemas?.DataB as OpenAPIV3_1.SchemaObject;

    dataB.minProperties = 1;

    assert.throws(
      () => applyAnyOfFoldingRules(document, [buildRule()]),
      /unsupported schema keywords minProperties/,
    );
  });

  it('rejects an unexpected null branch', () => {
    const document = buildDocument();
    const root = document.components?.schemas?.Root as OpenAPIV3_1.SchemaObject;

    root.anyOf = [...(root.anyOf ?? []), { type: 'null' }];

    assert.throws(
      () => applyAnyOfFoldingRules(document, [buildRule()]),
      /unexpected null-branch shape/,
    );
  });

  it('rejects semantic constraints on an expected null branch', () => {
    const document = buildDocument();
    const root = document.components?.schemas?.Root as OpenAPIV3_1.SchemaObject;
    const rule = buildRule();

    root.anyOf = [...(root.anyOf ?? []), { type: 'null', not: {} }];
    rule.expectedNullBranch = true;

    assert.throws(() => applyAnyOfFoldingRules(document, [rule]), /requires the exact null schema/);
  });

  it('escapes literal slash characters in recursive property paths', () => {
    const document = buildDocument();
    const rootA = document.components?.schemas?.RootA as OpenAPIV3_1.SchemaObject;
    const rootB = document.components?.schemas?.RootB as OpenAPIV3_1.SchemaObject;
    const rule = buildRule();

    rootA.properties = { ...rootA.properties, 'literal/path': { type: 'string' } };
    rootB.properties = { ...rootB.properties, 'literal/path': { type: 'number' } };
    rule.allowedRecursiveMerges.push({
      schemaPath: 'properties/literal~1path',
      kind: 'array',
      expectedBranchCount: 2,
      expectedBranchRefs: [],
    });

    assert.throws(
      () => applyAnyOfFoldingRules(document, [rule]),
      /expected an array at .*properties\/literal~1path/,
    );
  });

  it('uses the canonical selector grammar for literal items, slash, and tilde property names', () => {
    const document = buildDocument();
    const schemas = document.components?.schemas as Record<string, OpenAPIV3_1.SchemaObject>;
    const target = schemas.Root;
    const rule = buildRule();

    schemas.Target = target;
    schemas.Root = {
      type: 'object',
      properties: {
        items: {
          type: 'object',
          properties: {
            'slash/~': ref('Target'),
          },
        },
      },
    };
    rule.schemaPath = 'properties/items/properties/slash~1~0';

    assert.doesNotThrow(() => applyAnyOfFoldingRules(document, [rule]));
  });

  it('rejects malformed and noncanonical selector paths', () => {
    const document = buildDocument();
    const rule = buildRule();

    rule.schemaPath = 'properties//target';

    assert.throws(
      () => applyAnyOfFoldingRules(document, [rule]),
      /must not contain empty path segments/,
    );
  });
});
