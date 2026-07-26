import type { DIVISION_TYPES, LANGUAGES } from '../../constants';
import type {
  BaseSuggestPayload,
  BoundType,
  KladrIdFilter,
  LocationRestriction,
} from './suggest-payload.types';

/** Объект для передачи фильтра по радиусу от заданной точки */
export interface RadiusFilter {
  /**
   * Географическая широта, например: `'59.244634'`
   * @format double
   */
  lat: string | number;
  /**
   * Географическая долгота, например: `'39.913355'`
   * @format double
   */
  lon: string | number;
  /**
   * Радиус поиска в метрах
   * @format double
   * @default 100
   * @maximum 100000
   */
  radius_meters?: number | null;
}

export type Language = (typeof LANGUAGES)[number];

export type DivisionType = (typeof DIVISION_TYPES)[number];

/** Объект для передачи границы поиска */
export interface Bound {
  /**
   * Включать ли объекты указанного в `to_bound/from_bound` в результаты.
   *
   * При `false` - подсказки, имеющие указанный в `to_bound/from_bound` уровень, исключаются из результатов.
   *
   * @default true
   */
  include?: boolean | null;
  /**
   * Возможные значения:
   * - `country` - Страна
   * - `region` - Регион
   * - `area` - Район
   * - `city` - Город
   * - `settlement` - Населенный пункт
   * - `planning_structure` - Планировочная структура *(в официальной документации - только для ФИАС,
   * но работает также для подсказок по адресу)*
   * - `street` - Улица
   * - `house` - Дом
   * - `flat` - Квартира (только для `to_bound`)
   */
  value: BoundType;
}

/**
 * Параметры запроса к API "Подсказки по адресу".
 *
 * @see https://dadata.ru/api/suggest/address/
 * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=204669107
 */
export interface SuggestAddressPayload extends BaseSuggestPayload {
  /**
   * Приоритет города или региона при ранжировании.
   * Передавайте код КЛАДР (kladr_id). Можно указать несколько кодов.
   *
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=285343795
   */
  locations_boost?: KladrIdFilter[] | null;

  /**
   * Гранулярные подсказки – "левая" граница.
   *
   * Если задано, ответ будет включать только объекты
   * этого уровня и ниже; поиск также производится в первую очередь по объектам этого уровня и ниже.
   *
   * Примеры: если указать `from_bound = 'settlement'`:
   * - Запрос `"москва"` → в результатах не будет подсказки непосредственно `"г Москва"`,
   * но будут поселения и улицы, в названии которых есть "москва".
   * - Запрос `"москва, 3"` → попытается найти нас.пункты и улицы с этим сочетанием
   * в названии, но результаты также могут включать, например, `"г Москва, ул 3-я Бебеля"`
   *
   * Доступные границы для `from_bound`:
   *
   * - `country` - Страна
   * - `region` - Регион
   * - `area` - Район
   * - `city` - Город
   * - `settlement` - Населенный пункт
   * - `planning_structure` - Планировочная структура *(в официальной документации - только для ФИАС,
   * но работает также для подсказок по адресу)*
   * - `street` - Улица
   * - `house` - Дом
   *
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=222888017
   */
  from_bound?: Bound;

  /**
   * Гранулярные подсказки – "правая" граница.
   *
   * Если задано, подсказки будут только до этой границы (включительно).
   * Например, чтобы исключить поиск по улицам, можно указать `to_bound = 'settlement'`,
   * и при запросе `"москва новая"` результаты не будут включать `"г Москва, ул Новая"`,
   * но могут включать `"Брянская обл, пос. Новая Москва"`.
   *
   * Доступные границы для `from_bound`:
   *
   * - `country` - Страна
   * - `region` - Регион
   * - `area` - Район
   * - `city` - Город
   * - `settlement` - Населенный пункт
   * - `planning_structure` - Планировочная структура *(в официальной документации - только для ФИАС,
   * но работает также для подсказок по адресу)*
   * - `street` - Улица
   * - `house` - Дом
   * - `flat` - Квартира
   *
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=222888017
   */
  to_bound?: Bound;

  /**
   * Ограничение сектора поиска адреса.
   *
   * Чтобы искать адреса только в определенном регионе, городе, районе и т.д.,
   * укажите их в параметре locations.
   * Можно указать несколько ограничений, но не более 10.
   *
   * **Адрес без региона и города:**
   * Чтобы адрес одной строкой в ответе (поле `value`) не содержал регион / город, заданный в ограничении,
   * добавьте в запрос параметр `restrict_value` = true.
   *
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=204669108
   */
  locations?: LocationRestriction[] | null;

  /**
   * Используется совместно с ограничениями (параметр `locations`), чтобы адрес в ответе
   * (поле `value`) не содержал регион / город / район и т.д., заданный в ограничении.
   *
   * - @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=222888017
   * - @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=1023737934#id-Ограничениепоназваниюадресногообъекта-Адресбезрегионаигорода
   * - @see https://confluence.hflabs.ru/display/SGTDOC/address.value#address.value-Параметрrestrict_value
   *
   * @default false
   */
  restrict_value?: boolean | null;

  /**
   * Ограничение по радиусу окружности.
   * Позволяет искать адреса в определенном радиусе от заданной точки.
   * Можно указать несколько точек.
   *
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=990871806
   */
  locations_geo?: RadiusFilter[] | null;

  /**
   * Язык результатов поиска. Поддерживается русский и английский.
   * Влияет на все поля в объекте адреса.
   * @default 'RU'
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=976388726
   */
  language?: Language | null;

  /**
   * Административное либо муниципальное деление.
   *
   * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=1326056589
   * @default 'ADMINISTRATIVE'
   */
  division?: DivisionType | null;
}
