// Downloads the pinned oasdiff release into an ignored, repo-local cache.
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { x as extractTar } from 'tar';

import { runCommand } from '../process.ts';

export const OASDIFF_VERSION = '1.24.0';

export interface ReleaseAsset {
  name: string;
  sha256: string;
}

const RELEASE_ASSETS: Record<string, ReleaseAsset> = {
  'darwin-arm64': {
    name: `oasdiff_${OASDIFF_VERSION}_darwin_all.tar.gz`,
    sha256: 'cd50458cf28e6e0b69c1cfa80000aca1ff1c2f14140fdf159c876a7294709fa4',
  },
  'darwin-x64': {
    name: `oasdiff_${OASDIFF_VERSION}_darwin_all.tar.gz`,
    sha256: 'cd50458cf28e6e0b69c1cfa80000aca1ff1c2f14140fdf159c876a7294709fa4',
  },
  'linux-arm64': {
    name: `oasdiff_${OASDIFF_VERSION}_linux_arm64.tar.gz`,
    sha256: 'e25cc31da68afcaa345adfa1ba8cac8ef73c5578a67951755177f3830392a0fc',
  },
  'linux-x64': {
    name: `oasdiff_${OASDIFF_VERSION}_linux_amd64.tar.gz`,
    sha256: '76f0307718c9196f44b5efc2a8b27e8a7ccde9beddd456159b8fb18377801636',
  },
  'win32-arm64': {
    name: `oasdiff_${OASDIFF_VERSION}_windows_arm64.tar.gz`,
    sha256: '52a212b16b524a62f5127d6ff8b01812b0deb1d77b8eaa6ba0cb1925f20d37ff',
  },
  'win32-x64': {
    name: `oasdiff_${OASDIFF_VERSION}_windows_amd64.tar.gz`,
    sha256: '36cdd37f4f52f5df7b6a2d871882a1828a0860ddeb1b08bda8c058ee6a36ee9b',
  },
};

export async function installPinnedOasdiff(): Promise<string> {
  const platformKey = `${process.platform}-${process.arch}`;
  const asset = releaseAssetFor(process.platform, process.arch);

  const executableName = process.platform === 'win32' ? 'oasdiff.exe' : 'oasdiff';
  const cacheDirectory = resolve(
    '../../node_modules/.cache/dadata-sdk/oasdiff',
    OASDIFF_VERSION,
    platformKey,
  );
  const cachedExecutable = join(cacheDirectory, executableName);

  if (isExpectedOasdiffVersion(cachedExecutable)) {
    return cachedExecutable;
  }

  const stagingRoot = resolve(tmpdir(), 'dadata-sdk-oasdiff');

  mkdirSync(stagingRoot, { recursive: true });

  const stagingDirectory = mkdtempSync(join(stagingRoot, 'install-'));

  try {
    const archivePath = join(stagingDirectory, asset.name);
    const archive = await downloadReleaseAsset(asset);
    const actualChecksum = createHash('sha256').update(archive).digest('hex');

    if (actualChecksum !== asset.sha256) {
      throw new Error(
        `oasdiff ${OASDIFF_VERSION} checksum mismatch for ${asset.name}: ` +
          `expected ${asset.sha256}, received ${actualChecksum}.`,
      );
    }

    writeFileSync(archivePath, archive);
    await extractTar({
      cwd: stagingDirectory,
      file: archivePath,
      filter: (path) => basename(path) === executableName,
    });

    const extractedExecutable = join(stagingDirectory, executableName);

    if (!existsSync(extractedExecutable)) {
      throw new Error(`oasdiff release archive ${asset.name} did not contain ${executableName}.`);
    }

    if (process.platform !== 'win32') {
      chmodSync(extractedExecutable, 0o755);
    }

    assertExpectedOasdiffVersion(extractedExecutable, `downloaded ${asset.name}`);
    mkdirSync(cacheDirectory, { recursive: true });

    const pendingExecutable = join(cacheDirectory, `${executableName}.installing-${process.pid}`);
    copyFileSync(extractedExecutable, pendingExecutable);

    if (process.platform !== 'win32') {
      chmodSync(pendingExecutable, 0o755);
    }

    if (existsSync(cachedExecutable)) {
      rmSync(cachedExecutable, { force: true });
    }

    renameSync(pendingExecutable, cachedExecutable);
    return cachedExecutable;
  } finally {
    rmSync(stagingDirectory, { force: true, recursive: true });
  }
}

export function releaseAssetFor(platform: string, architecture: string): ReleaseAsset {
  const platformKey = `${platform}-${architecture}`;
  const asset = RELEASE_ASSETS[platformKey];

  if (!asset) {
    throw new Error(
      `No automatic oasdiff install is configured for ${platformKey}. ` +
        'Install the pinned version manually and pass --oasdiff-bin <path>.',
    );
  }

  return asset;
}

export function assertExpectedOasdiffVersion(path: string, label = path): void {
  if (!existsSync(path)) {
    throw new Error(`oasdiff executable does not exist: ${path}.`);
  }

  const result = runCommand(path, ['--version']);
  const actual = result.stdout.trim();
  const expected = `oasdiff version ${OASDIFF_VERSION}`;

  if (result.status !== 0 || actual !== expected) {
    throw new Error(
      `Expected ${expected} from ${label}, received ${actual || '<no version output>'}.`,
    );
  }
}

function isExpectedOasdiffVersion(path: string): boolean {
  if (!existsSync(path)) {
    return false;
  }

  const result = runCommand(path, ['--version']);

  return result.status === 0 && result.stdout.trim() === `oasdiff version ${OASDIFF_VERSION}`;
}

async function downloadReleaseAsset(asset: ReleaseAsset): Promise<Buffer> {
  const url =
    `https://github.com/oasdiff/oasdiff/releases/download/v${OASDIFF_VERSION}/` + asset.name;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download oasdiff ${OASDIFF_VERSION}: ${response.status} ${response.statusText}.`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}
