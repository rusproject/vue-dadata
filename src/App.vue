<script lang="ts" setup>
import { ref } from 'vue';
import VueDadata from './VueDadata.vue';
import type { HighlightOptions } from './types';

const token = import.meta.env.VITE_APP_DADATA_API_KEY as string;

const query = ref('');
const suggestion = ref(undefined);
const highlightOptions: HighlightOptions = {
  highlightTag: 'span',
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
  </main>
</template>

<style>
body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

main {
  max-width: 600px;
  margin: 0 auto;
  padding: 96px 16px 200px;
}
</style>
