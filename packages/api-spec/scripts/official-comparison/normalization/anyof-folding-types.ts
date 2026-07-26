import type { ComparisonTarget, OperationSchemaTarget } from './schema-target.ts';

export interface ExpectedObjectBranch {
  onlyProperties: string[];
  onlyRequired: string[];
  ref: string;
}

export interface AllowedRecursiveMerge {
  expectedBranchCount?: number;
  expectedBranchRefs: string[];
  expectedObjectBranches?: ExpectedObjectBranch[];
  kind: 'array' | 'object';
  schemaPath: string;
}

export interface AnyOfFoldingRule extends OperationSchemaTarget {
  allowedRecursiveMerges: AllowedRecursiveMerge[];
  expectedNullBranch: boolean;
  expectedObjectBranches: ExpectedObjectBranch[];
  target: ComparisonTarget;
}

export interface MergeContext {
  permissions: Map<string, AllowedRecursiveMerge>;
  root: Record<string, unknown>;
  rulePath: string;
  usedPermissions: Set<string>;
}

export interface ResolvedSchema {
  ref: string | null;
  schema: Record<string, unknown>;
}
