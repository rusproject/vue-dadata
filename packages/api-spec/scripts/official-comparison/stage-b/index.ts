import type { OpenAPIV3_1 } from '@scalar/openapi-types';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { readJson, writeJson, writeText } from '../io.js';
import { buildExactPathRegex } from '../openapi.js';
import { printFailedCommand, runCommand } from '../process.js';
import { applyAnyOfFoldingRules } from './anyof-folding.js';
import { applyAnyOfSelectionRules } from './anyof-selection.js';
import { buildStageBArtifacts } from './artifacts.js';
import { parseStageBOptions } from './cli.js';
import { readComparisonCuration } from './comparison-curation.js';
import { normalizeComparisonDocument } from './comparison-normalization.js';
import { pruneUnreferencedComponents } from './component-pruning.js';
import { buildDiffUnits, buildDiffUnitsByPath, renderDiffUnitSnapshot } from './diff-units.js';
import {
  resolveOasdiffBin,
  runOasdiffBreaking,
  runOasdiffDiff,
  runOasdiffSummary,
} from './oasdiff.js';
import { printStageBReport } from './report.js';
import { buildComparableRevisionSlice, extractComparableOperations } from './revision-slice.js';
import { applySchemaComponentAliasRules } from './schema-component-aliases.js';
import { handleStageBSnapshot } from './snapshot.js';
import type { StageBFamilyConfig, StageBOptions } from './types.js';

const OUR_SPEC_PATH = resolve('dadata.json');

/** Runs the shared Stage B payload-schema comparison pipeline for one official family. */
export function runStageBComparison(
  config: StageBFamilyConfig,
  args = process.argv.slice(2),
): void {
  const options = parseStageBOptions(args);
  const tempDir = mkdtempSync(join(tmpdir(), `dadata-${config.family}-stage-b-`));
  const artifacts = buildStageBArtifacts(tempDir, config.family);

  try {
    const oasdiffBin = resolveOasdiffBin(options.oasdiffBin);

    runStageAProjection(artifacts.projectionPath, config, options);

    const comparisonCuration = readComparisonCuration(
      options.curationPath,
      resolve(config.defaultCurationPath),
    );
    const projectedSpec = readJson<OpenAPIV3_1.Document>(
      artifacts.projectionPath,
      `projected official ${config.family} spec`,
    );
    const ourSpec = readJson<OpenAPIV3_1.Document>(OUR_SPEC_PATH, 'our dadata.json');
    const comparisonOpenapiVersion = ourSpec.openapi ?? '3.1.1';

    const projectionNormalizationDecisions = normalizeComparisonDocument(
      projectedSpec,
      comparisonOpenapiVersion,
    );
    projectionNormalizationDecisions.push(
      ...applyAnyOfSelectionRules(
        projectedSpec,
        comparisonCuration.anyOfSelections.filter((rule) => rule.target === 'official'),
      ),
      ...applyAnyOfFoldingRules(
        projectedSpec,
        comparisonCuration.anyOfFolding.filter((rule) => rule.target === 'official'),
      ),
      ...applySchemaComponentAliasRules(
        projectedSpec,
        comparisonCuration.schemaComponentAliases.filter((rule) => rule.target === 'official'),
      ),
    );
    writeJson(artifacts.projectionNormalizedUnprunedPath, projectedSpec);
    const projectionComponentPruning = pruneUnreferencedComponents(projectedSpec);
    writeJson(artifacts.projectionPath, projectedSpec);
    writeJson(artifacts.projectionNormalizationDecisionsPath, projectionNormalizationDecisions);
    writeJson(artifacts.projectionComponentPruningPath, projectionComponentPruning);

    const comparableOperations = extractComparableOperations(projectedSpec, config.family);
    const revisionSlice = buildComparableRevisionSlice(
      comparableOperations,
      comparisonCuration.anyOfSelections.filter((rule) => rule.target === 'ours'),
      comparisonCuration.anyOfFolding.filter((rule) => rule.target === 'ours'),
      comparisonCuration.schemaComponentAliases.filter((rule) => rule.target === 'ours'),
      ourSpec,
    );
    writeJson(artifacts.revisionNormalizedUnprunedPath, revisionSlice.document);
    const revisionComponentPruning = pruneUnreferencedComponents(revisionSlice.document);
    writeJson(artifacts.revisionSlicePath, revisionSlice.document);
    writeJson(
      artifacts.revisionNormalizationDecisionsPath,
      revisionSlice.result.normalizationDecisions,
    );
    writeJson(artifacts.revisionComponentPruningPath, revisionComponentPruning);

    const projectedPaths = [...comparableOperations.keys()].sort((left, right) =>
      left.localeCompare(right),
    );
    const matchPathRegex = buildExactPathRegex(projectedPaths);
    const summary = runOasdiffSummary(
      oasdiffBin,
      artifacts.projectionPath,
      artifacts.revisionSlicePath,
      matchPathRegex,
    );
    const fullDiff = runOasdiffDiff(
      oasdiffBin,
      artifacts.projectionPath,
      artifacts.revisionSlicePath,
      matchPathRegex,
    );
    writeJson(artifacts.fullDiffPath, fullDiff);

    const diffUnits = buildDiffUnits(fullDiff);
    const diffUnitsByPath = buildDiffUnitsByPath(diffUnits);
    const diffUnitsSnapshot = renderDiffUnitSnapshot(diffUnits);
    writeJson(artifacts.diffUnitsPath, diffUnits);
    writeJson(artifacts.diffUnitsByPathPath, diffUnitsByPath);
    writeText(artifacts.diffUnitsSnapshotPath, diffUnitsSnapshot);

    const snapshotResult = handleStageBSnapshot(diffUnitsSnapshot, options, config.snapshotPath);
    const breakingFindings = runOasdiffBreaking(
      oasdiffBin,
      artifacts.projectionPath,
      artifacts.revisionSlicePath,
      matchPathRegex,
    );

    printStageBReport({
      artifacts,
      breakingFindings,
      config,
      diffUnits,
      diffUnitsByPath,
      fullDiff,
      matchPathRegex,
      oasdiffBin,
      options,
      ourSpecPath: OUR_SPEC_PATH,
      projectedPaths,
      projectionComponentPruning,
      projectionNormalizationDecisions,
      revisionComponentPruning,
      revisionSlice: revisionSlice.result,
      snapshotResult,
      summary,
    });

    if (!snapshotResult.ok) {
      process.exitCode = 1;
    }
  } finally {
    if (!options.keepTemp) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  }
}

function runStageAProjection(
  projectionPath: string,
  config: StageBFamilyConfig,
  options: StageBOptions,
): void {
  const commandArgs = [
    'exec',
    'tsx',
    config.stageAScriptPath,
    '--write-projection',
    projectionPath,
  ];

  if (options.curationPath) {
    commandArgs.push('--curation', options.curationPath);
  }

  const result = runCommand('pnpm', commandArgs, {
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    printFailedCommand('Stage A projection failed.', result);
    process.exit(1);
  }
}
