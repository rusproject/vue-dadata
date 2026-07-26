// Data model for explicit official-to-local operation mappings.
import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import type { HttpMethod } from '../openapi.ts';

export type ComparisonUnitKind = 'official-concrete' | 'template-expansion' | 'extension';
export type RefIdentity = string | null;

export interface OperationRecord {
  path: string;
  method: HttpMethod;
  operation: OpenAPIV3_1.OperationObject;
  requestRef: RefIdentity;
  responseRef: RefIdentity;
}

export interface OfficialTemplateOperationRecord extends OperationRecord {
  prefix: string;
}

export interface OfficialOperationInventory {
  concrete: Map<string, OperationRecord>;
  templates: OfficialTemplateOperationRecord[];
}

export interface OperationIdentity {
  path: string;
  method: HttpMethod;
}

export interface OfficialTemplateIdentity {
  pathTemplate: string;
  method: HttpMethod;
}

export interface TemplateExpansionMapping {
  our: OperationIdentity;
  official: OfficialTemplateIdentity;
}

export interface ExtensionMapping {
  our: OperationIdentity;
}

export interface OperationMappings {
  extensions: ExtensionMapping[];
  templateExpansions: TemplateExpansionMapping[];
}

export interface ComparisonUnit {
  path: string;
  method: HttpMethod;
  kind: ComparisonUnitKind;
  officialSourcePath: string | null;
  officialRequestRef: RefIdentity;
  officialResponseRef: RefIdentity;
  ourRequestRef: RefIdentity;
  ourResponseRef: RefIdentity;
}

export interface ProjectionResult {
  document: OpenAPIV3_1.Document;
  projectedOperationCount: number;
  projectedPathCount: number;
  concreteOperationCount: number;
  templateExpandedOperationCount: number;
  excludedExtensionCount: number;
}

export interface OperationFamilyConfig {
  family: string;
  officialPathPrefix: string;
}

export interface OperationComparisonResult {
  issues: string[];
  units: ComparisonUnit[];
}
