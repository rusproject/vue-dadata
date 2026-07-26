# Official OpenAPI maintenance

DaData publishes separate OpenAPI files for the cleaner, profile, and suggestions APIs. We save
reviewed copies in `official/source/`. Our generated contract is `dadata.json`.

The official files are evidence, not a replacement for our contract. They can be less precise, so
the comparator records the complete known difference between each saved official file and ours in
`official/snapshots/`.

## Commands

Run these from the repository root:

| Need                                             | Command                                |
| ------------------------------------------------ | -------------------------------------- |
| Report upstream changes since the saved revision | `pnpm official upstream check`         |
| Save the current upstream revision               | `pnpm official upstream update`        |
| Compare the current upstream revision with ours  | `pnpm official compare upstream`       |
| Compare the saved revision with ours             | `pnpm official compare saved`          |
| Accept the saved-revision comparison             | `pnpm official compare saved --accept` |

Every command operates on cleaner, profile, and suggestions by default. For focused work,
`--family cleaner`, `--family profile`, and `--family suggestions` are repeatable:

```sh
pnpm official compare upstream --family suggestions
```

The option also narrows update and acceptance. Omit it for the normal whole-contract workflow.

There is one package script and one dispatcher. The subcommands above are the supported interface;
there are no family-specific package scripts.

The comparator uses oasdiff 1.24.0. On first use it downloads the official archive for Windows,
Linux, or macOS on x64/arm64 into an ignored `node_modules/.cache` directory and verifies its
SHA-256. To use an already installed exact-version binary, pass `--oasdiff-bin <path>` or set
`OASDIFF_BIN`.

### Checking and saving upstream

`upstream check` and `upstream update` both:

1. fetch every selected file;
2. report its raw text diff from the saved file;
3. run oasdiff for a semantic diff when the normalized source changed; and
4. write review artifacts under `tmp/official-upstream/`.

`upstream check` writes no tracked files. It exits nonzero when a selected upstream file changed or
could not be fetched.

`upstream update` waits until every selected fetch and diff succeeds, then writes the exact fetched
bytes to `official/source/`. It does not compare the new revision with ours and does not accept
snapshot changes.

The default upstream artifacts keep each source's real filename:

- `cleaner.yml`, `profile.yml`, and `suggestions.yml`: exact fetched files;
- `<family>.source.diff`: raw saved-to-upstream text diff;
- `<family>.semantic-diff.txt`: oasdiff output for a changed source; and
- `<family>.metadata.json`: URL, HTTP metadata, hashes, sizes, and check time.

Line endings and trailing whitespace are ignored when deciding whether an upstream revision
changed. They are not rewritten in the fetched artifact or during update.

### Comparing with ours

`compare upstream` fetches a complete selected source set, saves it under
`tmp/official-upstream-comparison/source/`, and compares those exact files with ours. Comparator
artifacts go under `tmp/official-upstream-comparison/comparison/`.

`compare saved` reads `official/source/`. It retains intermediate artifacts only when requested:

```sh
pnpm official compare saved --family suggestions \
  --artifacts ../../tmp/official-comparison
```

Both commands compare their result with the accepted snapshots. An upstream comparison can
therefore show what would change before the upstream revision is saved. Upstream differences cannot
be accepted: run `upstream update`, review the saved source diff, then accept the saved comparison
if it is correct.

A normal revision review is:

```sh
pnpm official upstream check
pnpm official compare upstream
pnpm official upstream update
pnpm official compare saved
# Review the source and snapshot deltas. Update our types, spec, and docs where needed.
pnpm official compare saved
pnpm official compare saved --accept
```

The first two commands are read-only with respect to tracked files. The update and acceptance steps
are independent and explicit.

## What comparison covers

For each family, the comparator:

1. maps official operations onto our concrete paths;
2. rejects missing official operations, unexplained local extensions, stale mappings, and security
   differences;
3. builds comparison copies of the official and local schemas;
4. applies the narrow normalizations described below;
5. runs oasdiff with the official file as the base and our generated contract as the revision;
6. converts oasdiff's version-specific JSON into stable difference records; and
7. compares every record with the accepted snapshot.

The stable records cover operation presence, request bodies, response statuses, media types, and
request/response schemas. Security is checked separately before payload normalization. If oasdiff
reports a semantic structure the adapter does not understand, the command fails rather than
ignoring it.

On a mismatch, console lines beginning with `+` are newly present snapshot records. Lines beginning
with `-` have disappeared. The `added`, `removed`, `from`, and `to` fields inside a record describe
the official-to-ours OpenAPI difference.

## Comparison normalization

Normalization changes temporary comparison copies only. It never rewrites `dadata.json` or an
official source.

Shared normalization:

- removes documentation and presentation metadata;
- converts equivalent OpenAPI 3.0 and 3.1 nullable schema forms to one representation; and
- prunes components unreachable from the projected operations.

Family-specific rules live beside the operation mappings in `family-config.ts`:

- DaData's generic `/clean/{type}` operation is expanded to our concrete cleaner paths. Each path
  selects its response branch, and official component names are aliased to their local equivalents.
- Our suggestions address responses preserve the administrative/municipal union more precisely
  than the official file. For comparison only, configured union branches are folded into their
  common object shape.
- Security requirements omitted by the current official files are stated explicitly for each
  family, including the public profile `/version` alternative.

Every branch selection, alias, and union fold validates its expected input. A new branch, changed
lineage, unlisted branch-only property, unused rule, or unsupported schema keyword stops the
comparison. Normalization decisions and component-pruning results are available in diagnostic
artifacts.

oasdiff annotation changes such as descriptions, titles, examples, extensions, and external
documentation are not snapshot records. Their shapes are still checked. Unknown keys fail closed.

## Comparator artifacts

Each retained family directory contains:

- `official.projected.json`: official operations after concrete-path projection;
- `official.normalized.unpruned.json` and `ours.normalized.unpruned.json`: comparison copies before
  component pruning;
- `official.normalized.json` and `ours.normalized.json`: the exact oasdiff inputs;
- `official.normalization.json` and `ours.normalization.json`: recorded rewrites and pruned
  components;
- `oasdiff.json`: raw JSON from the pinned oasdiff version;
- `diff.json`: stable flat records extracted from oasdiff;
- `diff.by-path.json`: the same records grouped for path-first inspection; and
- `diff.snapshot.txt`: the text compared with the accepted snapshot.

When oasdiff introduces an unsupported key, inspect `oasdiff.json` and extend the adapter
deliberately. Do not add a key to an ignored list unless it is genuinely annotation-only.

Snapshot acceptance records that a difference is known. Public SDK documentation must separately
explain meaningful differences between our contract and DaData's files.
