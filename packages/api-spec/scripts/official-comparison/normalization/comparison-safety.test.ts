// Exercises shared normalization safety checks against malformed refs.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeComparisonDocument } from './comparison-normalization.ts';
import { pruneUnreferencedComponents } from './component-pruning.ts';

function malformedRefDocument(): OpenAPIV3_1.Document {
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
                  schema: { $ref: '#/components/schemas/Target~Bad' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        'Target~Bad': { type: 'object' },
      },
    },
  };
}

describe('comparison schema-transform safety', () => {
  it('rejects malformed local-ref escaping during component pruning', () => {
    assert.throws(
      () => pruneUnreferencedComponents(malformedRefDocument()),
      /noncanonical JSON Pointer escaping/,
    );
  });

  it('rejects non-string refs during component pruning', () => {
    const document = malformedRefDocument();
    const response = document.paths?.['/test']?.post?.responses?.['200'];

    if (!response || !('content' in response)) {
      assert.fail('test response schema is missing');
    }

    response.content = {
      'application/json': {
        schema: { $ref: 42 } as unknown as OpenAPIV3_1.SchemaObject,
      },
    };

    assert.throws(
      () => pruneUnreferencedComponents(document),
      /Cannot prune comparison components; non-string \$ref/,
    );
  });

  it('rejects malformed local-ref escaping during nullable normalization', () => {
    const document = malformedRefDocument();
    const schema = document.paths?.['/test']?.post?.responses?.['200'];

    if (!schema || !('content' in schema)) {
      assert.fail('test response schema is missing');
    }

    schema.content = {
      'application/json': {
        schema: {
          anyOf: [{ type: 'null' }, { $ref: '#/components/schemas/Target~Bad' }],
        },
      },
    };

    assert.throws(
      () => normalizeComparisonDocument(document, '3.1.1'),
      /noncanonical JSON Pointer escaping/,
    );
  });
});
