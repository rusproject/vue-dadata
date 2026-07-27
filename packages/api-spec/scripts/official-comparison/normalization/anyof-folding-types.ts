import type { ComparisonTarget, OperationSchemaTarget } from './schema-target.ts';

/** Ожидаемые поля и required, которые встречаются только в одной object-ветке */
export interface ExpectedObjectBranch {
  onlyProperties: string[];
  onlyRequired: string[];
  ref: string;
}

/** Допустимый рекурсивный merge разошедшихся веток для конкретного schemaPath */
export interface AllowedRecursiveMerge {
  expectedBranchCount?: number;
  expectedBranchRefs: string[];
  expectedObjectBranches?: ExpectedObjectBranch[];
  kind: 'array' | 'object';
  schemaPath: string;
}

/** Ожидаемая форма anyOf с явно разрешёнными слияниями разошедшихся веток */
export interface AnyOfFoldingRule extends OperationSchemaTarget {
  allowedRecursiveMerges: AllowedRecursiveMerge[];
  expectedNullBranch: boolean;
  expectedObjectBranches: ExpectedObjectBranch[];
  target: ComparisonTarget;
}

/** Состояние одного folding rule: все доступные и уже использованные разрешения на merge */
export interface MergeContext {
  /** Все разрешения на merge */
  permissions: Map<string, AllowedRecursiveMerge>;
  root: Record<string, unknown>;
  rulePath: string;
  /** Уже использованные разрешения на merge */
  usedPermissions: Set<string>;
}

/** Schema после резолва вместе с исходным $ref, если он был */
export interface ResolvedSchema {
  ref: string | null;
  schema: Record<string, unknown>;
}
