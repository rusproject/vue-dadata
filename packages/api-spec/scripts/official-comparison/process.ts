import { spawnSync } from 'node:child_process';

export interface CommandResult {
  command: string;
  args: string[];
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

/** Runs a child process and captures stdout/stderr for report-friendly failures. */
export function runCommand(
  command: string,
  args: string[],
  options: {
    shell?: boolean;
  } = {},
): CommandResult {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: options.shell ?? false,
  });

  return {
    command,
    args,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

/** Formats a failed command with captured process output. */
export function failedCommandMessage(message: string, result: CommandResult): string {
  const lines = [message, `command: ${result.command} ${result.args.join(' ')}`];

  if (result.error) {
    lines.push(`error: ${result.error.message}`);
  }

  if (result.stdout.trim()) {
    lines.push('', 'stdout:', result.stdout.trim());
  }

  if (result.stderr.trim()) {
    lines.push('', 'stderr:', result.stderr.trim());
  }

  return lines.join('\n');
}
