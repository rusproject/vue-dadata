import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { VueDadataClasses } from '../types';
import { DEFAULT_CLASSES } from '../const';

export function useClasses(classes?: VueDadataClasses): ComputedRef<VueDadataClasses> {
  return computed(() => ({
    container: classes?.container ?? DEFAULT_CLASSES.container,
    search: classes?.search ?? DEFAULT_CLASSES.search,
    input: classes?.input ?? DEFAULT_CLASSES.input,
    suggestions: classes?.suggestions ?? DEFAULT_CLASSES.suggestions,
    suggestionItem: classes?.suggestionItem ?? DEFAULT_CLASSES.suggestionItem,
    suggestionCurrentItem: classes?.suggestionCurrentItem ?? DEFAULT_CLASSES.suggestionCurrentItem,
    suggestionTextHighlight:
      classes?.suggestionTextHighlight ?? DEFAULT_CLASSES.suggestionTextHighlight,
  }));
}
