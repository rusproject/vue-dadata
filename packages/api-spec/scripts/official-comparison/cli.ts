import { OFFICIAL_FAMILIES, type OfficialFamily } from './official-sources.ts';

const DEFAULT_UPSTREAM_ARTIFACTS = '../../tmp/official-upstream';
const DEFAULT_UPSTREAM_COMPARISON_ARTIFACTS = '../../tmp/official-upstream-comparison';

interface SharedCommandOptions {
  families: OfficialFamily[];
  oasdiffBin: string | null;
}

interface CompareCommandBase extends SharedCommandOptions {
  accept: boolean;
  kind: 'compare';
}

export interface UpstreamCompareCommand extends CompareCommandBase {
  accept: false;
  artifactsRoot: string;
  source: 'upstream';
}

export interface SavedCompareCommand extends CompareCommandBase {
  artifactsRoot: string | null;
  source: 'saved';
}

export type CompareCommand = SavedCompareCommand | UpstreamCompareCommand;

export interface UpstreamCommand extends SharedCommandOptions {
  action: 'check' | 'update';
  artifactsRoot: string;
  kind: 'upstream';
}

export interface HelpCommand {
  kind: 'help';
}

export type OfficialCommand = CompareCommand | HelpCommand | UpstreamCommand;

export function parseOfficialCommand(args: string[]): OfficialCommand {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' };
  }

  const [kind, subject, ...optionArgs] = args;
  const options = parseSharedOptions(optionArgs);

  if (kind === 'upstream') {
    if (subject !== 'check' && subject !== 'update') {
      throw new Error('Expected "check" or "update" after "official upstream".');
    }

    if (options.accept) {
      throw new Error('--accept is only valid with "official compare saved".');
    }

    return {
      action: subject,
      artifactsRoot: options.artifactsRoot ?? DEFAULT_UPSTREAM_ARTIFACTS,
      families: options.families,
      kind,
      oasdiffBin: options.oasdiffBin,
    };
  }

  if (kind === 'compare') {
    if (subject !== 'upstream' && subject !== 'saved') {
      throw new Error('Expected "upstream" or "saved" after "official compare".');
    }

    if (options.accept && subject !== 'saved') {
      throw new Error('Upstream differences cannot be accepted. Save the revision first.');
    }

    if (subject === 'upstream') {
      return {
        accept: false,
        artifactsRoot: options.artifactsRoot ?? DEFAULT_UPSTREAM_COMPARISON_ARTIFACTS,
        families: options.families,
        kind,
        oasdiffBin: options.oasdiffBin,
        source: subject,
      };
    }

    return {
      accept: options.accept,
      artifactsRoot: options.artifactsRoot,
      families: options.families,
      kind,
      oasdiffBin: options.oasdiffBin,
      source: subject,
    };
  }

  throw new Error(`Unknown official command "${kind}".`);
}

export function officialHelp(): string {
  return `Maintain the checked-in DaData official specs and their accepted differences from ours.

Usage:
  pnpm official upstream check [options]
  pnpm official upstream update [options]
  pnpm official compare upstream [options]
  pnpm official compare saved [options]
  pnpm official compare saved --accept [options]

Commands:
  upstream check   Fetch all official files and report upstream-vs-saved changes.
  upstream update  Run the same check, then replace the selected saved files.
  compare upstream Fetch the official files and compare that exact set with ours.
  compare saved    Compare the saved official files with ours.
  --accept         Replace accepted difference snapshots; valid only with compare saved.

Options:
  --family <name>       Limit the operation to cleaner, profile, or suggestions (repeatable).
  --artifacts <dir>     Override the diagnostic artifact directory.
  --oasdiff-bin <path>  Use an explicit pinned-version oasdiff binary.
  --help                Show this help.

Every command selects all three families by default.
`;
}

interface ParsedOptions {
  accept: boolean;
  artifactsRoot: string | null;
  families: OfficialFamily[];
  oasdiffBin: string | null;
}

function parseSharedOptions(args: string[]): ParsedOptions {
  let accept = false;
  let artifactsRoot: string | null = null;
  const families: OfficialFamily[] = [];
  let oasdiffBin: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--') {
      continue;
    }

    if (argument === '--accept') {
      accept = true;
      continue;
    }

    if (argument === '--artifacts') {
      artifactsRoot = optionValue(args, index, argument);
      index += 1;
      continue;
    }

    if (argument === '--family') {
      const family = optionValue(args, index, argument);

      if (!OFFICIAL_FAMILIES.includes(family as OfficialFamily)) {
        throw new Error(
          `Unknown official family "${family}". Expected one of: ${OFFICIAL_FAMILIES.join(', ')}.`,
        );
      }

      if (!families.includes(family as OfficialFamily)) {
        families.push(family as OfficialFamily);
      }

      index += 1;
      continue;
    }

    if (argument === '--oasdiff-bin') {
      oasdiffBin = optionValue(args, index, argument);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    accept,
    artifactsRoot,
    families: families.length > 0 ? families : [...OFFICIAL_FAMILIES],
    oasdiffBin,
  };
}

function optionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];

  if (!value) {
    throw new Error(`Missing value for ${option}.`);
  }

  return value;
}
