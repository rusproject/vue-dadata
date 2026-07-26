// Builds the official operation projection that is safe to compare with our concrete paths.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { cloneJson, cloneOptionalJson } from '../io.ts';
import { sortPaths } from '../openapi.ts';
import type {
  ComparisonUnit,
  OfficialOperationInventory,
  OperationFamilyConfig,
  OperationRecord,
  ProjectionResult,
} from './types.ts';
import { assignOperation, operationKey, slugifyPath, sortComparisonUnits } from './utils.ts';

export function buildProjectedOfficialSpec(
  units: ComparisonUnit[],
  official: OfficialOperationInventory,
  sourceDocument: OpenAPIV3_1.Document,
  config: OperationFamilyConfig,
): ProjectionResult {
  const projectedPaths: OpenAPIV3_1.PathsObject = {};
  let concreteOperationCount = 0;
  let templateExpandedOperationCount = 0;
  let excludedExtensionCount = 0;

  for (const unit of sortComparisonUnits(units)) {
    if (unit.kind === 'extension') {
      excludedExtensionCount += 1;
      continue;
    }

    const sourceOperation = getProjectionSourceOperation(unit, official);
    const projectedOperation =
      unit.kind === 'template-expansion'
        ? normalizeTemplateExpandedOperation(sourceOperation.operation, unit)
        : cloneJson(sourceOperation.operation);
    const pathItem = projectedPaths[unit.path] ?? {};

    assignOperation(pathItem, unit.method, projectedOperation);
    projectedPaths[unit.path] = pathItem;

    if (unit.kind === 'template-expansion') {
      templateExpandedOperationCount += 1;
    } else {
      concreteOperationCount += 1;
    }
  }

  const document: OpenAPIV3_1.Document = {
    openapi: sourceDocument.openapi,
    info: {
      ...(cloneJson(sourceDocument.info) ?? {}),
      title: `${sourceDocument.info?.title ?? `Official ${config.family} API`} (projected ${config.family} slice)`,
    },
    servers: cloneJson(sourceDocument.servers),
    security: cloneOptionalJson(sourceDocument.security),
    paths: sortPaths(projectedPaths),
    components: cloneJson(sourceDocument.components),
  };

  return {
    document,
    projectedOperationCount: concreteOperationCount + templateExpandedOperationCount,
    projectedPathCount: Object.keys(projectedPaths).length,
    concreteOperationCount,
    templateExpandedOperationCount,
    excludedExtensionCount,
  };
}

function getProjectionSourceOperation(
  unit: ComparisonUnit,
  official: OfficialOperationInventory,
): OperationRecord {
  if (!unit.officialSourcePath) {
    throw new Error(`Projection source is missing for ${unit.method.toUpperCase()} ${unit.path}.`);
  }

  if (unit.kind === 'official-concrete') {
    const concreteOperation = official.concrete.get(
      operationKey(unit.officialSourcePath, unit.method),
    );

    if (!concreteOperation) {
      throw new Error(
        `Concrete projection source was not found: ${unit.method.toUpperCase()} ${unit.officialSourcePath}.`,
      );
    }

    return concreteOperation;
  }

  const templateOperation = official.templates.find(
    (template) => template.path === unit.officialSourcePath && template.method === unit.method,
  );

  if (!templateOperation) {
    throw new Error(
      `Template projection source was not found: ${unit.method.toUpperCase()} ${unit.officialSourcePath}.`,
    );
  }

  return templateOperation;
}

function normalizeTemplateExpandedOperation(
  operation: OpenAPIV3_1.OperationObject,
  unit: ComparisonUnit,
): OpenAPIV3_1.OperationObject {
  const projectedOperation = cloneJson(operation);

  if (projectedOperation.parameters) {
    const parameters = projectedOperation.parameters.filter((parameter) => {
      if ('$ref' in parameter) {
        return true;
      }

      return parameter.in !== 'path' || unit.path.includes(`{${parameter.name}}`);
    });

    if (parameters.length > 0) {
      projectedOperation.parameters = parameters;
    } else {
      delete projectedOperation.parameters;
    }
  }

  if (projectedOperation.operationId) {
    projectedOperation.operationId = `${projectedOperation.operationId}__projected__${slugifyPath(
      unit.path,
    )}`;
  }

  return projectedOperation;
}
