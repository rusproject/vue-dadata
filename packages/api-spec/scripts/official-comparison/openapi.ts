import type { OpenAPIV3_1 } from '@scalar/openapi-types';

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

export const HTTP_METHODS: HttpMethod[] = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
];

/**
 * Сортирует свойства в PathsObject по алфавиту через localeCompare
 * и возвращает новый отсортированный объект
 */
export function sortPaths(paths: OpenAPIV3_1.PathsObject): OpenAPIV3_1.PathsObject {
  const sorted: OpenAPIV3_1.PathsObject = {};

  for (const path of Object.keys(paths).sort((left, right) => left.localeCompare(right))) {
    sorted[path] = paths[path];
  }

  return sorted;
}

/** Создаёт regexp, находящий все переданные OpenAPI-пути (`^(path-1|path-2|path-3)$`) */
export function buildExactPathRegex(paths: string[]): string {
  if (paths.length === 0) {
    throw new Error('Attempt to build a regex from an empty list of paths');
  }

  const escape = (v: string) => v.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
  return `^(${paths.map(escape).join('|')})$`;
}
