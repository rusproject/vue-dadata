# Official Comparison Scripts

This directory holds shared helpers for the temporary staged official-vs-ours comparison work.

Current script roles:

- `compare-official.ts`: legacy broad report across checked-in official specs. Keep it as a reference until the staged pipeline covers the same surface.
- `compare-official-*-stage-a.ts`: Stage A entrypoints for one official source family; they validate curated operation mappings and can write projected official specs.
- `compare-official-*-stage-b.ts`: small Stage B family entrypoints.
- `official-comparison/stage-a/`: shared Stage A inventory/projection runner used by the family entrypoints.
- `official-comparison/stage-b/`: shared Stage B runner, reporting, external-tool adapters, and comparison-only algorithms.

The family entrypoints only provide paths and family identity. Shared pipeline behavior belongs under
the corresponding stage directory; comparison-only schema transforms remain explicit, fail-closed
algorithms under `stage-b/`.

Naming:

- Stage A is the operation inventory/projection gate.
- Stage B is the payload-schema comparison prototype built on top of a clean Stage A projection.

Temporary parts:

- `oasdiff breaking` output is useful for reports, but not trusted as the semantic source of truth.
- `stage-b-diff-units.json` is the first own finding-shaped artifact built from `oasdiff diff -f json`; accepted-difference curation is intentionally not wired yet.
- Component pruning is comparison-only, follows local `$ref`s from the compared paths before removing unused standard component entries, and validates remaining local `$ref`s after pruning.
- Explicit `schemaComponentAliases` rules rename known-equivalent schema components and every exact local `$ref` on one comparison side. Rules fail closed when sources are missing or unreferenced, targets collide, or aliases form chains/cycles.
- Explicit `anyOfFolding` rules are fail-closed comparison-only projections. All selectors use the canonical `properties/<JSON-Pointer-escaped-name>` / `items` grammar. Rules validate ordered branch lineage, exact branch-local property/required differences, exact null branches, and every recursively merged schema path. Branch-local annotations such as `description` are intentionally discarded by the fold; target-level annotations are preserved.
- Explicit `anyOfSelections` rules select one local-ref branch from an operation-local `anyOf` before comparison. They require exact local-ref branches, the complete expected ref set, and the selected ref exactly once.
- The broad legacy comparer should not receive deep refactors unless it is needed to preserve coverage while the staged pipeline is incomplete.

Useful quick commands:

```sh
# Show the compact Stage B console report.
pnpm --filter @dadata-sdk/api-spec compare:official:cleaner-stage-b
pnpm --filter @dadata-sdk/api-spec compare:official:profile-stage-b
pnpm --filter @dadata-sdk/api-spec compare:official:suggestions-stage-b -- --max-groups 20 --max-samples 5

# Check family operation inventory/projection gates.
pnpm --filter @dadata-sdk/api-spec compare:official:cleaner-stage-a
pnpm --filter @dadata-sdk/api-spec compare:official:profile-stage-a
pnpm --filter @dadata-sdk/api-spec compare:official:suggestions-stage-a

# Keep raw and normalized JSON artifacts for inspection.
pnpm --filter @dadata-sdk/api-spec compare:official:suggestions-stage-b -- --keep-temp --max-groups 20 --max-samples 5

# Update committed accepted diff snapshots.
pnpm --filter @dadata-sdk/api-spec compare:official:cleaner-stage-b:update-snapshot
pnpm --filter @dadata-sdk/api-spec compare:official:profile-stage-b:update-snapshot
pnpm --filter @dadata-sdk/api-spec compare:official:suggestions-stage-b:update-snapshot

# Check generated diffs against committed accepted snapshots.
pnpm --filter @dadata-sdk/api-spec compare:official:cleaner-stage-b:check-snapshot
pnpm --filter @dadata-sdk/api-spec compare:official:profile-stage-b:check-snapshot
pnpm --filter @dadata-sdk/api-spec compare:official:suggestions-stage-b:check-snapshot
```

With `--keep-temp`, inspect:

- `stage-b-diff-units.json` for the flat finding-shaped artifact.
- `stage-b-diff-units.by-path.json` for the path-first review artifact.
- `stage-b-diff-units.snapshot.txt` for the deterministic review-oriented snapshot. It coalesces
  derivative requiredness changes into matching property add/delete lines while the JSON artifacts
  retain the raw factual units.
- `oasdiff-full-diff.json` for the raw full diff.

Committed accepted snapshots live under `packages/api-spec/official/snapshots/`.
