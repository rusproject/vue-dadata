import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OASDIFF_VERSION, releaseAssetFor } from './oasdiff-install.ts';

describe('releaseAssetFor', () => {
  it('maps supported Windows, Linux, and macOS architectures to pinned official assets', () => {
    assert.equal(
      releaseAssetFor('win32', 'x64').name,
      `oasdiff_${OASDIFF_VERSION}_windows_amd64.tar.gz`,
    );
    assert.equal(
      releaseAssetFor('win32', 'arm64').name,
      `oasdiff_${OASDIFF_VERSION}_windows_arm64.tar.gz`,
    );
    assert.equal(
      releaseAssetFor('linux', 'x64').name,
      `oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz`,
    );
    assert.equal(
      releaseAssetFor('linux', 'arm64').name,
      `oasdiff_${OASDIFF_VERSION}_linux_arm64.tar.gz`,
    );
    assert.equal(
      releaseAssetFor('darwin', 'x64').name,
      `oasdiff_${OASDIFF_VERSION}_darwin_all.tar.gz`,
    );
    assert.equal(
      releaseAssetFor('darwin', 'arm64').name,
      `oasdiff_${OASDIFF_VERSION}_darwin_all.tar.gz`,
    );
  });

  it('requires an explicit binary on unsupported platforms', () => {
    assert.throws(
      () => releaseAssetFor('freebsd', 'x64'),
      /No automatic oasdiff install is configured for freebsd-x64/u,
    );
  });
});
