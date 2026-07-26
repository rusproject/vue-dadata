import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOfficialCommand } from './cli.ts';

describe('official command parser', () => {
  it('selects every family for an upstream check by default', () => {
    assert.deepEqual(parseOfficialCommand(['upstream', 'check']), {
      action: 'check',
      artifactsRoot: '../../tmp/official-upstream',
      families: ['cleaner', 'profile', 'suggestions'],
      kind: 'upstream',
      oasdiffBin: null,
    });
  });

  it('supports repeatable family selection without package-script aliases', () => {
    assert.deepEqual(
      parseOfficialCommand([
        'compare',
        'saved',
        '--accept',
        '--family',
        'suggestions',
        '--family',
        'cleaner',
        '--family',
        'suggestions',
      ]),
      {
        accept: true,
        artifactsRoot: null,
        families: ['suggestions', 'cleaner'],
        kind: 'compare',
        oasdiffBin: null,
        source: 'saved',
      },
    );
  });

  it('retains upstream comparison artifacts by default', () => {
    assert.deepEqual(parseOfficialCommand(['compare', 'upstream']), {
      accept: false,
      artifactsRoot: '../../tmp/official-upstream-comparison',
      families: ['cleaner', 'profile', 'suggestions'],
      kind: 'compare',
      oasdiffBin: null,
      source: 'upstream',
    });
  });

  it('rejects acceptance against an upstream source set', () => {
    assert.throws(
      () => parseOfficialCommand(['compare', 'upstream', '--accept']),
      /Upstream differences cannot be accepted/u,
    );
  });

  it('rejects incomplete and unknown commands', () => {
    assert.throws(() => parseOfficialCommand(['upstream']), /Expected "check" or "update"/u);
    assert.throws(
      () => parseOfficialCommand(['compare', 'current']),
      /Expected "upstream" or "saved"/u,
    );
    assert.throws(() => parseOfficialCommand(['verify']), /Unknown official command/u);
  });
});
