/** Экранирует один сегмент JSON Pointer */
export function escapeJsonPointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

/** Убирает экранирование из одного сегмента JSON Pointer */
export function unescapeJsonPointerSegment(value: string): string {
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}

/** Парсит локальный $ref и проверяет каноничность экранирования каждого сегмента */
export function parseCanonicalLocalRef(ref: string, context: string): string[] {
  if (ref === '#') {
    return [];
  }

  if (!ref.startsWith('#/')) {
    throw new Error(`${context} must be a local JSON Pointer ref.`);
  }

  const encodedSegments = ref.slice(2).split('/');
  const segments = encodedSegments.map(unescapeJsonPointerSegment);

  // Собираем ref обратно, чтобы проверить каноничность экранирования
  if (formatLocalRef(segments) !== ref) {
    throw new Error(`${context} contains noncanonical JSON Pointer escaping: ${ref}.`);
  }

  return segments;
}

/** Собирает каноничный локальный $ref из сегментов JSON Pointer */
export function formatLocalRef(pointer: string[]): string {
  return pointer.length === 0 ? '#' : `#/${pointer.map(escapeJsonPointerSegment).join('/')}`;
}
