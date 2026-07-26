import { runOfficial } from './official-comparison/run.ts';

void runOfficial().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
