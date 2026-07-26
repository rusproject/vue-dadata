// Validates how official concrete/templates operations map onto our explicit operation surface.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import { HTTP_METHODS } from '../openapi.ts';
import type {
  ComparisonUnit,
  ExtensionMapping,
  OfficialOperationInventory,
  OfficialTemplateOperationRecord,
  OperationComparisonResult,
  OperationFamilyConfig,
  OperationIdentity,
  OperationMappings,
  OperationRecord,
  RefIdentity,
  TemplateExpansionMapping,
} from './types.ts';
import {
  compareOperationRecords,
  formatOperation,
  formatOperationIdentity,
  operationKey,
  sortComparisonUnits,
  sortOperationRecords,
} from './utils.ts';

export function compareOperationInventory(
  official: OfficialOperationInventory,
  ours: Map<string, OperationRecord>,
  mappings: OperationMappings,
  config: OperationFamilyConfig,
): OperationComparisonResult {
  const units: ComparisonUnit[] = [];
  const issues: string[] = [];
  const consumedOfficialTemplates = new Set<string>();
  const consumedTemplateMappings = new Set<string>();
  const consumedExtensionMappings = new Set<string>();
  const templateMappings = indexOperationMappings(
    mappings.templateExpansions,
    'operations.templateExpansions',
    issues,
  );
  const extensionMappings = indexOperationMappings(
    mappings.extensions,
    'operations.extensions',
    issues,
  );

  for (const officialOperation of official.concrete.values()) {
    const operationKeyValue = operationKey(officialOperation.path, officialOperation.method);

    if (!ours.has(operationKeyValue)) {
      issues.push(
        `Official concrete operation is missing in our spec: ${formatOperation(officialOperation)}`,
      );
    }
  }

  for (const ourOperation of sortOperationRecords([...ours.values()])) {
    const operationKeyValue = operationKey(ourOperation.path, ourOperation.method);
    const concreteOfficialOperation = official.concrete.get(operationKeyValue);

    if (concreteOfficialOperation) {
      pushConcreteUnit(units, ourOperation, concreteOfficialOperation);
      rejectStaleConcreteMappings(
        templateMappings,
        extensionMappings,
        operationKeyValue,
        ourOperation,
        issues,
      );
      continue;
    }

    const matchingTemplates = findMatchingTemplateOperations(official.templates, ourOperation);

    if (matchingTemplates.length > 1) {
      issues.push(
        `Operation matches multiple official templates and needs explicit comparator support: ${formatOperation(
          ourOperation,
        )} (${matchingTemplates.map((template) => template.path).join(', ')})`,
      );
      continue;
    }

    const matchingTemplate = matchingTemplates[0];

    if (matchingTemplate) {
      const mapping = templateMappings.get(operationKeyValue);

      if (!mapping) {
        issues.push(
          `Generic-derived operation is missing from operations.templateExpansions: ${formatOperation(
            ourOperation,
          )} (candidate official template ${matchingTemplate.path})`,
        );
        continue;
      }

      consumedTemplateMappings.add(operationKeyValue);
      consumedOfficialTemplates.add(operationKey(matchingTemplate.path, matchingTemplate.method));
      validateTemplateExpansionMapping(mapping, matchingTemplate, issues);
      pushTemplateUnit(units, ourOperation, matchingTemplate);
      continue;
    }

    const extensionMapping = extensionMappings.get(operationKeyValue);

    if (!extensionMapping) {
      issues.push(
        `Our operation has no official concrete or template analogue and is missing from operations.extensions: ${formatOperation(
          ourOperation,
        )}`,
      );
      continue;
    }

    consumedExtensionMappings.add(operationKeyValue);
    pushExtensionUnit(units, ourOperation);
  }

  rejectStaleMappings(
    mappings.templateExpansions,
    consumedTemplateMappings,
    'Template expansion',
    config,
    issues,
  );
  rejectStaleMappings(mappings.extensions, consumedExtensionMappings, 'Extension', config, issues);
  rejectUnusedOfficialTemplates(official.templates, consumedOfficialTemplates, issues);

  return {
    units: sortComparisonUnits(units),
    issues,
  };
}

function rejectUnusedOfficialTemplates(
  templates: OfficialTemplateOperationRecord[],
  consumedTemplates: Set<string>,
  issues: string[],
): void {
  for (const template of templates) {
    if (!consumedTemplates.has(operationKey(template.path, template.method))) {
      issues.push(
        `Official template has no explicit concrete expansion: ${formatOperation(template)}`,
      );
    }
  }
}

export function extractOfficialOperations(
  document: OpenAPIV3_1.Document,
  config: OperationFamilyConfig,
): OfficialOperationInventory {
  const concrete = new Map<string, OperationRecord>();
  const templates: OfficialTemplateOperationRecord[] = [];

  for (const [rawPath, pathItem] of Object.entries(document.paths ?? {})) {
    const path = normalizeOfficialPath(rawPath, config);

    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      const record: OperationRecord = {
        path,
        method,
        operation,
        requestRef: getRequestBodyJsonSchemaRef(operation.requestBody),
        responseRef: getResponseJsonSchemaRef(operation.responses, '200'),
      };

      if (path.includes('{')) {
        templates.push({
          ...record,
          prefix: getTemplatePrefix(path),
        });
      } else {
        concrete.set(operationKey(path, method), record);
      }
    }
  }

  return {
    concrete,
    templates: templates.sort(compareOperationRecords),
  };
}

export function extractOurFamilyOperations(
  document: OpenAPIV3_1.Document,
  official: OfficialOperationInventory,
): Map<string, OperationRecord> {
  const operations = new Map<string, OperationRecord>();
  const officialConcretePaths = new Set(
    [...official.concrete.values()].map((operation) => operation.path),
  );
  const templatePrefixes = official.templates.map((template) => template.prefix);

  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (
      !officialConcretePaths.has(path) &&
      !templatePrefixes.some((prefix) => path.startsWith(prefix))
    ) {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];

      if (!operation) {
        continue;
      }

      operations.set(operationKey(path, method), {
        path,
        method,
        operation,
        requestRef: getRequestBodyJsonSchemaRef(operation.requestBody),
        responseRef: getResponseJsonSchemaRef(operation.responses, '200'),
      });
    }
  }

  return operations;
}

function pushConcreteUnit(
  units: ComparisonUnit[],
  ourOperation: OperationRecord,
  officialOperation: OperationRecord,
): void {
  units.push({
    path: ourOperation.path,
    method: ourOperation.method,
    kind: 'official-concrete',
    officialSourcePath: officialOperation.path,
    officialRequestRef: officialOperation.requestRef,
    officialResponseRef: officialOperation.responseRef,
    ourRequestRef: ourOperation.requestRef,
    ourResponseRef: ourOperation.responseRef,
  });
}

function pushTemplateUnit(
  units: ComparisonUnit[],
  ourOperation: OperationRecord,
  templateOperation: OfficialTemplateOperationRecord,
): void {
  units.push({
    path: ourOperation.path,
    method: ourOperation.method,
    kind: 'template-expansion',
    officialSourcePath: templateOperation.path,
    officialRequestRef: templateOperation.requestRef,
    officialResponseRef: templateOperation.responseRef,
    ourRequestRef: ourOperation.requestRef,
    ourResponseRef: ourOperation.responseRef,
  });
}

function pushExtensionUnit(units: ComparisonUnit[], ourOperation: OperationRecord): void {
  units.push({
    path: ourOperation.path,
    method: ourOperation.method,
    kind: 'extension',
    officialSourcePath: null,
    officialRequestRef: null,
    officialResponseRef: null,
    ourRequestRef: ourOperation.requestRef,
    ourResponseRef: ourOperation.responseRef,
  });
}

function rejectStaleConcreteMappings(
  templateMappings: Map<string, TemplateExpansionMapping>,
  extensionMappings: Map<string, ExtensionMapping>,
  operationKeyValue: string,
  ourOperation: OperationRecord,
  issues: string[],
): void {
  if (templateMappings.has(operationKeyValue)) {
    issues.push(
      `Template expansion mapping is stale because official now declares a concrete operation: ${formatOperation(
        ourOperation,
      )}`,
    );
  }

  if (extensionMappings.has(operationKeyValue)) {
    issues.push(
      `Extension mapping is stale because official now declares a concrete operation: ${formatOperation(
        ourOperation,
      )}`,
    );
  }
}

function rejectStaleMappings(
  mappings: { our: OperationIdentity }[],
  consumedMappings: Set<string>,
  label: string,
  config: OperationFamilyConfig,
  issues: string[],
): void {
  for (const mapping of mappings) {
    const key = operationKey(mapping.our.path, mapping.our.method);

    if (!consumedMappings.has(key)) {
      issues.push(
        `${label} mapping was not used and is stale or points outside the compared ${config.family} surface: ${formatOperationIdentity(
          mapping.our,
        )}`,
      );
    }
  }
}

function validateTemplateExpansionMapping(
  mapping: TemplateExpansionMapping,
  officialTemplate: OfficialTemplateOperationRecord,
  issues: string[],
): void {
  if (mapping.official.pathTemplate !== officialTemplate.path) {
    issues.push(
      `Template expansion mapping mismatch for ${formatOperationIdentity(
        mapping.our,
      )}: official.pathTemplate=${mapping.official.pathTemplate} actual=${officialTemplate.path}`,
    );
  }

  if (mapping.official.method !== officialTemplate.method) {
    issues.push(
      `Template expansion mapping mismatch for ${formatOperationIdentity(
        mapping.our,
      )}: official.method=${mapping.official.method} actual=${officialTemplate.method}`,
    );
  }
}

function findMatchingTemplateOperations(
  templates: OfficialTemplateOperationRecord[],
  operation: OperationRecord,
): OfficialTemplateOperationRecord[] {
  return templates
    .filter((template) => template.method === operation.method)
    .filter((template) => operation.path.startsWith(template.prefix))
    .sort(
      (left, right) =>
        right.prefix.length - left.prefix.length || compareOperationRecords(left, right),
    );
}

function indexOperationMappings<T extends { our: OperationIdentity }>(
  entries: T[],
  sectionName: string,
  issues: string[],
): Map<string, T> {
  const result = new Map<string, T>();

  for (const entry of entries) {
    const key = operationKey(entry.our.path, entry.our.method);

    if (result.has(key)) {
      issues.push(`Duplicate ${sectionName} entry: ${formatOperationIdentity(entry.our)}`);
      continue;
    }

    result.set(key, entry);
  }

  return result;
}

function normalizeOfficialPath(rawPath: string, config: OperationFamilyConfig): string {
  if (!rawPath.startsWith(config.officialPathPrefix)) {
    return rawPath;
  }

  const trimmed = rawPath.slice(config.officialPathPrefix.length);
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getTemplatePrefix(path: string): string {
  return path.split('{')[0] ?? path;
}

function getRequestBodyJsonSchemaRef(
  requestBody: OpenAPIV3_1.OperationObject['requestBody'],
): RefIdentity {
  if (!requestBody) {
    return null;
  }

  if ('$ref' in requestBody) {
    return requestBody.$ref;
  }

  return getSchemaRef(requestBody.content?.['application/json']?.schema);
}

function getResponseJsonSchemaRef(
  responses: OpenAPIV3_1.OperationObject['responses'],
  statusCode: string,
): RefIdentity {
  const response = responses?.[statusCode];

  if (!response) {
    return null;
  }

  if ('$ref' in response) {
    return response.$ref;
  }

  return getSchemaRef(response.content?.['application/json']?.schema);
}

function getSchemaRef(
  schema: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.SchemaObject | undefined,
): RefIdentity {
  if (!schema) {
    return null;
  }

  if ('$ref' in schema) {
    return schema.$ref;
  }

  return '<inline-schema>';
}
