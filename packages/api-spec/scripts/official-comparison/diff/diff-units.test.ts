// Locks the fail-closed raw-oasdiff parser to the subset of JSON shapes we accept.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildDiffUnits, renderDiffUnitSnapshot } from './diff-units.ts';

function createRequestSchemaDiff(schema: Record<string, unknown>): Record<string, unknown> {
  return {
    paths: {
      modified: {
        '/test': {
          operations: {
            modified: {
              POST: {
                requestBody: {
                  content: {
                    modified: {
                      'application/json': {
                        schema,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

describe('buildDiffUnits', () => {
  it('keeps whole-operation additions and deletions at operation scope', () => {
    const diff = {
      paths: {
        modified: {
          '/test': {
            operations: {
              added: ['post'],
              deleted: ['GET'],
            },
          },
        },
      },
    };

    const units = buildDiffUnits(diff);

    assert.deepEqual(units, [
      {
        kind: 'operation-deleted',
        location: '<operation>',
        method: 'GET',
        path: '/test',
        scope: 'operation',
      },
      {
        kind: 'operation-added',
        location: '<operation>',
        method: 'POST',
        path: '/test',
        scope: 'operation',
      },
    ]);
    assert.equal(
      renderDiffUnitSnapshot(units),
      [
        '/test GET operation <operation> operation-deleted',
        '/test POST operation <operation> operation-added',
        '',
      ].join('\n'),
    );
  });

  it('preserves array item bounds reported by oasdiff', () => {
    const diff = {
      paths: {
        modified: {
          '/clean/birthdate': {
            operations: {
              modified: {
                POST: {
                  requestBody: {
                    content: {
                      modified: {
                        'application/json': {
                          schema: {
                            maxItems: { from: null, to: 1 },
                            minItems: { from: 0, to: 1 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    assert.equal(
      renderDiffUnitSnapshot(buildDiffUnits(diff)),
      [
        '/clean/birthdate POST request application/json <schema> schema-maxItems-changed from=null to=1',
        '/clean/birthdate POST request application/json <schema> schema-minItems-changed from=0 to=1',
        '',
      ].join('\n'),
    );
  });

  it('preserves composition type-set changes reported by oasdiff', () => {
    const diff = {
      paths: {
        modified: {
          '/suggest/party': {
            operations: {
              modified: {
                POST: {
                  requestBody: {
                    content: {
                      modified: {
                        'application/json': {
                          schema: {
                            properties: {
                              modified: {
                                branch_type: {
                                  listOfTypes: {
                                    added: ['string', 'null'],
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    assert.equal(
      renderDiffUnitSnapshot(buildDiffUnits(diff)),
      '/suggest/party POST request application/json branch_type schema-composition-types-changed added=["null","string"] removed=[]\n',
    );
  });

  it('preserves currently observed semantic markers that were previously hidden', () => {
    const diff = createRequestSchemaDiff({
      additionalPropertiesAllowed: { from: true, to: null },
      properties: {
        modified: {
          mode: {
            default: { from: null, to: 'AUTO' },
            enum: {
              added: ['MANUAL', 'AUTO'],
              enumAdded: true,
            },
          },
          recursive: {
            circularRef: true,
          },
          shape: {
            anyOf: {
              added: [{ component: 'NewShape', index: 0 }],
              deleted: [{ component: 'OldShape', index: 0 }],
            },
          },
        },
      },
    });

    assert.equal(
      renderDiffUnitSnapshot(buildDiffUnits(diff)),
      [
        '/test POST request application/json <schema> schema-additionalPropertiesAllowed-changed from=true to=null',
        '/test POST request application/json mode schema-default-changed from=null to="AUTO"',
        '/test POST request application/json mode schema-enum-added added=["AUTO","MANUAL"]',
        '/test POST request application/json recursive schema-circular-ref-changed',
        '/test POST request application/json shape/anyOf schema-anyOf-changed added=[{"component":"NewShape","index":0}] removed=[{"component":"OldShape","index":0}]',
        '',
      ].join('\n'),
    );
  });

  it('recurses into matched named composition branches', () => {
    const diff = createRequestSchemaDiff({
      anyOf: {
        added: [{ component: 'ExtraShape', index: 2 }],
        modified: [
          {
            base: { component: 'SharedShape', index: 0 },
            revision: { component: 'SharedShape', index: 1 },
            diff: {
              required: {
                added: ['id'],
              },
            },
          },
        ],
      },
    });

    assert.equal(
      renderDiffUnitSnapshot(buildDiffUnits(diff)),
      [
        '/test POST request application/json anyOf schema-anyOf-changed added=[{"component":"ExtraShape","index":2}] removed=[]',
        '/test POST request application/json anyOf/SharedShape/id schema-required-added added="id"',
        '',
      ].join('\n'),
    );
  });

  it('fails closed on unmatched or malformed composition branch pairs', () => {
    const buildCompositionDiff = (modified: unknown) =>
      createRequestSchemaDiff({
        anyOf: {
          modified,
        },
      });

    assert.throws(
      () =>
        buildDiffUnits(
          buildCompositionDiff([
            {
              base: { component: 'OldShape', index: 0 },
              revision: { component: 'NewShape', index: 0 },
              diff: {},
            },
          ]),
        ),
      /expected the same named component on both sides/,
    );
    assert.throws(
      () =>
        buildDiffUnits(
          buildCompositionDiff([
            {
              base: { component: 'Shape', index: -1 },
              revision: { component: 'Shape', index: 0 },
              diff: {},
            },
          ]),
        ),
      /expected a non-negative integer index/,
    );
    assert.throws(
      () =>
        buildDiffUnits(
          buildCompositionDiff([
            {
              base: { component: 'Shape', index: 0 },
              revision: { component: 'Shape', index: 0 },
            },
          ]),
        ),
      /expected base, diff, and revision/,
    );
  });

  it('keeps per-value units when an existing enum changes', () => {
    const diff = createRequestSchemaDiff({
      enum: {
        added: ['NEW'],
        deleted: ['OLD'],
      },
    });

    assert.equal(
      renderDiffUnitSnapshot(buildDiffUnits(diff)),
      [
        '/test POST request application/json <schema> schema-enum-value-added added="NEW"',
        '/test POST request application/json <schema> schema-enum-value-deleted removed="OLD"',
        '',
      ].join('\n'),
    );
  });

  it('explicitly ignores presentation-only annotations', () => {
    const diff = createRequestSchemaDiff({
      description: { from: 'old schema', to: 'new schema' },
      example: { from: 'old example', to: 'new example' },
      examples: { added: ['new schema example'] },
      extensions: { added: ['examples'] },
    });
    const pathDiff = (
      (diff.paths as Record<string, unknown>).modified as Record<string, Record<string, unknown>>
    )['/test'];
    const operations = pathDiff.operations as {
      modified: { POST: Record<string, unknown> };
    };
    const operation = operations.modified.POST;
    const requestBody = operation.requestBody as Record<string, unknown>;
    const content = requestBody.content as {
      modified: { 'application/json': Record<string, unknown> };
    };

    pathDiff.description = { from: 'old path', to: 'new path' };
    operation.summary = { from: 'old summary', to: 'new summary' };
    requestBody.description = { from: 'old request', to: 'new request' };
    content.modified['application/json'].examples = { added: ['example'] };

    assert.equal(renderDiffUnitSnapshot(buildDiffUnits(diff)), '');
  });

  it('fails closed on unknown or unsupported diff keys at traversed layers', () => {
    const cases: Array<{ diff: Record<string, unknown>; expectedPath: string }> = [
      {
        diff: {
          security: { added: ['apiKey'] },
        },
        expectedPath: '/',
      },
      {
        diff: {
          paths: {
            modified: {
              '/test': {
                servers: { added: ['https://example.com'] },
              },
            },
          },
        },
        expectedPath: '/paths/modified/~1test',
      },
      {
        diff: {
          paths: {
            modified: {
              '/test': {
                operations: {
                  modified: {
                    POST: {
                      parameters: { added: ['query'] },
                    },
                  },
                },
              },
            },
          },
        },
        expectedPath: '/paths/modified/~1test/operations/modified/POST',
      },
      {
        diff: {
          paths: {
            modified: {
              '/test': {
                operations: {
                  modified: {
                    POST: {
                      requestBody: {
                        extensions: {},
                        required: { from: false, to: true },
                        xUnsupported: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        expectedPath: '/paths/modified/~1test/operations/modified/POST/requestBody',
      },
      {
        diff: {
          paths: {
            modified: {
              '/test': {
                operations: {
                  modified: {
                    POST: {
                      responses: {
                        modified: {
                          200: {
                            headers: { added: ['X-Test'] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        expectedPath: '/paths/modified/~1test/operations/modified/POST/responses/modified/200',
      },
      {
        diff: {
          paths: {
            modified: {
              '/test': {
                operations: {
                  modified: {
                    POST: {
                      requestBody: {
                        content: {
                          encoding: { added: ['application/json'] },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        expectedPath: '/paths/modified/~1test/operations/modified/POST/requestBody/content',
      },
      {
        diff: {
          paths: {
            modified: {
              '/test': {
                operations: {
                  modified: {
                    POST: {
                      requestBody: {
                        content: {
                          modified: {
                            'application/json': {
                              encoding: { added: ['field'] },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        expectedPath:
          '/paths/modified/~1test/operations/modified/POST/requestBody/content/modified/application~1json',
      },
      {
        diff: createRequestSchemaDiff({
          uniqueItems: { from: false, to: true },
        }),
        expectedPath:
          '/paths/modified/~1test/operations/modified/POST/requestBody/content/modified/application~1json/schema',
      },
    ];

    for (const { diff, expectedPath } of cases) {
      assert.throws(
        () => buildDiffUnits(diff),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes('Unsupported oasdiff key(s)') &&
          error.message.includes(expectedPath),
      );
    }
  });

  it('fails closed on malformed known marker shapes', () => {
    assert.throws(
      () =>
        buildDiffUnits(
          createRequestSchemaDiff({
            default: { from: null },
          }),
        ),
      /expected both "from" and "to"/,
    );
    assert.throws(
      () =>
        buildDiffUnits(
          createRequestSchemaDiff({
            enum: { added: [], enumAdded: true },
          }),
        ),
      /expected added values and no deleted values/,
    );
    assert.throws(
      () =>
        buildDiffUnits(
          createRequestSchemaDiff({
            circularRef: false,
          }),
        ),
      /expected true/,
    );
  });
});
