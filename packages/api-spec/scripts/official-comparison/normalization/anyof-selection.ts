// Selects one explicitly expected branch from broad official anyOf responses.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { isRecord } from '../io.ts';
import { parseCanonicalLocalRef } from '../json-pointer.ts';
import type { ComparisonNormalizationDecision } from './comparison-normalization.ts';
import {
  type ComparisonTarget,
  type OperationSchemaTarget,
  findAndMaterializeOperationSchema,
  formatOperationSchemaTarget,
} from './schema-target.ts';

/** Правило выбора одной явно ожидаемой `$ref`-ветки из `anyOf` */
export interface AnyOfSelectionRule extends OperationSchemaTarget {
  /** Полный ожидаемый набор `$ref`-веток; порядок не важен */
  expectedBranchRefs: string[];
  /** Единственный `$ref`, которым заменяем `anyOf` */
  selectedRef: string;
  target: ComparisonTarget;
}

/** Annotation keywords, которые сохраняем при выборе ветки */
const ANNOTATION_KEYS = new Set(['description']);

/** Все keywords, разрешённые в target схеме с `anyOf` */
const TARGET_KEYS = new Set(['anyOf', ...ANNOTATION_KEYS]);

/** Selects explicitly curated branches from operation-local anyOf schemas. */
export function applyAnyOfSelectionRules(
  document: OpenAPIV3_1.Document,
  rules: AnyOfSelectionRule[],
): ComparisonNormalizationDecision[] {
  return rules.map((rule) => applyAnyOfSelectionRule(document, rule));
}

/** Проверяет целевую схему по правилу выбора ветки и заменяет `anyOf` выбранным `$ref` */
function applyAnyOfSelectionRule(
  document: OpenAPIV3_1.Document,
  rule: AnyOfSelectionRule,
): ComparisonNormalizationDecision {
  const path = formatOperationSchemaTarget(rule);
  const schema = findAndMaterializeOperationSchema(document, rule, 'AnyOf selection');
  const unsupportedKeys = Object.keys(schema).filter((key) => !TARGET_KEYS.has(key));

  if (unsupportedKeys.length > 0) {
    throw new Error(
      `AnyOf selection found unsupported schema keywords ${unsupportedKeys.sort().join(', ')} at ${path}.`,
    );
  }

  if (!Array.isArray(schema.anyOf) || schema.anyOf.length === 0) {
    throw new Error(`AnyOf selection target is missing a non-empty anyOf: ${path}.`);
  }

  // Проверяем каноничность всех `$ref`, заданных в правиле
  parseCanonicalLocalRef(rule.selectedRef, `${path} selectedRef`);
  const expectedBranchRefs = rule.expectedBranchRefs.map((ref, index) => {
    parseCanonicalLocalRef(ref, `${path} expectedBranchRefs[${index}]`);
    return ref;
  });

  // Принимаем только локальные `$ref`-ветки без дополнительных keywords
  const branchRefs = schema.anyOf.map((branch, index) => {
    if (!isRecord(branch) || Object.keys(branch).length !== 1 || typeof branch.$ref !== 'string') {
      throw new Error(
        `AnyOf selection requires exact local-$ref branches at ${path} anyOf[${index}].`,
      );
    }

    parseCanonicalLocalRef(branch.$ref, `${path} anyOf[${index}] $ref`);
    return branch.$ref;
  });

  // Требуем уникальный набор веток, точно совпадающий с ожидаемым без учёта порядка
  if (new Set(branchRefs).size !== branchRefs.length) {
    throw new Error(`AnyOf selection found duplicate branch refs at ${path}.`);
  }

  if (!sameStringSet(branchRefs, expectedBranchRefs)) {
    throw new Error(
      `AnyOf selection found unexpected branch refs at ${path}: expected [${expectedBranchRefs
        .toSorted()
        .join(', ')}], actual [${branchRefs.toSorted().join(', ')}].`,
    );
  }

  const selectedCount = branchRefs.filter((ref) => ref === rule.selectedRef).length;

  if (selectedCount !== 1) {
    throw new Error(
      `AnyOf selection expected selectedRef ${rule.selectedRef} exactly once at ${path}; found ${selectedCount}.`,
    );
  }

  // Заменяем `anyOf` на `$ref`, сохраняя разрешённые annotation keywords
  delete schema.anyOf;
  schema.$ref = rule.selectedRef;

  return {
    branchRefs,
    compositionKey: 'anyOf',
    kind: 'selected-anyof-branch',
    path,
    ref: rule.selectedRef,
  };
}

/** Сравнивает два массива строк без учёта порядка */
function sameStringSet(left: string[], right: string[]): boolean {
  const sortedRight = right.toSorted();

  return (
    left.length === right.length &&
    left.toSorted().every((value, index) => value === sortedRight[index])
  );
}
