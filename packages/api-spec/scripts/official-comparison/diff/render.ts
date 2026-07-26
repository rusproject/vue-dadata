// Stable grouping and line rendering for checked-in accepted-difference snapshots.
import { isRecord } from '../io.ts';
import type { DiffUnit, DiffUnitsByPath } from './types.ts';

interface SnapshotDiffUnit extends DiffUnit {
  required?: boolean;
}

export function buildDiffUnitsByPath(units: DiffUnit[]): DiffUnitsByPath {
  const grouped: DiffUnitsByPath = {};

  for (const unit of units) {
    const method = unit.method.toLowerCase();
    const pathGroup = (grouped[unit.path] ??= {});
    const operationGroup = (pathGroup[method] ??= {
      request: [],
      responses: {},
      responseStatuses: [],
    });

    if (unit.side === 'request') {
      operationGroup.request.push(unit);
      continue;
    }

    if (unit.kind === 'response-status-added' || unit.kind === 'response-status-deleted') {
      operationGroup.responseStatuses.push(unit);
      continue;
    }

    const status = unit.status ?? '<unknown>';

    (operationGroup.responses[status] ??= []).push(unit);
  }

  return sortDiffUnitsByPath(grouped);
}

export function renderDiffUnitSnapshot(units: DiffUnit[]): string {
  const lines = sortDiffUnits(coalesceRequiredness(units)).map(formatSnapshotLine);

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

export function sortDiffUnits<T extends DiffUnit>(units: T[]): T[] {
  return units.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.method.localeCompare(right.method) ||
      left.side.localeCompare(right.side) ||
      (left.status ?? '').localeCompare(right.status ?? '') ||
      left.location.localeCompare(right.location) ||
      left.kind.localeCompare(right.kind) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
}

/** Combines property presence and requiredness when both describe the same change. */
function coalesceRequiredness(units: DiffUnit[]): SnapshotDiffUnit[] {
  const unitIdentities = new Set(units.map(getDiffUnitIdentity));

  return units.flatMap((unit): SnapshotDiffUnit[] => {
    const counterpartKind = getRequirednessCounterpartKind(unit.kind);

    if (
      !counterpartKind ||
      !unitIdentities.has(getDiffUnitIdentity({ ...unit, kind: counterpartKind }))
    ) {
      return [{ ...unit }];
    }

    return unit.kind === 'schema-property-added' || unit.kind === 'schema-property-deleted'
      ? [{ ...unit, required: true }]
      : [];
  });
}

function sortDiffUnitsByPath(grouped: DiffUnitsByPath): DiffUnitsByPath {
  const sorted: DiffUnitsByPath = {};

  for (const path of Object.keys(grouped).sort((left, right) => left.localeCompare(right))) {
    const methods = grouped[path] ?? {};
    sorted[path] = {};

    for (const method of Object.keys(methods).sort((left, right) => left.localeCompare(right))) {
      const operation = methods[method] ?? {
        request: [],
        responses: {},
        responseStatuses: [],
      };
      const responses: Record<string, DiffUnit[]> = {};

      for (const status of Object.keys(operation.responses).sort((left, right) =>
        left.localeCompare(right),
      )) {
        responses[status] = sortDiffUnits([...operation.responses[status]]);
      }

      sorted[path][method] = {
        request: sortDiffUnits([...operation.request]),
        responses,
        responseStatuses: sortDiffUnits([...operation.responseStatuses]),
      };
    }
  }

  return sorted;
}

function getRequirednessCounterpartKind(kind: string): string | null {
  if (kind === 'schema-property-added') {
    return 'schema-required-added';
  }

  if (kind === 'schema-property-deleted') {
    return 'schema-required-deleted';
  }

  if (kind === 'schema-required-added') {
    return 'schema-property-added';
  }

  return kind === 'schema-required-deleted' ? 'schema-property-deleted' : null;
}

function getDiffUnitIdentity(unit: DiffUnit): string {
  return JSON.stringify(canonicalizeSnapshotValue(unit));
}

function formatSnapshotLine(unit: SnapshotDiffUnit): string {
  return [
    unit.path,
    unit.method,
    unit.side,
    unit.status,
    unit.mediaType,
    unit.location,
    unit.kind,
    ...formatValueFields(unit),
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');
}

function formatValueFields(unit: SnapshotDiffUnit): string[] {
  const fields: string[] = [];

  appendValueField(fields, unit, 'added');
  appendValueField(fields, unit, 'removed');
  appendValueField(fields, unit, 'from');
  appendValueField(fields, unit, 'to');

  if (unit.required !== undefined) {
    fields.push(`required=${String(unit.required)}`);
  }

  return fields;
}

function appendValueField(
  fields: string[],
  unit: DiffUnit,
  key: 'added' | 'from' | 'removed' | 'to',
): void {
  if (Object.prototype.hasOwnProperty.call(unit, key)) {
    fields.push(`${key}=${JSON.stringify(canonicalizeSnapshotValue(unit[key]))}`);
  }
}

function canonicalizeSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(canonicalizeSnapshotValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    sorted[key] = canonicalizeSnapshotValue(child);
  }

  return sorted;
}
