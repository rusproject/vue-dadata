// Renames explicitly equivalent schema components in comparison copies only.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { isRecord } from '../io.ts';
import { escapeJsonPointerSegment } from '../json-pointer.ts';
import type { ComparisonNormalizationDecision } from './comparison-normalization.ts';
import type { ComparisonTarget } from './schema-target.ts';

/** Правило замены имен схем (components.schemas) на имена для сравнения */
export interface SchemaComponentAliasRule {
  /** Имя компонента после переименования */
  canonicalName: string;
  /** Исходное имя компонента */
  sourceName: string;
  /** Сторона сравнения, к которой применяется правило */
  target: ComparisonTarget;
}

/** Renames explicitly paired schema components and every exact local ref to them. */
export function applySchemaComponentAliasRules(
  document: OpenAPIV3_1.Document,
  rules: SchemaComponentAliasRule[],
): ComparisonNormalizationDecision[] {
  if (rules.length === 0) {
    return [];
  }

  assertIndependentAliases(rules);

  const schemas = document.components?.schemas;

  if (!isRecord(schemas)) {
    throw new Error('Schema component aliases require components.schemas.');
  }

  // До первого изменения проверяем, что схемы из `sourceName` существуют, а имена из `canonicalName` ещё не заняты
  for (const rule of rules) {
    if (!Object.hasOwn(schemas, rule.sourceName)) {
      throw new Error(
        `Schema component alias source is missing: ${formatSchemaRef(rule.sourceName)}.`,
      );
    }

    if (Object.hasOwn(schemas, rule.canonicalName)) {
      throw new Error(
        `Schema component alias target already exists: ${formatSchemaRef(rule.canonicalName)}.`,
      );
    }
  }

  // TODO: если одно из последующих правил не найдёт ни одного `$ref`, предыдущие уже успеют изменить
  // документ. По-хорошему, нужен рефакторинг: сначала read-only проходом проверить наличие ссылок
  // для всех правил, а переименования применять только после успешной проверки всего набора
  return rules.map((rule) => {
    const sourceRef = formatSchemaRef(rule.sourceName);
    const canonicalRef = formatSchemaRef(rule.canonicalName);
    const rewrittenRefCount = rewriteExactRefs(document, sourceRef, canonicalRef);

    if (rewrittenRefCount === 0) {
      throw new Error(`Schema component alias source is not referenced: ${sourceRef}.`);
    }

    schemas[rule.canonicalName] = schemas[rule.sourceName];
    delete schemas[rule.sourceName];

    return {
      canonicalName: rule.canonicalName,
      kind: 'aliased-schema-component',
      path: sourceRef,
      ref: canonicalRef,
      rewrittenRefCount,
      sourceName: rule.sourceName,
    };
  });
}

/** Проверяет, что alias rules не содержат дублей, цепочек и циклов */
function assertIndependentAliases(rules: SchemaComponentAliasRule[]): void {
  const sourceNames = rules.map((rule) => rule.sourceName);
  const canonicalNames = rules.map((rule) => rule.canonicalName);

  if (new Set(sourceNames).size !== sourceNames.length) {
    throw new Error('Schema component aliases must not contain duplicate source names.');
  }

  if (new Set(canonicalNames).size !== canonicalNames.length) {
    throw new Error('Schema component aliases must not contain duplicate canonical names.');
  }

  const sourceSet = new Set(sourceNames);
  const overlappingNames = canonicalNames.filter((name) => sourceSet.has(name));

  if (overlappingNames.length > 0) {
    throw new Error(
      `Schema component aliases must not form chains or cycles: ${overlappingNames.sort().join(', ')}.`,
    );
  }
}

/** Рекурсивно заменяет точные совпадения `$ref` и возвращает количество замен */
function rewriteExactRefs(value: unknown, sourceRef: string, canonicalRef: string): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, item) => count + rewriteExactRefs(item, sourceRef, canonicalRef),
      0,
    );
  }

  if (!isRecord(value)) {
    return 0;
  }

  let count = 0;

  if (value.$ref === sourceRef) {
    value.$ref = canonicalRef;
    count += 1;
  }

  for (const child of Object.values(value)) {
    count += rewriteExactRefs(child, sourceRef, canonicalRef);
  }

  return count;
}

/** Строит локальный `$ref` указывающий на схему из `components.schemas`, экранируя имя для JSON Pointer */
function formatSchemaRef(name: string): string {
  return `#/components/schemas/${escapeJsonPointerSegment(name)}`;
}
