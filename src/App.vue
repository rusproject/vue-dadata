<template>
  <div class="vue-truncate-html-example">
    <VueDadata
      v-model="query"
      v-model:suggestion="suggestion"
      :autocomplete="true"
      :highlight-options="highlightOptions"
      :token="token"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import VueDadata from './VueDadata.vue';
import './index.css';
import type { HighlightOptions } from './types';

const token = import.meta.env.VITE_APP_DADATA_API_KEY as string;

const query = ref('');
const suggestion = ref(undefined);
const highlightOptions: HighlightOptions = {
  highlightClass: 'test',
  highlightTag: 'span',
};
</script>
