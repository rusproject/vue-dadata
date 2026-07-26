import { join } from 'node:path';

export interface ComparisonArtifacts {
  diffByPath: string;
  diffSnapshot: string;
  diffUnits: string;
  directory: string;
  oasdiff: string;
  officialNormalized: string;
  officialNormalizedUnpruned: string;
  officialNormalizationLog: string;
  officialProjected: string;
  oursNormalized: string;
  oursNormalizedUnpruned: string;
  oursNormalizationLog: string;
}

export function comparisonArtifacts(directory: string): ComparisonArtifacts {
  return {
    directory,
    diffByPath: join(directory, 'diff.by-path.json'),
    diffSnapshot: join(directory, 'diff.snapshot.txt'),
    diffUnits: join(directory, 'diff.json'),
    oasdiff: join(directory, 'oasdiff.json'),
    officialNormalized: join(directory, 'official.normalized.json'),
    officialNormalizedUnpruned: join(directory, 'official.normalized.unpruned.json'),
    officialNormalizationLog: join(directory, 'official.normalization.json'),
    officialProjected: join(directory, 'official.projected.json'),
    oursNormalized: join(directory, 'ours.normalized.json'),
    oursNormalizedUnpruned: join(directory, 'ours.normalized.unpruned.json'),
    oursNormalizationLog: join(directory, 'ours.normalization.json'),
  };
}
