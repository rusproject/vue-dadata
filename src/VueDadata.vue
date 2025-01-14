<script lang="ts" setup>
import { computed } from 'vue';
import type { PropType, ComputedRef } from 'vue';
import WordHighlighter from 'vue-word-highlighter';
import { KeyEvent } from './types';
import type {
  BoundsType,
  LocationOptions,
  VueDadataClasses,
  HighlightOptions,
  Suggestion,
} from './types';
import { DEFAULT_CLASSES, DEFAULT_HIGHLIGHT_OPTIONS } from './const';
import { useClasses } from './composables/useClasses';
import { useHighlightOptions } from './composables/useHighlightOptions';
import { useSuggestions } from './composables/useSuggestions';

const props = defineProps({
  token: {
    type: String,
    required: true,
  },
  modelValue: {
    type: String,
    required: true,
  },
  suggestion: {
    type: Object as PropType<Suggestion | undefined>,
    default: () => undefined,
  },
  placeholder: {
    type: String,
    default: '',
  },
  url: {
    type: String,
    default: undefined,
  },
  debounceWait: {
    type: Number,
    default: 100,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  fromBound: {
    type: String as PropType<BoundsType>,
    default: undefined,
  },
  toBound: {
    type: String as PropType<BoundsType>,
    default: undefined,
  },
  inputName: {
    type: String,
    default: 'vue-dadata-input',
  },
  locationOptions: {
    type: Object as PropType<LocationOptions>,
    default: undefined,
  },
  classes: {
    type: Object as PropType<VueDadataClasses>,
    default: () => DEFAULT_CLASSES,
  },
  highlightOptions: {
    type: Object as PropType<HighlightOptions>,
    default: () => DEFAULT_HIGHLIGHT_OPTIONS,
  },
  selectOnBlur: {
    type: Boolean,
    default: false,
  },
  /** Controls browser built-in autocompletion. If "off" doesn't work for you, try "one-time-code" or "new-password" */
  inputAutocomplete: {
    type: String,
    default: 'off',
  },
  inputAutocapitalize: {
    type: String,
    default: 'off',
  },
  inputAutocorrect: {
    type: String,
    default: 'off',
  },
  inputSpellcheck: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'update:suggestion', 'handleError']);

const proxyClasses: ComputedRef<VueDadataClasses> = useClasses(props.classes);
const proxyHighlightOptions: ComputedRef<HighlightOptions> = useHighlightOptions(
  props.highlightOptions,
);

const mergedHighlightOptions = computed(() => {
  const wrapperClass = proxyHighlightOptions.value.wrapperClass
    ? proxyHighlightOptions.value.wrapperClass
    : proxyClasses.value.suggestionItem;
  const highlightClass = proxyHighlightOptions.value.highlightClass
    ? proxyHighlightOptions.value.highlightClass
    : proxyClasses.value.suggestionTextHighlight;
  return {
    ...proxyHighlightOptions.value,
    wrapperClass,
    highlightClass,
  };
});

const {
  queryProxy,
  suggestionProxy,
  inputFocused,
  suggestionsVisible,
  suggestionIndex,
  suggestionList,

  onInputChange,
  onKeyPress,
  onInputFocus,
  onInputBlur,
  onSuggestionClick,
} = useSuggestions(props, emit);
</script>

<template>
  <div :class="proxyClasses.container">
    <div :class="proxyClasses.search">
      <input
        :name="inputName"
        v-model="queryProxy"
        :class="proxyClasses.input"
        :autocapitalize="inputAutocapitalize"
        :autocomplete="inputAutocomplete"
        :autocorrect="inputAutocorrect"
        :disabled="disabled"
        :placeholder="placeholder"
        :spellcheck="inputSpellcheck"
        type="text"
        @blur="onInputBlur"
        @focus="onInputFocus"
        @input="onInputChange"
        @keyup.down="onKeyPress($event, KeyEvent.Down)"
        @keyup.enter="onKeyPress($event, KeyEvent.Enter)"
        @keyup.esc="onKeyPress($event, KeyEvent.Esc)"
        @keyup.up="onKeyPress($event, KeyEvent.Up)"
      />
    </div>
    <div
      v-if="inputFocused && suggestionsVisible && suggestionList.length && !disabled"
      :class="proxyClasses.suggestions"
    >
      <slot
        name="suggestions"
        :query="queryProxy"
        :suggestion="suggestionProxy"
        :suggestion-index="suggestionIndex"
        :suggestion-list="suggestionList"
      >
        <WordHighlighter
          v-for="(suggestionItemList, suggestionIndexList) in suggestionList"
          :key="`suggestion_${suggestionIndexList}`"
          :class="suggestionIndexList === suggestionIndex ? proxyClasses.suggestionCurrentItem : ''"
          :query="queryProxy"
          :text-to-highlight="suggestionItemList.value"
          v-bind="mergedHighlightOptions"
          @mousedown="onSuggestionClick(suggestionIndexList)"
        />
      </slot>
    </div>
  </div>
</template>

<style src="./vue-dadata.css"></style>
