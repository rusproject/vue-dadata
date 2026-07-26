import type {
  BRANCH_TYPES,
  FIO_GENDERS,
  PARTY_BY_STATUSES,
  PARTY_BY_TYPES,
  PARTY_KZ_STATUSES,
  PARTY_KZ_TYPES,
  PARTY_STATUSES,
  PARTY_TYPES,
} from '../constants';

export type FioGenders = (typeof FIO_GENDERS)[number];

export type PartyType = (typeof PARTY_TYPES)[number];
export type PartyStatus = (typeof PARTY_STATUSES)[number];
export type BranchType = (typeof BRANCH_TYPES)[number];

export type PartyByType = (typeof PARTY_BY_TYPES)[number];
export type PartyByStatus = (typeof PARTY_BY_STATUSES)[number];

export type PartyKzType = (typeof PARTY_KZ_TYPES)[number];
export type PartyKzStatus = (typeof PARTY_KZ_STATUSES)[number];

export type FmsUnitType = '0' | '1' | '2' | '3';

/**
 * Объект с массивом подсказок
 */
export type SuggestionsResponse<T> = {
  /** Массив подсказок или пустой массив */
  suggestions: T[];
};

export type CourtTypeCode =
  | 'AV'
  | 'AJ'
  | 'VS'
  | 'GV'
  | 'KV'
  | 'KJ'
  | 'OS'
  | 'OV'
  | 'RS'
  | 'AA'
  | 'AO'
  | 'AI'
  | 'AS'
  | 'MS';

export type CleanFieldType =
  | 'AS_IS'
  | 'ADDRESS'
  | 'PHONE'
  | 'PASSPORT'
  | 'NAME'
  | 'BIRTHDATE'
  | 'EMAIL'
  | 'VEHICLE'
  | 'SIMPLE_PARTY_NAME';
