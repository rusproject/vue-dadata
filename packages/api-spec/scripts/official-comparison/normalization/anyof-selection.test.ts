// Locks cleaner branch-selection behavior and fail-closed assumptions.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OFFICIAL_FAMILY_CONFIGS } from '../family-config.ts';
import { type AnyOfSelectionRule, applyAnyOfSelectionRules } from './anyof-selection.ts';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

function buildDocument(): OpenAPIV3_1.Document {
  return {
    openapi: '3.1.1',
    info: { title: 'test', version: '0' },
    paths: {
      '/clean/name': {
        post: {
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      anyOf: [ref('Address'), ref('Name')],
                    },
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
        Address: { type: 'object' },
        Name: { type: 'object' },
      },
    },
  };
}

function buildRule(): AnyOfSelectionRule {
  return {
    target: 'official',
    expectedBranchRefs: ['#/components/schemas/Address', '#/components/schemas/Name'],
    operation: { method: 'post', path: '/clean/name' },
    response: { mediaType: 'application/json', status: '200' },
    schemaPath: 'items',
    selectedRef: '#/components/schemas/Name',
  };
}

function responseItems(document: OpenAPIV3_1.Document): Record<string, unknown> {
  const response = document.paths?.['/clean/name']?.post?.responses?.['200'];

  if (!response || !('content' in response)) {
    assert.fail('test response schema is missing');
  }

  return response.content?.['application/json']?.schema &&
    'items' in response.content['application/json'].schema
    ? (response.content['application/json'].schema.items as Record<string, unknown>)
    : {};
}

describe('applyAnyOfSelectionRules', () => {
  it('selects exactly one curated branch and records the decision', () => {
    const document = buildDocument();

    const decisions = applyAnyOfSelectionRules(document, [buildRule()]);

    assert.deepEqual(responseItems(document), ref('Name'));
    assert.deepEqual(decisions, [
      {
        branchRefs: ['#/components/schemas/Address', '#/components/schemas/Name'],
        compositionKey: 'anyOf',
        kind: 'selected-anyof-branch',
        path: 'POST /clean/name response 200 application/json items',
        ref: '#/components/schemas/Name',
      },
    ]);
  });

  it('accepts order-only branch changes', () => {
    const document = buildDocument();
    const items = responseItems(document);

    items.anyOf = [...(items.anyOf as unknown[])].reverse();

    applyAnyOfSelectionRules(document, [buildRule()]);

    assert.deepEqual(responseItems(document), ref('Name'));
  });

  it('rejects added, removed, or replaced branch refs', () => {
    const addedDocument = buildDocument();
    responseItems(addedDocument).anyOf = [
      ...(responseItems(addedDocument).anyOf as unknown[]),
      ref('Vehicle'),
    ];

    assert.throws(
      () => applyAnyOfSelectionRules(addedDocument, [buildRule()]),
      /unexpected branch refs/,
    );

    const removedDocument = buildDocument();
    responseItems(removedDocument).anyOf = [ref('Name')];

    assert.throws(
      () => applyAnyOfSelectionRules(removedDocument, [buildRule()]),
      /unexpected branch refs/,
    );

    const replacedDocument = buildDocument();
    responseItems(replacedDocument).anyOf = [ref('Vehicle'), ref('Name')];

    assert.throws(
      () => applyAnyOfSelectionRules(replacedDocument, [buildRule()]),
      /unexpected branch refs/,
    );
  });

  it('rejects a missing selected branch', () => {
    const document = buildDocument();
    const rule = { ...buildRule(), selectedRef: '#/components/schemas/Email' };

    assert.throws(
      () => applyAnyOfSelectionRules(document, [rule]),
      /expected selectedRef .* exactly once .* found 0/,
    );
  });

  it('rejects a duplicate selected branch', () => {
    const document = buildDocument();
    const items = responseItems(document);

    items.anyOf = [...(items.anyOf as unknown[]), ref('Name')];

    assert.throws(() => applyAnyOfSelectionRules(document, [buildRule()]), /duplicate branch refs/);
  });

  it('rejects non-ref branches and structural target siblings', () => {
    const document = buildDocument();
    const items = responseItems(document);

    items.anyOf = [...(items.anyOf as unknown[]), { type: 'null' }];

    assert.throws(
      () => applyAnyOfSelectionRules(document, [buildRule()]),
      /requires exact local-\$ref branches/,
    );

    const documentWithSibling = buildDocument();
    responseItems(documentWithSibling).type = 'object';

    assert.throws(
      () => applyAnyOfSelectionRules(documentWithSibling, [buildRule()]),
      /unsupported schema keywords type/,
    );
  });

  it('keeps the configured cleaner branch selections explicit', () => {
    const curation = OFFICIAL_FAMILY_CONFIGS.cleaner.comparison;
    const expectedBranchRefs = [
      '#/components/schemas/Address',
      '#/components/schemas/AsIs',
      '#/components/schemas/Birthdate',
      '#/components/schemas/Email',
      '#/components/schemas/Name',
      '#/components/schemas/Passport',
      '#/components/schemas/Phone',
      '#/components/schemas/Vehicle',
    ];

    assert.deepEqual(
      curation.anyOfSelections.map((rule) => [
        rule.operation.path,
        rule.schemaPath,
        rule.selectedRef,
      ]),
      [
        ['/clean/address', 'items', '#/components/schemas/Address'],
        ['/clean/birthdate', 'items', '#/components/schemas/Birthdate'],
        ['/clean/email', 'items', '#/components/schemas/Email'],
        ['/clean/name', 'items', '#/components/schemas/Name'],
        ['/clean/passport', 'items', '#/components/schemas/Passport'],
        ['/clean/phone', 'items', '#/components/schemas/Phone'],
        ['/clean/vehicle', 'items', '#/components/schemas/Vehicle'],
      ],
    );

    for (const rule of curation.anyOfSelections) {
      assert.deepEqual(rule.expectedBranchRefs, expectedBranchRefs);
    }
  });
});
