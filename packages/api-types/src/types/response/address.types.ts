import type { Override, PickAndOverride } from '../../types/helpers.types';
import type { SuggestionsResponse } from '../common.types';
import type { CleanResponse } from './clean.types';

export interface AddressMetroItem {
  /** название станции */
  name: null | string;
  /** название линии */
  line: null | string;
  /**
   * расстояние до станции в километрах
   * @format double
   */
  distance: null | number;
}

export interface AddressDivisionsAdministrativeItem {
  /** ФИАС-код */
  fias_id: string | null;
  /** КЛАДР-код */
  kladr_id: string | null;
  /** Тип (сокращенный), например "р-н" */
  type: string | null;
  /** Тип (полный), например "район" */
  type_full: string | null;
  /** Название, например "Академический" */
  name: string | null;
  /** Название с типом, например "р-н Академический" */
  name_with_type: string | null;
}

export type AddressDivisionsAdministrative = {
  [
    K in 'area' | 'city' | 'city_district' | 'settlement' | 'planning_structure'
  ]?: null | AddressDivisionsAdministrativeItem;
};

export type AddressDivisionsMunicipal = {
  [
    K in 'area' | 'city' | 'settlement' | 'planning_structure' | 'sub_area'
  ]?: null | AddressDivisionsAdministrativeItem;
};

export interface AddressDivisions {
  /**
   * Компоненты адреса в административном делении:
   *
   * - `area` — район региона;
   * - `city` — город;
   * - `city_district` — район города;
   * - `settlement` — населенный пункт;
   * - `planning_structure` — планировочная структура.
   */
  administrative: AddressDivisionsAdministrative;
  /**
   * Компоненты адреса в муниципальном делении. Отсутствует в новых версиях API, в старых не заполнялось.
   */
  municipal?: null | AddressDivisionsMunicipal;
}

export type FiasAddressFiasLevel =
  | '1' // <prettier wrap>
  | '3'
  | '4'
  | '5'
  | '6'
  | '65'
  | '7'
  | '8';

export type AddressFiasLevel =
  | '0' // <prettier wrap>
  | FiasAddressFiasLevel
  | '75'
  | '9'
  | '90'
  | '-1';

export type CleanAddressFiasLevel =
  | '0' // <prettier wrap>
  | FiasAddressFiasLevel
  | '75'
  | '9'
  | '90'
  | '91'
  | '-1';

export type CapitalMarker = '0' | '1' | '2' | '3' | '4';

/**
 * All possible fields for address objects returned by any Dadata API endpoint.
 *
 * Some fields are returned by multiple endpoints but may have different types (e.g., number vs string,
 * string vs 'always null', etc.). In such cases, we define the type according to the "suggest/address"
 * API here, and then re-declare it in the type definitions for other APIs. Examples: `source`, `qc_geo`.
 *
 * WE DON'T DEFINE API-SPECIFIC FIELDS AS OPTIONAL HERE, as we create separate interfaces with only needed fields for each api,
 * BUT WE DO IT HERE IF A FIELD IS NOT PRESENT UNTIL SPECIFIC VERSION OF DADATA API (as it affects any endpoint where it is used).
 *
 * Fields and descriptions are collected from the following sources:
 *
 * Address suggestions:
 * - {@link https://dadata.ru/api/suggest/address/}
 * - {@link https://dadata.ru/suggestions/usage/address/}
 * - {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=204669104}
 * - {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=204669107}
 *
 * Fias suggestions:
 * - {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=967835953}
 *
 * Banks and organizations suggestions:
 * - {@link https://dadata.ru/api/suggest/bank/}
 * - {@link https://dadata.ru/api/suggest/party/}
 *
 * Standartization ('clean'):
 * - {@link https://dadata.ru/api/clean/address/}
 *
 * About divisions:
 * - {@link https://dadata.ru/suggestions/usage/address/#divisions}
 * - {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=1326056589}
 * - {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=1358528932}
 * - {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=1349124365}
 */
interface AllAddressFields {
  /**
   * Почтовый индекс
   *
   * Дадата работает по объединенному справочнику налоговой службы ФИАС (ГАР) и Почты России.
   * В нем исправлены более 7 000 некорректных и отсутствующих индексов.
   * Однако, справочник индексов Почты детализирован только до населенных пунктов
   * (привязки к улицам и домам нет), поэтому исправлены не все-все индексы.
   */
  postal_code: null | string;
  /** Страна */
  country: string;
  /**
   * Двухсимвольный код страны ISO 3166
   * * (подсказки: v19.7+)
   */
  country_iso_code?: string;
  /**
   * Федеральный округ
   * * (подсказки: v19.5+)
   */
  federal_district?: null | string;
  /**
   * ФИАС-код региона
   *
   * для Белоруссии, Узбекистана и Казахстана — код OSM,
   * для остальных стран — код Geonames
   */
  region_fias_id: null | string;
  /** КЛАДР-код региона */
  region_kladr_id: null | string;
  /**
   * Код региона ISO 3166
   * * (подсказки: v19.7+)
   */
  region_iso_code?: null | string;
  /** Регион с типом */
  region_with_type: null | string;
  /** Тип региона (сокращенный) */
  region_type: null | string;
  /** Тип региона */
  region_type_full: null | string;
  /** Регион */
  region: null | string;
  /**
   * ФИАС-код района. Район - это:
   * - Административное деление: административный район региона
   * - Муниципальное деление: муниципальный район
   *
   * для Белоруссии, Узбекистана и Казахстана — код OSM,
   * для остальных стран — код Geonames
   */
  area_fias_id: null | string;
  /**
   * КЛАДР-код административного район региона
   */
  area_kladr_id: null | string;
  /**
   * Район с типом. Район - это:
   * - Административное деление: административный район региона
   * - Муниципальное деление: муниципальный район
   */
  area_with_type: null | string;
  /**
   * Тип района (сокращенный). Район - это:
   * - Административное деление: административный район региона
   * - Муниципальное деление: муниципальный район
   */
  area_type: null | string;
  /**
   * Тип района. Район - это:
   * - Административное деление: административный район региона
   * - Муниципальное деление: муниципальный район
   */
  area_type_full: null | string;
  /**
   * Район:
   * - Административное деление: административный район региона
   * - Муниципальное деление: муниципальный район
   */
  area: null | string;
  /**
   * ФИАС-код муниципального поселения
   * * (подсказки: v22.3+)
   */
  sub_area_fias_id?: null | string;
  /**
   * КЛАДР-код муниципального поселения
   * * (подсказки: v22.3+)
   */
  sub_area_kladr_id?: null | string;
  /**
   * Муниципальное поселение с типом
   * * (подсказки: v22.3+)
   */
  sub_area_with_type?: null | string;
  /**
   * Тип муниципального поселения (сокращенный)
   * * (подсказки: v22.3+)
   */
  sub_area_type?: null | string;
  /**
   * Тип муниципального поселения
   * * (подсказки: v22.3+)
   */
  sub_area_type_full?: null | string;
  /**
   * Муниципальное поселение
   * * (подсказки: v22.3+)
   */
  sub_area?: null | string;
  /**
   * ФИАС-код города
   *
   * для Белоруссии, Узбекистана и Казахстана — код OSM,
   * для остальных стран — код Geonames
   */
  city_fias_id: null | string;
  /** КЛАДР-код города */
  city_kladr_id: null | string;
  /** Город с типом */
  city_with_type: null | string;
  /** Тип города (сокращенный) */
  city_type: null | string;
  /** Тип города */
  city_type_full: null | string;
  /** Город */
  city: null | string;
  /** ФИАС-код района города (заполняется, только если район есть в ФИАС) */
  city_district_fias_id: null | string;
  /** Код КЛАДР района города (заполняется только при поиске типа ФИАС) */
  city_district_kladr_id: null;
  /**
   * Адм. район города с типом
   * * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   */
  city_district_with_type: null | string;
  /**
   * Тип адм. района города (сокращенный)
   * * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   */
  city_district_type: null | string;
  /**
   * Тип адм. района города
   * * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   */
  city_district_type_full: null | string;
  /**
   * Адм. район города
   * * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   */
  city_district: null | string;
  /**
   * ФИАС-код нас. пункта
   *
   * для Белоруссии, Узбекистана и Казахстана — код OSM,
   * для остальных стран — код Geonames
   */
  settlement_fias_id: null | string;
  /** КЛАДР-код нас. пункта */
  settlement_kladr_id: null | string;
  /** Населенный пункт с типом */
  settlement_with_type: null | string;
  /** Тип населенного пункта (сокращенный) */
  settlement_type: null | string;
  /** Тип населенного пункта */
  settlement_type_full: null | string;
  /** Населенный пункт */
  settlement: null | string;
  /** Код ФИАС планировочной структуры */
  planning_structure_fias_id: null | string;
  /** Код КЛАДР планировочной структуры */
  planning_structure_kladr_id: null | string;
  /** Планировочная структура с типом */
  planning_structure_with_type: null | string;
  /** Тип планировочной структуры (сокращенный) */
  planning_structure_type: null | string;
  /** Тип планировочной структуры */
  planning_structure_type_full: null | string;
  /** Планировочная структура */
  planning_structure: null | string;
  /**
   * ФИАС-код улицы
   *
   * для Белоруссии, Узбекистана и Казахстана — код OSM,
   * для остальных стран — код Geonames
   */
  street_fias_id: null | string;
  /** КЛАДР-код улицы */
  street_kladr_id: null | string;
  /** Улица с типом */
  street_with_type: null | string;
  /** Тип улицы (сокращенный) */
  street_type: null | string;
  /** Тип улицы */
  street_type_full: null | string;
  /** Улица */
  street: null | string;
  /**
   * ФИАС-код участка
   * * (подсказки: v21.12+)
   */
  stead_fias_id?: null | string;
  /** КЛАДР-код земельного участка */
  stead_kladr_id?: null | string;
  /**
   * Тип участка (сокращенный, = «уч»)
   * * (подсказки: v21.12+)
   */
  stead_type?: null | string;
  /**
   * Тип участка, = «участок»
   * * (подсказки: v21.12+)
   */
  stead_type_full?: null | string;
  /**
   * Участок
   * * (подсказки: v21.12+)
   */
  stead?: null | string;
  /**
   * ФИАС-код дома
   *
   * для Белоруссии, Узбекистана и Казахстана — код OSM,
   * для остальных стран — код Geonames
   */
  house_fias_id: null | string;
  /** КЛАДР-код дома */
  house_kladr_id: null | string;
  /** Тип дома (сокращенный) */
  house_type: null | string;
  /** Тип дома */
  house_type_full: null | string;
  /** Дом */
  house: null | string;
  /** Тип корпуса/строения (сокращенный) */
  block_type: null | string;
  /** Тип корпуса/строения */
  block_type_full: null | string;
  /** Корпус/строение (в ФИАС - только корпус) */
  block: null | string;
  /** Тип строения */
  building_type: null | string;
  /** Строение */
  building: null | string;
  /**
   * ФИАС-код квартиры / помещения
   * * (подсказки: v20.1+)
   */
  flat_fias_id?: null | string;
  /** Тип квартиры/помещения (сокращенный) */
  flat_type: null | string;
  /** Тип квартиры/помещения полностью */
  flat_type_full: null | string;
  /** Квартира/помещение */
  flat: null | string;
  /**
   * ФИАС-код комнаты
   * * (подсказки: v22.8+)
   */
  room_fias_id?: null | string;
  /**
   * Тип комнаты (сокращенный), "ком"
   * * (подсказки: v22.8+)
   */
  room_type?: null | string;
  /**
   * Тип комнаты, например, "комната"
   * * (подсказки: v22.8+)
   */
  room_type_full?: null | string;
  /**
   * Комната
   * * (подсказки: v22.8+)
   */
  room?: null | string;
  /** Абонентский ящик */
  postal_box: null | string;
  /**
   * ФИАС-код (он же код ГАР - object GUID) адреса для России.
   *
   * Идентификатор OpenStreetMap для Беларуси, Казахстана и Узбекистана.
   *
   * Для остальных стран — идентификатор объекта в базе GeoNames.
   *
   * в ФИАС: Код ФИАС:HOUSE.HOUSEGUID для домов
   * ADDROBJ.AOGUID для улиц, н/п и вышестоящих объектов.
   */
  fias_id: null | string;
  /**
   * Уровень детализации, до которого адрес найден в ФИАС:
   * - 0 — страна
   * - 1 — регион
   * - 3 — район
   * - 4 — город
   * - 5 — район города
   * - 6 — населенный пункт
   * - 7 — улица
   * - 8 — дом
   * - 9 — квартира (подсказки: v21.4+)
   * - 90 — доп. территория (подсказки: только в старых версиях API)
   * - 65 — планировочная структура
   * - 75 — земельный участок (подсказки: v21.12+)
   * - -1 — иностранный или пустой
   */
  fias_level: null | AddressFiasLevel;
  /** КЛАДР-код адреса */
  kladr_id: null | string;
  /**
   * Идентификатор объекта в базе GeoNames.
   *
   * Для российских адресов не заполняется, либо заполняется до уровня города.
   */
  geoname_id: null | string;
  /**
   * Признак центра района или региона:
   *
   * - 1 — центр района (Московская обл, Одинцовский р-н, г Одинцово)
   * - 2 — центр региона (Новосибирская обл, г Новосибирск)
   * - 3 — центр района и региона (Томская обл, г Томск)
   * - 4 — центральный район региона (Тюменская обл, Тюменский р-н)
   * - 0 — ничего из перечисленного (Московская обл, г Балашиха)
   */
  capital_marker: null | CapitalMarker;
  /** Код ОКАТО */
  okato: null | string;
  /** Код ОКТМО */
  oktmo: null | string;
  /** Кадастровый номер */
  cadastral_number: null | string;
  /** Код ИФНС для физических лиц */
  tax_office: null | string;
  /** Код ИФНС для организаций */
  tax_office_legal: null | string;
  /**
   * Список исторических названий объекта нижнего уровня.
   *
   * Если подсказка до улицы — это прошлые названия этой улицы, если до города — города.
   */
  history_values: null | string[];
  /**
   * Координаты: широта
   *
   * * Координаты есть у 97% домов в Москве, 91% в Санкт-Петербурге, 69% в других городах-миллиониках и 47% по остальной России.
   */
  geo_lat: null | string;
  /**
   * Координаты: долгота
   *
   * * Координаты есть у 97% домов в Москве, 91% в Санкт-Петербурге, 69% в других городах-миллиониках и 47% по остальной России.
   */
  geo_lon: null | string;
  /**
   * Код точности координат:
   *
   * - 0 — точные координаты
   * - 1 — ближайший дом
   * - 2 — улица
   * - 3 — населенный пункт
   * - 4 — город
   * - 5 — координаты не определены, или отсутствуют в справочнике
   * - 6 — не загружен справочник с геокоординатами (для коробочной версии подсказок)
   */
  qc_geo: null | '0' | '1' | '2' | '3' | '4' | '5' | '6';
  /**
   * Признак актуальности адреса в ФИАС:
   *
   * - 0 — актуальный
   * - 1–50 — переименован
   * - 51 — переподчинен
   * - 99 — удален
   */
  fias_actuality_state: null | string;
  /**
   * Административный округ (только для Москвы)
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   */
  city_area: null | string;
  /**
   * Внутри кольцевой?
   *
   * - IN_MKAD — внутри МКАД (Москва)
   * - OUT_MKAD — за МКАД (Москва и область)
   * - IN_KAD — внутри КАД (Санкт-Петербург)
   * - OUT_KAD — за КАД (Санкт-Петербург и область)
   * - пусто — в остальных случаях
   *
   * В подсказках по адресам заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Расширенный» и «Максимальный»
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  beltway_hit: null | 'IN_MKAD' | 'OUT_MKAD' | 'IN_KAD' | 'OUT_KAD';
  /**
   * Расстояние от кольцевой в км.
   * * Заполнено, только если beltway_hit: OUT_MKAD или OUT_KAD, иначе пустое
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Расширенный» и «Максимальный»
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  beltway_distance: null | string;
  /**
   * Кадастровый номер земельного участка
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * (подсказки: v22.4+)
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  stead_cadnum?: null | string;
  /**
   * Кадастровый номер дома
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * (подсказки: v22.4+)
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  house_cadnum?: null | string;
  /**
   * Количество квартир в доме
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * (подсказки: v24.3+)
   */
  house_flat_count?: null | string;
  /**
   * Кадастровый номер квартиры / помещения
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * (подсказки: v22.4+)
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  flat_cadnum?: null | string;
  /**
   * Площадь квартиры
   * * Площадь и стоимость есть у 70% квартир в России
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * В API организаций в сведениях об адресе организации может быть обозначено как `-1`
   */
  flat_area: null | string;
  /**
   * Рыночная стоимость м².
   * * Площадь и стоимость есть у 70% квартир в России
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * Только на тарифе «Максимальный»
   * * В API организаций в сведениях об адресе организации может быть обозначено как `-1`
   */
  square_meter_price: null | string;
  /**
   * Рыночная стоимость квартиры
   * * Площадь и стоимость есть у 70% квартир в России
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   */
  flat_price: null | string;
  /**
   * Кадастровый номер комнаты
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * (подсказки: v22.8+)
   */
  room_cadnum?: null | string;
  /**
   * Часовой пояс города для России, часовой пояс страны — для иностранных адресов.
   * * Если у страны несколько поясов, вернёт минимальный и максимальный через слеш: UTC+5/UTC+6
   *
   * * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  timezone: null | string;
  /**
   * Список ближайших станций метро (до трёх штук)
   *
   * - название станции
   * - название линии
   * - расстояние до станции в километрах
   *
   * В подсказках по адресам - заполняется при выборе конкретной подсказки (запрос с count=1)
   * * Только на тарифе «Максимальный»
   * * В API организаций и банков присутствует в сведениях об адресе на любом тарифе
   */
  metro: null | AddressMetroItem[];
  /**
   * Подъезд (заполняется только для стандартизации)
   * * (подсказки: v21.1+)
   */
  entrance?: null | string;
  /**
   * Этаж (заполняется только для стандартизации)
   * * (подсказки: v21.1+)
   */
  floor?: null | string;
  /**
   * Иерархический код адреса в ФИАС (СС+РРР+ГГГ+ППП+СССС+УУУУ+ДДДД).
   * Чаще всего вам нужен не он, а `fias_id`
   *
   * В подсказках по адресам - не заполняется.
   * Присутствует в стандартизации, подсказках ФИАС, подсказках по организациям и банкам в сведениях об адресе
   */
  fias_code: null | string;
  /**
   * Код пригодности к рассылке {@link https://dadata.ru/api/clean/address/#qc_complete}
   * * Только в Стандартизации и подсказках по банкам в сведениях об адресе
   */
  qc_complete: null | string;
  /**
   * Признак наличия дома в ФИАС {@link https://dadata.ru/api/clean/address/#qc_house}
   * * Только в Стандартизации и подсказках по банкам в сведениях об адресе
   */
  qc_house: null | string;
  /**
   * Код проверки адреса {@link https://dadata.ru/api/clean/address/#qc}
   * * Только в Стандартизации и подсказках по банкам и организациям в сведениях об адресе
   */
  qc: null | string;
  /**
   * - В стандартизации: Исходный адрес одной строкой
   * - В подсказках по организациям — адрес как в ЕГРЮЛ
   * - В подсказках по банкам — адрес как в справочнике БИК
   *
   * В остальных случаях — `null`
   */
  source: null | string;
  /** Нераспознанная часть адреса. (заполняется только для стандартизации) */
  unparsed_parts: null;
  /**
   * Поля адреса в административном делении
   * (только для стандартизации)
   * * Поле существует начиная с v22.3+
   */
  divisions?: null | AddressDivisions;
  /**
   * Зарезервировано, не возвращается ни в одном из API
   * (подсказки: v23.5+)
   */
  custom?: null;
  /** Стандартизованный адрес одной строкой (только для стандартизации) */
  result: null;
}

/** Fields that exist in both divisions in 'suggest/address' API */
type SuggestAddressCommonFields =
  | 'postal_code'
  | 'country'
  | 'country_iso_code'
  | 'federal_district'
  | 'region_fias_id'
  | 'region_kladr_id'
  | 'region_iso_code'
  | 'region_with_type'
  | 'region_type'
  | 'region_type_full'
  | 'region'
  | 'area_fias_id'
  | 'area_kladr_id'
  | 'area_with_type'
  | 'area_type'
  | 'area_type_full'
  | 'area'
  | 'city_fias_id'
  | 'city_kladr_id'
  | 'city_with_type'
  | 'city_type'
  | 'city_type_full'
  | 'city'
  | 'settlement_fias_id'
  | 'settlement_kladr_id'
  | 'settlement_with_type'
  | 'settlement_type'
  | 'settlement_type_full'
  | 'settlement'
  | 'street_fias_id'
  | 'street_kladr_id'
  | 'street_with_type'
  | 'street_type'
  | 'street_type_full'
  | 'street'
  | 'stead_fias_id'
  | 'stead_type'
  | 'stead_type_full'
  | 'stead'
  | 'house_fias_id'
  | 'house_kladr_id'
  | 'house_type'
  | 'house_type_full'
  | 'house'
  | 'block_type'
  | 'block_type_full'
  | 'block'
  | 'flat_fias_id'
  | 'flat_type'
  | 'flat_type_full'
  | 'flat'
  | 'room_fias_id'
  | 'room_type'
  | 'room_type_full'
  | 'room'
  | 'postal_box'
  | 'fias_id'
  | 'fias_level'
  | 'kladr_id'
  | 'geoname_id'
  | 'capital_marker'
  | 'okato'
  | 'oktmo'
  | 'tax_office'
  | 'tax_office_legal'
  | 'source'
  | 'history_values'
  | 'geo_lat'
  | 'geo_lon'
  | 'qc_geo'
  | 'fias_actuality_state'
  | 'city_area'
  | 'beltway_hit'
  | 'beltway_distance'
  | 'stead_cadnum'
  | 'house_cadnum'
  | 'house_flat_count'
  | 'flat_cadnum'
  | 'flat_area'
  | 'square_meter_price'
  | 'flat_price'
  | 'room_cadnum'
  | 'timezone'
  | 'metro'
  | 'entrance'
  | 'floor'
  | 'fias_code'
  | 'qc_complete'
  | 'qc_house'
  | 'qc'
  | 'unparsed_parts'
  | 'divisions';

/** Fields that exist only in 'ADMINISTRATIVE' division in 'suggest/address' API */
type AdminOnlyFields =
  | 'city_district_fias_id'
  | 'city_district_kladr_id'
  | 'city_district_with_type'
  | 'city_district_type'
  | 'city_district_type_full'
  | 'city_district';

/** Fields that exist only in 'MUNICIPAL' division in 'suggest/address' API */
type MunicipalOnlyFields =
  | 'sub_area_fias_id'
  | 'sub_area_kladr_id'
  | 'sub_area_with_type'
  | 'sub_area_type'
  | 'sub_area_type_full'
  | 'sub_area';

/**
 * Fields returned by the API when using the suggestions endpoint with the ADMINISTRATIVE division.
 */
export interface AddressAdminData extends Pick<
  AllAddressFields,
  SuggestAddressCommonFields | AdminOnlyFields
> {}

/**
 * Fields returned by the API when using the suggestions endpoint with the MUNICIPAL division. *
 */
export interface AddressMunicipalData extends Pick<
  AllAddressFields,
  SuggestAddressCommonFields | MunicipalOnlyFields
> {}

/**
 * Address fields returned by the Standardization ("clean") API.
 *
 * @see https://dadata.ru/api/clean/address/
 */
export interface AddressClean extends PickAndOverride<
  AllAddressFields,
  | 'postal_code'
  | 'country'
  | 'country_iso_code'
  | 'federal_district'
  | 'region_fias_id'
  | 'region_kladr_id'
  | 'region_iso_code'
  | 'region_with_type'
  | 'region_type'
  | 'region_type_full'
  | 'region'
  | 'area_fias_id'
  | 'area_kladr_id'
  | 'area_with_type'
  | 'area_type'
  | 'area_type_full'
  | 'area'
  | 'city_fias_id'
  | 'city_kladr_id'
  | 'city_with_type'
  | 'city_type'
  | 'city_type_full'
  | 'city'
  | 'city_district_fias_id'
  | 'city_district_kladr_id'
  | 'city_district_with_type'
  | 'city_district_type'
  | 'city_district_type_full'
  | 'city_district'
  | 'settlement_fias_id'
  | 'settlement_kladr_id'
  | 'settlement_with_type'
  | 'settlement_type'
  | 'settlement_type_full'
  | 'settlement'
  | 'street_fias_id'
  | 'street_kladr_id'
  | 'street_with_type'
  | 'street_type'
  | 'street_type_full'
  | 'street'
  | 'stead_fias_id'
  | 'stead_kladr_id'
  | 'stead_type'
  | 'stead_type_full'
  | 'stead'
  | 'house_fias_id'
  | 'house_kladr_id'
  | 'house_type'
  | 'house_type_full'
  | 'house'
  | 'house_flat_count'
  | 'block_type'
  | 'block_type_full'
  | 'block'
  | 'flat_fias_id'
  | 'flat_type'
  | 'flat_type_full'
  | 'flat'
  | 'postal_box'
  | 'room_type'
  | 'room_type_full'
  | 'room'
  | 'fias_id'
  | 'kladr_id'
  | 'geoname_id'
  | 'capital_marker'
  | 'okato'
  | 'oktmo'
  | 'tax_office'
  | 'tax_office_legal'
  | 'geo_lat'
  | 'geo_lon'
  | 'fias_actuality_state'
  | 'city_area'
  | 'beltway_hit'
  | 'beltway_distance'
  | 'stead_cadnum'
  | 'house_cadnum'
  | 'flat_cadnum'
  | 'flat_area'
  | 'square_meter_price'
  | 'flat_price'
  | 'timezone'
  | 'metro'
  | 'entrance'
  | 'floor'
  | 'fias_code',
  // overrides:
  {
    /** Исходный адрес одной строкой */
    source: string;

    /** Стандартизированный адрес одной строкой */
    result: string;

    /**
     * Нераспознанная часть адреса.
     * Для адреса `Москва, Митинская улица, 40, вход с торца` вернет `"ВХОД, С, ТОРЦА"`
     */
    unparsed_parts: null | string;

    /**
     * Код точности координат:
     * - 0 — точные координаты
     * - 1 — ближайший дом
     * - 2 — улица
     * - 3 — населенный пункт
     * - 4 — город
     * - 5 — координаты не определены, или отсутствуют в справочнике
     */
    qc_geo: 0 | 1 | 2 | 3 | 4 | 5;

    /**
     * Код пригодности к рассылке {@link https://dadata.ru/api/clean/address/#qc_complete}.
     *
     * Годится ли адрес для доставки корреспонденции:
     * | Код | Подходит для рассылки? | Описание |
     * |-|-|-|
     * | 0 | Да | Пригоден для почтовой рассылки |
     * | 10 | Под вопросом | Дома нет в ФИАС |
     * | 5 | Под вопросом | Нет квартиры. Подходит для юридических лиц или частных владений |
     * | 8 | Под вопросом | До почтового отделения — абонентский ящик или адрес до востребования. Подходит для писем, но не для курьерской доставки. |
     * | 9 | Под вопросом | Сначала проверьте, правильно ли Дадата разобрала исходный адрес |
     * | 1 | Нет | Нет региона |
     * | 2 | Нет | Нет города |
     * | 3 | Нет | Нет улицы |
     * | 4 | Нет | Нет дома |
     * | 6 | Нет | Адрес неполный |
     * | 7 | Нет | Иностранный адрес |
     */
    qc_complete: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

    /**
     * Признак наличия дома в ФИАС {@link https://dadata.ru/api/clean/address/#qc_house}
     *
     * - 2 — дом в ФИАС есть
     * - 3 — в ФИАС есть похожий дом и разница только в корпусе или строении
     * - 10 — дом в ФИАС не найден
     *
     * * (see {@link https://support.dadata.ru/communities/1/topics/3174-proverka-suschestvovaniya-adresa-cherez-api})
     *
     * В кобинации с полем `qc_geo` Уточняют вероятность успешной доставки письма:
     * | Код `qc_house` | Код `qc_geo` | Вероятность доставки | Описание
     * |-|-|-|-|
     * | 2 | любой | Высокая | Дом найден в ФИАС
     * | 10 | 0 | Высокая | Дом не найден в ФИАС, но есть на картах
     * | 10 | 1 | Средняя | Дом не найден в ФИАС, но есть похожий на картах
     * | 10 | ≥ 2 | Низкая | Дом не найден в ФИАС и на картах
     */
    qc_house: 2 | 3 | 10;

    /**
     * Код проверки адреса {@link https://dadata.ru/api/clean/address/#qc}
     *
     * Нужно ли вручную проверить распознанный адрес:
     * | Код | Нужно проверить вручную? | Описание |
     * |-|-|-|
     * | 0 | Нет | Адрес распознан уверенно |
     * | 1 | Да | Остались «лишние» части. Пример: «109341 Тверская область Москва Верхние Поля» — здесь лишняя «Тверская область». Либо в исходном адресе недостаточно данных для уверенного разбора. Пример: «Сходня Красная 12» — здесь нет региона и города. |
     * | 2 | Нет | Адрес пустой или заведомо «мусорный» |
     * | 3 | Да | Есть альтернативные варианты. Пример: «Москва Тверская-Ямская» — в Москве четыре Тверских-Ямских улицы |
     */
    qc: 0 | 1 | 2 | 3;

    /** Компоненты адреса в административном/муниципальном делении. */
    divisions: null | AddressDivisions;

    /**
     * Иерархический код адреса в ФИАС (СС+РРР+ГГГ+ППП+СССС+УУУУ+ДДДД).
     * Чаще всего вам нужен не он, а `fias_id` */
    fias_code: null | string;

    /**
     * Уровень детализации, до которого адрес найден в ФИАС:
     * - 0 — страна
     * - 1 — регион
     * - 3 — район
     * - 4 — город
     * - 5 — район города
     * - 6 — населенный пункт
     * - 7 — улица
     * - 8 — дом
     * - 9 — квартира (подсказки: v21.4+)
     * - 65 — планировочная структура
     * - 75 — земельный участок
     * - 90 — доп. территория
     * - 91 — улица в доп. территории
     * - -1 — иностранный или пустой.
     */
    fias_level: CleanAddressFiasLevel;
  }
> {}

export type CleanAddressResponse = CleanResponse<AddressClean>;

/**
 * Address fields returned by the API when using FIAS suggestions or FIAS-by-ID (findById/fias).
 * @see https://dadata.ru/api/suggest/fias/
 * @see https://dadata.ru/suggestions/usage/fias/
 * @see https://dadata.ru/api/find-fias/
 * @see https://confluence.hflabs.ru/pages/viewpage.action?pageId=967835937
 */
export interface FiasSuggestionData extends PickAndOverride<
  AllAddressFields,
  | 'postal_code'
  | 'region_fias_id'
  | 'region_kladr_id'
  | 'region_with_type'
  | 'region_type'
  | 'region_type_full'
  | 'region'
  | 'area_fias_id'
  | 'area_kladr_id'
  | 'area_with_type'
  | 'area_type'
  | 'area_type_full'
  | 'area'
  | 'city_fias_id'
  | 'city_kladr_id'
  | 'city_with_type'
  | 'city_type'
  | 'city_type_full'
  | 'city'
  | 'city_district_fias_id'
  | 'city_district_with_type'
  | 'city_district_type'
  | 'city_district_type_full'
  | 'city_district'
  | 'settlement_fias_id'
  | 'settlement_kladr_id'
  | 'settlement_with_type'
  | 'settlement_type'
  | 'settlement_type_full'
  | 'settlement'
  | 'planning_structure_fias_id'
  | 'planning_structure_kladr_id'
  | 'planning_structure_with_type'
  | 'planning_structure_type'
  | 'planning_structure_type_full'
  | 'planning_structure'
  | 'street_fias_id'
  | 'street_kladr_id'
  | 'street_with_type'
  | 'street_type'
  | 'street_type_full'
  | 'street'
  | 'house_fias_id'
  | 'house_kladr_id'
  | 'house_type'
  | 'house'
  | 'block'
  | 'building_type'
  | 'building'
  | 'fias_id'
  | 'kladr_id'
  | 'capital_marker'
  | 'okato'
  | 'oktmo'
  | 'cadastral_number'
  | 'tax_office'
  | 'tax_office_legal'
  | 'source'
  | 'history_values'
  | 'fias_actuality_state'
  | 'fias_code'
  | 'qc',
  // overrides:
  {
    /** Иерархический код адреса в ФИАС (СС+РРР+ГГГ+ППП+СССС+УУУУ+ДДДД). Чаще всего вам нужен не он, а `fias_id` */
    fias_code: null | string;

    /**
     * Уровень детализации, до которого адрес найден в ФИАС:
     * - 1 — регион
     * - 3 — район
     * - 4 — город
     * - 5 — район города
     * - 6 — населенный пункт
     * - 65 — планировочная структура
     * - 7 — улица
     * - 8 — дом
     */
    fias_level: FiasAddressFiasLevel;

    /** КЛАДР-код района города */
    city_district_kladr_id: null | string;
  }
> {}

export interface PartySuggestionAddressData extends Override<
  AddressAdminData,
  {
    /** Исходный адрес из ЕГРЮЛ одной строкой */
    source: string;
    /**
     * код качества адреса (19.1+)
     * - `0` – Адрес из ЕГРЮЛ распознан уверенно
     * - `1` – Остались «лишние» части
     * - `3` – Есть альтернативные варианты
     */
    qc: '0' | '1' | '3';
    /** Иерархический код адреса в ФИАС (СС+РРР+ГГГ+ППП+СССС+УУУУ+ДДДД). Чаще всего вам нужен не он, а `fias_id` */
    fias_code: null | string;
  }
> {}

export interface BankSuggestionAddressData extends Override<
  AddressAdminData,
  {
    /** Адрес одной строкой как в справочнике БИК */
    source: string;
    /** Код пригодности адреса к рассылке {@link https://dadata.ru/api/clean/address/#qc_complete} */
    qc_complete: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
    /** Признак наличия дома в ФИАС {@link https://dadata.ru/api/clean/address/#qc_house} */
    qc_house: '2' | '3' | '10';
    /**
     * код качества адреса (19.1+)
     * - `0` – Адрес из БИК распознан уверенно
     * - `1` – Остались «лишние» части
     * - `3` – Есть альтернативные варианты
     */
    qc: '0' | '1' | '3';
    /** Иерархический код адреса в ФИАС (СС+РРР+ГГГ+ППП+СССС+УУУУ+ДДДД). Чаще всего вам нужен не он, а `fias_id` */
    fias_code: null | string;
  }
> {}

/** Common for AddressSuggestion and FiasSuggestion */
export interface BaseAddressSuggestion<T = AddressAdminData | AddressMunicipalData> {
  /**
   * Адрес одной строкой (как показывается в списке подсказок),
   * сокращённый по правилам, описанным здесь:
   * {@link https://confluence.hflabs.ru/pages/viewpage.action?pageId=1105068073}
   * * (может меняться в зависимости от текущих параметров запроса)
   */
  value: string;
  /** Адрес одной строкой (полный, с индексом) */
  unrestricted_value: string;
  /** Подробные поля адреса */
  data: T;
}

/**
 * Объект подсказки в административном делении (параметр `division`=`ADMINISTRATIVE`)
 */
export interface AddressAdminSuggestion extends BaseAddressSuggestion<AddressAdminData> {}

/**
 * Объект подсказки в муниципальном делении (параметр `division`=`MUNICIPAL`)
 */
export interface AddressMunicipalSuggestion extends BaseAddressSuggestion<AddressMunicipalData> {}

// About Geolocate API (https://dadata.ru/api/geolocate/)
// DaData page says that some fields are not filled in this API method, but at least in new versions - they are

/** Объект с массивом подсказок в административном делении */
export type SuggestAddressAdminResponse = SuggestionsResponse<AddressAdminSuggestion>;
/** Объект с массивом подсказок в муниципальном делении */
export type SuggestAddressMunicipalResponse = SuggestionsResponse<AddressMunicipalSuggestion>;

/**
 * Ответ содержит объект с массивом подсказок или в административном (по умолчанию)
 * или в муниципальном (если передано `"division": "MUNICIPAL"`) делении
 */
export type SuggestAddressResponse = SuggestAddressAdminResponse | SuggestAddressMunicipalResponse;

export type IpLocateResponse = {
  location: AddressAdminSuggestion | AddressMunicipalSuggestion | null;
};
