<script lang="ts" setup>
import { ref } from 'vue';
import { VueDadata } from 'vue-dadata';
import 'vue-dadata/dist/vue-dadata.css';

const token = import.meta.env.VITE_APP_DADATA_API_KEY as string;

const query = ref('');
const suggestion = ref(undefined);
</script>

<template>
  <div>
    <VueDadata
      v-model="query"
      v-model:suggestion="suggestion"
      :autocomplete="true"
      :token="token"
    />
  </div>
</template>
