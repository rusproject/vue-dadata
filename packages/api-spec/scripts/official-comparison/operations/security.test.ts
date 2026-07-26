import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compareOperationSecurity } from './security.ts';

const operation = { responses: {} } as OpenAPIV3_1.OperationObject;

describe('compareOperationSecurity', () => {
  it('uses configured requirements only when the official file omits security', () => {
    const official = document(operation);
    const ours = document({
      ...operation,
      security: [{ SecretKey: [], ApiKey: [] }],
    });

    assert.deepEqual(
      compareOperationSecurity(official, ours, {
        whenOfficialUndeclared: [{ ApiKey: [], SecretKey: [] }],
      }),
      [],
    );
  });

  it('prefers declared official security and reports a local mismatch', () => {
    const official = document({
      ...operation,
      security: [{ ApiKey: [] }],
    });
    const ours = document({
      ...operation,
      security: [{ ApiKey: [], SecretKey: [] }],
    });

    assert.deepEqual(
      compareOperationSecurity(official, ours, {
        whenOfficialUndeclared: [{ ApiKey: [], SecretKey: [] }],
      }),
      [
        'Security differs for POST /test: expected [{"ApiKey":[]}], ours [{"ApiKey":[],"SecretKey":[]}].',
      ],
    );
  });
});

function document(operationValue: OpenAPIV3_1.OperationObject): OpenAPIV3_1.Document {
  return {
    openapi: '3.1.1',
    info: { title: 'test', version: '0' },
    paths: {
      '/test': {
        post: operationValue,
      },
    },
  };
}
