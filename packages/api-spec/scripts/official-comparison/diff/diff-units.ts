// Public surface for converting oasdiff JSON into deterministic accepted-difference records.
export { buildDiffUnits } from './parse.ts';
export { buildDiffUnitsByPath, renderDiffUnitSnapshot } from './render.ts';
export type { DiffUnit, DiffUnitsByPath, DiffUnitsByPathOperation } from './types.ts';
