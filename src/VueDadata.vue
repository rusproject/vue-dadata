<template>
  <div :class="proxyClasses.container">
    <div :class="proxyClasses.search">
      <input
        :name="inputName"
        v-model="queryProxy"
        :class="proxyClasses.input"
        :disabled="disabled"
        :placeholder="placeholder"
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
    <div v-if="inputFocused && suggestionsVisible && !disabled" :class="proxyClasses.suggestions">
      <slot
        name="suggestions"
        :query="queryProxy"
        :suggestion="suggestionProxy"
        :suggestion-index="suggestionIndex"
        :suggestion-list="suggestionList"
      >
        <word-highlighter
          v-for="(suggestionItemList, suggestionIndexList) in suggestionList"
          :key="`suggestion_${suggestionIndexList}`"
          :class="suggestionIndexList === suggestionIndex ? proxyClasses.suggestionCurrentItem : ''"
          :query="queryProxy"
          :text-to-highlight="suggestionItemList.value"
          :wrapper-class="proxyClasses.suggestionItem"
          v-bind="proxyHighlightOptions"
          @mousedown="onSuggestionClick(suggestionIndexList)"
        />
      </slot>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
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
import useClasses from './classes';
import useHighlightOptions from './highlight-options';
import useSuggestions from './suggestions';

export default defineComponent({
  name: 'VueDadata',
  components: {
    WordHighlighter,
  },
  props: {
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
      type: String || (Number as PropType<number | string>),
      default: '1000ms',
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
    autocomplete: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'update:suggestion', 'handleError'],
  setup(props, { emit }) {
    const proxyClasses: ComputedRef<VueDadataClasses> = useClasses(props.classes);
    const proxyHighlightOptions: ComputedRef<HighlightOptions> = useHighlightOptions(
      props.highlightOptions,
    );
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

    return {
      KeyEvent,
      queryProxy,
      suggestionProxy,
      inputFocused,
      suggestionsVisible,
      suggestionList,
      proxyClasses,
      proxyHighlightOptions,
      suggestionIndex,

      onInputChange,
      onKeyPress,
      onInputFocus,
      onInputBlur,
      onSuggestionClick,
    };
  },
});
</script>

<style src="./index.css"></style>
