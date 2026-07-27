import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as prettier from 'prettier';
import YAML from 'yaml';

/** Резолвит путь в абсолютный относительно рабочей директории. */
function resolveLocalPath(relativeOrAbsolutePath: string): string {
  return path.resolve(process.cwd(), relativeOrAbsolutePath);
}

/** Создаёт "bundled"-версию (JSON и опционально YAML) указанного OpenAPI файла. */
async function main() {
  const [, , inputArg, outputJsonArg, outputYamlArg] = process.argv;

  if (!inputArg || !outputJsonArg) {
    throw new Error(
      'Usage: tsx ./scripts/bundle-openapi.ts <input-yaml> <output-json> [output-yaml]',
    );
  }

  // Приводим все пути к рабочей директории, чтобы CLI и файловые операции видели одни файлы.
  const inputPath = resolveLocalPath(inputArg);
  const outputJsonPath = resolveLocalPath(outputJsonArg);
  const outputYamlPath = outputYamlArg ? resolveLocalPath(outputYamlArg) : null;
  // Ищем путь к локальной зависимости Redocly
  const redoclyCliPath = createRequire(path.join(process.cwd(), 'package.json')).resolve(
    '@redocly/cli/bin/cli.js',
  );

  // Вызываем redocly bundle через CLI, т.к. у @redocly/cli нет стабильного публичного JS API.
  execFileSync(process.execPath, [redoclyCliPath, 'bundle', inputPath, '-o', outputJsonPath], {
    stdio: 'inherit',
  });

  // Форматируем готовый JSON через Prettier
  const generatedBundle = await fs.readFile(outputJsonPath, 'utf8');
  const prettierConfig = (await prettier.resolveConfig(outputJsonPath)) ?? {};
  const formattedJsonBundle = await prettier.format(generatedBundle, {
    ...prettierConfig,
    filepath: outputJsonPath,
  });

  // Не перезаписываем если нет изменений
  if (formattedJsonBundle !== generatedBundle) {
    await fs.writeFile(outputJsonPath, formattedJsonBundle);
  }

  if (outputYamlPath) {
    await writeYamlBundle(outputJsonPath, outputYamlPath);
  }
}

/** Конвертируем готовый JSON в YAML */
async function writeYamlBundle(inputJsonPath: string, outputYamlPath: string): Promise<void> {
  const bundledDocument = JSON.parse(await fs.readFile(inputJsonPath, 'utf8')) as unknown;
  const yamlBundle = YAML.stringify(bundledDocument, {
    lineWidth: 0, // отключаем перенос длинных строк
    singleQuote: true,
  });

  // Форматируем готовый YAML через Prettier
  const prettierConfig = (await prettier.resolveConfig(outputYamlPath)) ?? {};
  const formattedYamlBundle = await prettier.format(yamlBundle, {
    ...prettierConfig,
    filepath: outputYamlPath,
  });

  await fs.writeFile(outputYamlPath, formattedYamlBundle);
}

// При ошибках выводим в CLI только сообщение и отдаём exit code "1".
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
