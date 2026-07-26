// Locks component alias safety and the configured cleaner aliases.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OFFICIAL_FAMILY_CONFIGS } from '../family-config.ts';
import {
  type SchemaComponentAliasRule,
  applySchemaComponentAliasRules,
} from './schema-component-aliases.ts';

const rule: SchemaComponentAliasRule = {
  canonicalName: 'Canonical',
  sourceName: 'Source',
  target: 'official',
};

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
                  schema: {
                    anyOf: [
                      { $ref: '#/components/schemas/Source' },
                      { $ref: '#/components/schemas/Other' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Source: {
          properties: {
            child: { $ref: '#/components/schemas/Source' },
          },
          type: 'object',
        },
        Other: { type: 'string' },
      },
    },
  };
}

describe('schema component aliases', () => {
  it('renames a schema component and all exact refs', () => {
    const document = buildDocument();
    const decisions = applySchemaComponentAliasRules(document, [rule]);

    assert.equal(document.components?.schemas?.Source, undefined);
    assert.deepEqual(document.components?.schemas?.Canonical, {
      properties: {
        child: { $ref: '#/components/schemas/Canonical' },
      },
      type: 'object',
    });
    assert.deepEqual(document.paths?.['/test']?.post?.responses?.['200'], {
      content: {
        'application/json': {
          schema: {
            anyOf: [
              { $ref: '#/components/schemas/Canonical' },
              { $ref: '#/components/schemas/Other' },
            ],
          },
        },
      },
      description: 'ok',
    });
    assert.deepEqual(decisions, [
      {
        canonicalName: 'Canonical',
        kind: 'aliased-schema-component',
        path: '#/components/schemas/Source',
        ref: '#/components/schemas/Canonical',
        rewrittenRefCount: 2,
        sourceName: 'Source',
      },
    ]);
  });

  it('fails closed for stale, colliding, duplicate, and chained rules', () => {
    assert.throws(
      () => applySchemaComponentAliasRules(buildDocument(), [{ ...rule, sourceName: 'Missing' }]),
      /alias source is missing/,
    );
    assert.throws(
      () => applySchemaComponentAliasRules(buildDocument(), [{ ...rule, canonicalName: 'Other' }]),
      /alias target already exists/,
    );
    assert.throws(
      () => applySchemaComponentAliasRules(buildDocument(), [rule, rule]),
      /duplicate source names/,
    );
    assert.throws(
      () =>
        applySchemaComponentAliasRules(buildDocument(), [
          rule,
          {
            canonicalName: 'Final',
            sourceName: 'Canonical',
            target: 'official',
          },
        ]),
      /must not form chains or cycles/,
    );

    const unreferenced = buildDocument();
    const response = unreferenced.paths?.['/test']?.post?.responses?.['200'];

    if (!response || !('content' in response)) {
      assert.fail('test response schema is missing');
    }

    response.content = {
      'application/json': {
        schema: { $ref: '#/components/schemas/Other' },
      },
    };
    const source = unreferenced.components?.schemas?.Source;

    if (!source || !('$ref' in (source.properties?.child ?? {}))) {
      assert.fail('test source schema is missing its self-ref');
    }

    source.properties.child = { type: 'string' };

    assert.throws(
      () => applySchemaComponentAliasRules(unreferenced, [rule]),
      /alias source is not referenced/,
    );
  });

  it('keeps the configured cleaner aliases explicit', () => {
    const curation = OFFICIAL_FAMILY_CONFIGS.cleaner.comparison;

    assert.deepEqual(
      curation.schemaComponentAliases.map(({ sourceName, canonicalName, target }) => [
        sourceName,
        canonicalName,
        target,
      ]),
      [
        ['Address', 'AddressClean', 'official'],
        ['AsIs', 'AsIsClean', 'official'],
        ['Birthdate', 'DateClean', 'official'],
        ['Email', 'EmailClean', 'official'],
        ['Name', 'FioClean', 'official'],
        ['Passport', 'PassportClean', 'official'],
        ['Phone', 'PhoneClean', 'official'],
        ['Vehicle', 'VehicleClean', 'official'],
      ],
    );
  });
});
