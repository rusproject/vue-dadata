# Vue Dadata

[comment]: <> (![Publish]&#40;https://github.com/rusproject/vue-dadata/workflows/Publish/badge.svg&#41;)

This is a fork of [this Vue component](https://github.com/ikloster03/vue-dadata), which provides address suggestions using [DaData.ru](https://dadata.ru).

It targets **Vue 3.5+**.

For **Vue 2** and earlier Vue 3 versions (pre-3.5), please refer to [Ivan Monastyrev's original repository](https://github.com/ikloster03/vue-dadata).

## Install

```bash
$ pnpm install git+https://github.com/rusproject/vue-dadata.git#rewritten
```

## Usage

```vue
<script lang="ts" setup>
import { ref } from 'vue';
import { VueDadata } from 'vue-dadata';
import 'vue-dadata/dist/vue-dadata.css';

const token = import.meta.env.VITE_APP_DADATA_API_KEY as string;

const query = ref('');
const suggestion = ref(undefined);
</script>

<template>
  <div class="vue-truncate-html-example">
    <VueDadata v-model="query" v-model:suggestion="suggestion" :token="token" />
  </div>
</template>
```

### Properties

| Prop             | Required | Type      | Description                                                                                                       | Default                                                                                                                   |
| ---------------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| token            | Yes      | `string`  | Auth token DaData.ru                                                                                              | -                                                                                                                         |
| modelValue       | Yes      | `string`  | v-model for query                                                                                                 | -                                                                                                                         |
| suggestion       | No       | `object`  | v-model for [suggestion](https://github.com/rusproject/vue-dadata/blob/rewritten/src/types/suggestion.dto.ts#L24) | `undefined`                                                                                                               |
| placeholder      | No       | `string`  | Text placeholder                                                                                                  | `''`                                                                                                                      |
| url              | No       | `string`  | special url for dadata api                                                                                        | `'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address'`                                                  |
| debounceWait     | No       | `string`  | waiting time                                                                                                      | `'1000ms'`                                                                                                                |
| disabled         | No       | `boolean` | disabled                                                                                                          | `false`                                                                                                                   |
| fromBound        | No       | `string`  | Dadata bound type FROM                                                                                            | `undefined`                                                                                                               |
| toBound          | No       | `string`  | Dadata bound type TO                                                                                              | `undefined`                                                                                                               |
| inputName        | No       | `string`  | Input name attribute                                                                                              | `'vue-dadata-input'`                                                                                                      |
| locationOptions  | No       | `object`  | Location options for choosing cities or countries                                                                 | `undefined`                                                                                                               |
| classes          | No       | `object`  | classes                                                                                                           | [DEFAULT_CLASSES](https://github.com/rusproject/vue-dadata/blob/rewritten/src/const/classes.const.ts)                     |
| highlightOptions | No       | `object`  | highlight options for [vue-word-highlighter](https://github.com/kawamataryo/vue-word-highlighter)                 | [DEFAULT_HIGHLIGHT_OPTIONS](https://github.com/rusproject/vue-dadata/blob/rewritten/src/const/highlight-options.const.ts) |
| autocomplete     | No       | `boolean` | can autocomplete query, after blur                                                                                | `undefined`                                                                                                               |

## Peer dependencies

- [vue](https://github.com/vuejs/vue)

## Dependencies

- [axios](https://github.com/axios/axios)
- [vue-debounce](https://github.com/dhershman1/vue-debounce)
- [vue-word-highlighter](https://github.com/kawamataryo/vue-word-highlighter)

Forked from [ikloster03/vue-dadata](https://github.com/ikloster03/vue-dadata)
