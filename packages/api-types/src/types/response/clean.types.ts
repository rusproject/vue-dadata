import type { CleanFieldType } from '../common.types';
import type { AddressClean } from './address.types';
import type { DateClean } from './date.types';
import type { EmailClean } from './email.types';
import type { FioClean } from './fio.types';
import type { PassportClean } from './passport.types';
import type { PhoneClean } from './phone.types';
import type { VehicleClean } from './vehicle.types';

/** Поле в составной записи стандартизации, которое нужно оставить как есть (не стандартизировать) */
export interface AsIsClean {
  /** Исходное значение. */
  source: string;
}

/**
 * Результат обработки недокументированного типа `SIMPLE_PARTY_NAME`.
 *
 * Формат ответа не является публичным контрактом «Дадаты», поэтому значения
 * известных полей и дополнительные поля намеренно остаются неизвестными.
 */
export interface SimplePartyNameClean {
  [key: string]: unknown;
  source?: unknown;
  result?: unknown;
  stem?: unknown;
  opf?: unknown;
  qc?: unknown;
}

/**
 * Составная запись стандартизации
 * @see https://dadata.ru/api/clean/record/
 */
export interface CleanCombinedResponse {
  /**
   * Порядок и тип данных в поле `data`.
   *
   * Например, если в поле `data` три объекта - имя, адрес и телефон,
   * то в поле `structure` будет `[ "NAME", "ADDRESS", "PHONE" ]`, соответственно.
   */
  structure: CleanFieldType[];

  /**
   * Массив из одного элемента – тоже массива, внутри которого каждый элемент -
   * это одна из стандартизированных частей записи.
   * Какая именно - определяется структурой в поле `structure`.
   */
  data: [
    (
      | AsIsClean
      | AddressClean
      | PhoneClean
      | PassportClean
      | FioClean
      | DateClean
      | EmailClean
      | VehicleClean
      | SimplePartyNameClean
    )[],
  ];
}

export type CleanResponse<T> = [T];
