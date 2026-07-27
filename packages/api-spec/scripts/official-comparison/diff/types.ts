type RequestResponseScope = 'request' | 'response';
type DiffUnitScope = 'operation' | RequestResponseScope;

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
  scope: DiffUnitScope;
  status?: string;
  to?: unknown;
}

/**
 * Наборы DiffUnit для одной операции, разделенные на четыре группы:
 * - `operation` - различия в наличии самой операции
 * - `request` - список различий в контракте запроса
 * - `responses` - списки различий в контракте ответов (по кодам ответа)
 * - `responseStatuses` - различия в самих кодах ответа
 */
export interface DiffUnitsByPathOperation {
  operation: DiffUnit[];
  request: DiffUnit[];
  responses: Record<string, DiffUnit[]>;
  responseStatuses: DiffUnit[];
}

/** DiffUnit, сгруппированные сначала по path, затем по HTTP-методу */
export type DiffUnitsByPath = Record<string, Record<string, DiffUnitsByPathOperation>>;

/** Контекст, который передаём при сборе DiffUnit из вложенного ответа oasdiff */
export interface UnitContext {
  mediaType?: string;
  method: string;
  path: string;
  scope: RequestResponseScope;
  status?: string;
  units: DiffUnit[];
}
