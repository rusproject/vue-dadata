import { runOfficial } from './official-comparison/run.ts';

// При ошибках выводим в CLI только сообщение и отдаём exit code "1"
void runOfficial().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
