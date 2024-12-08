<script lang="ts" setup>
import { ref } from 'vue';
import VueDadata from './VueDadata.vue';
import type { HighlightOptions, Suggestion } from './types';

const token = import.meta.env.VITE_APP_DADATA_API_KEY as string;

const query = ref('');
const suggestion = ref<Suggestion | undefined>(undefined);
const highlightOptions: HighlightOptions = {
  highlightTag: 'span',
};

const reset = () => {
  query.value = '';
  suggestion.value = undefined;
};
</script>

<template>
  <main>
    <VueDadata
      v-model="query"
      v-model:suggestion="suggestion"
      :highlight-options="highlightOptions"
      :selectOnBlur="true"
      :token="token"
    />

    <section v-if="suggestion">
      Current suggestion:
      <button @click="reset">Clean</button>

      <pre>{{ suggestion }}</pre>
    </section>
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
  background-color: #e9ebef;
  font-size: 16px;
}

main {
  max-width: 700px;
  margin: 0 auto;
  padding: 48px 16px 200px;
}

section {
  margin-top: 10px;
  border-radius: 4px;
  background-color: #fff;
  padding: 10px 20px;
}

pre {
  white-space: pre-wrap;
  font-size: 14px;
}
</style>
