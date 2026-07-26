/** One stable contract difference extracted from oasdiff's version-specific JSON. */
export interface DiffUnit {
  added?: unknown;
  from?: unknown;
  kind: string;
  location: string;
  mediaType?: string;
  method: string;
  path: string;
  removed?: unknown;
  side: 'request' | 'response';
  status?: string;
  to?: unknown;
}

export interface DiffUnitsByPathOperation {
  request: DiffUnit[];
  responses: Record<string, DiffUnit[]>;
  responseStatuses: DiffUnit[];
}

export type DiffUnitsByPath = Record<string, Record<string, DiffUnitsByPathOperation>>;

export interface UnitContext {
  mediaType?: string;
  method: string;
  path: string;
  side: DiffUnit['side'];
  status?: string;
  units: DiffUnit[];
}
