import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import type { HighlightOptions } from '../types';
import { DEFAULT_HIGHLIGHT_OPTIONS } from '../const';

export function useHighlightOptions(
  highlightOptions?: HighlightOptions,
): ComputedRef<HighlightOptions> {
  return computed(() => ({
    caseSensitive: highlightOptions?.caseSensitive ?? DEFAULT_HIGHLIGHT_OPTIONS.caseSensitive,
    splitBySpace: highlightOptions?.splitBySpace ?? DEFAULT_HIGHLIGHT_OPTIONS.splitBySpace,
    highlightTag: highlightOptions?.highlightTag ?? DEFAULT_HIGHLIGHT_OPTIONS.highlightTag,
    highlightClass: highlightOptions?.highlightClass ?? DEFAULT_HIGHLIGHT_OPTIONS.highlightClass,
    highlightStyle: highlightOptions?.highlightStyle ?? DEFAULT_HIGHLIGHT_OPTIONS.highlightStyle,
    wrapperTag: highlightOptions?.wrapperTag ?? DEFAULT_HIGHLIGHT_OPTIONS.wrapperTag,
    wrapperClass: highlightOptions?.wrapperClass ?? DEFAULT_HIGHLIGHT_OPTIONS.wrapperClass,
  }));
}
