import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { comparisonArtifacts } from './artifacts.ts';
import { buildDiffUnits, buildDiffUnitsByPath, renderDiffUnitSnapshot } from './diff/diff-units.ts';
import { resolveOasdiffBin, runOasdiffDiff } from './diff/oasdiff.ts';
import type { OfficialFamilyConfig } from './family-config.ts';
import { cloneJson, writeJson, writeText } from './io.ts';
import { applyAnyOfFoldingRules } from './normalization/anyof-folding.ts';
import { applyAnyOfSelectionRules } from './normalization/anyof-selection.ts';
import { normalizeComparisonDocument } from './normalization/comparison-normalization.ts';
import { pruneUnreferencedComponents } from './normalization/component-pruning.ts';
import {
  buildComparableRevisionSlice,
  extractComparableOperations,
} from './normalization/revision-slice.ts';
import { applySchemaComponentAliasRules } from './normalization/schema-component-aliases.ts';
import { buildExactPathRegex } from './openapi.ts';
import { buildFamilyProjection } from './project.ts';
import { type SnapshotResult, applySnapshot } from './snapshot.ts';

export interface CompareFamilyOptions {
  artifactsRoot: string | null;
  officialSourcePath: string;
  oasdiffBin: string | null;
}

export interface PreparedFamilyComparison {
  artifactsDirectory: string | null;
  family: OfficialFamilyConfig['family'];
  operationCount: number;
  snapshotPath: string;
  snapshotText: string;
}

export interface FamilyComparisonResult extends Omit<
  PreparedFamilyComparison,
  'snapshotPath' | 'snapshotText'
> {
  snapshot: SnapshotResult;
}

/** Runs the complete official-vs-ours comparison for one configured API family. */
export async function compareOfficialFamily(
  config: OfficialFamilyConfig,
  options: CompareFamilyOptions,
): Promise<PreparedFamilyComparison> {
  const retainedArtifacts = options.artifactsRoot !== null;
  const artifactsDirectory = retainedArtifacts
    ? resolve(options.artifactsRoot as string, config.family)
    : mkdtempSync(join(tmpdir(), `dadata-official-${config.family}-`));
  const artifacts = comparisonArtifacts(artifactsDirectory);

  mkdirSync(artifactsDirectory, { recursive: true });

  try {
    const oasdiffBin = await resolveOasdiffBin(options.oasdiffBin);
    const { ourSpec, projection } = buildFamilyProjection(config, options.officialSourcePath);

    writeJson(artifacts.officialProjected, projection.document);

    const officialComparable = cloneJson(projection.document);
    const officialNormalization = normalizeComparisonDocument(
      officialComparable,
      ourSpec.openapi ?? '3.1.1',
    );
    officialNormalization.push(
      ...applyAnyOfSelectionRules(
        officialComparable,
        config.comparison.anyOfSelections.filter((rule) => rule.target === 'official'),
      ),
      ...applyAnyOfFoldingRules(
        officialComparable,
        config.comparison.anyOfFolding.filter((rule) => rule.target === 'official'),
      ),
      ...applySchemaComponentAliasRules(
        officialComparable,
        config.comparison.schemaComponentAliases.filter((rule) => rule.target === 'official'),
      ),
    );
    writeJson(artifacts.officialNormalizedUnpruned, officialComparable);
    const officialPruning = pruneUnreferencedComponents(officialComparable);

    writeJson(artifacts.officialNormalized, officialComparable);
    writeJson(artifacts.officialNormalizationLog, {
      decisions: officialNormalization,
      componentPruning: officialPruning,
    });

    const comparableOperations = extractComparableOperations(officialComparable, config.family);
    const oursComparable = buildComparableRevisionSlice(
      comparableOperations,
      config.comparison.anyOfSelections.filter((rule) => rule.target === 'ours'),
      config.comparison.anyOfFolding.filter((rule) => rule.target === 'ours'),
      config.comparison.schemaComponentAliases.filter((rule) => rule.target === 'ours'),
      ourSpec,
    );

    writeJson(artifacts.oursNormalizedUnpruned, oursComparable.document);
    const oursPruning = pruneUnreferencedComponents(oursComparable.document);

    writeJson(artifacts.oursNormalized, oursComparable.document);
    writeJson(artifacts.oursNormalizationLog, {
      decisions: oursComparable.result.normalizationDecisions,
      componentPruning: oursPruning,
    });

    const paths = [...comparableOperations.keys()].sort((left, right) => left.localeCompare(right));
    const fullDiff = runOasdiffDiff(
      oasdiffBin,
      artifacts.officialNormalized,
      artifacts.oursNormalized,
      buildExactPathRegex(paths),
    );

    writeJson(artifacts.oasdiff, fullDiff);

    const diffUnits = buildDiffUnits(fullDiff);
    const snapshotText = renderDiffUnitSnapshot(diffUnits);

    writeJson(artifacts.diffUnits, diffUnits);
    writeJson(artifacts.diffByPath, buildDiffUnitsByPath(diffUnits));
    writeText(artifacts.diffSnapshot, snapshotText);

    return {
      artifactsDirectory: retainedArtifacts ? artifactsDirectory : null,
      family: config.family,
      operationCount: oursComparable.result.operationCount,
      snapshotPath: config.snapshotPath,
      snapshotText,
    };
  } finally {
    if (!retainedArtifacts) {
      rmSync(artifactsDirectory, { force: true, recursive: true });
    }
  }
}

export function applyFamilyComparisonSnapshot(
  comparison: PreparedFamilyComparison,
  update: boolean,
): FamilyComparisonResult {
  return {
    artifactsDirectory: comparison.artifactsDirectory,
    family: comparison.family,
    operationCount: comparison.operationCount,
    snapshot: applySnapshot(comparison.snapshotText, comparison.snapshotPath, update),
  };
}
