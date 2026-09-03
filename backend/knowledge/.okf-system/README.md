# MANO ERP Operational Knowledge Framework

## What OKF is

The Operational Knowledge Framework (OKF) is the agent-facing, evidence-backed
knowledge layer for MANO ERP. It describes operational behavior for future
agents without replacing the application source or database.

## Canonical OKF files

The canonical bundle contains exactly these ten Markdown files:

- `index.md`
- `vendors/index.md`
- `vendors/relationships.md`
- `clients/index.md`
- `resources/index.md`
- `resources/rate-versioning.md`
- `resources/compositions.md`
- `resources/impact-tracing.md`
- `interactions/index.md`
- `projects/index.md`

## Evidence hierarchy

Evidence is ordered from strongest to weakest:

1. `live_database_schema`
2. `schema_initialization_code`
3. `service_layer`
4. `controllers_and_routes`
5. `existing_okf_stated_facts`
6. `existing_okf_inferred_facts`
7. `update_history`
8. `learned_patterns`

Only Tiers 1–4 authorize generated writes. Existing stated or inferred facts
provide context but do not independently authorize a change.

## Pipeline

1. Stage 1 defines the OKF source map and metadata.
2. Stage 2 detects changed source scope and classifies OKF impact.
3. Stage 3 compares the current database schema with the stored schema baseline.
4. Stage 4 analyzes source and schema impact.
5. Stage 5 collects bounded evidence bundles.
6. Stage 6 produces structured reasoning proposals.
7. Stage 7 validates proposals against evidence and deterministic rules.
8. Stage 8 previews or applies approved changes, with rollback protection.
9. Stage 9 validates the complete OKF bundle and agent-safety constraints.
10. Stage 10 orchestrates the pipeline and enforces dry-run/apply contracts.

Stage 6 uses configured providers when invoked directly. Pre-commit and CI do
not run Stage 6.

## Automatic runner (Stage 11A.1)

The automatic runner uses an exact 72 elapsed-hour interval, a committed-source
baseline, and Stage 10 `--since=<baseline>` processing. It does not silently
rebaseline from the current checkout. A generated canonical change that cannot
be durably persisted remains blocked by the existing `PERSISTENCE_REQUIRED`
safety behavior.

## Stage 11A.2 status

Stage 11A.2 durable repository persistence is **DEFERRED / OPTIONAL**.

Stage 11A.1 can detect and reconcile a knowledge change, but the 72-hour runner
alone does not guarantee durable production persistence. Generated canonical
changes requiring durability are currently human-assisted Git work.

## Developer workflow

`backend/scripts/okf-pre-commit.js` is an optional advisory/check. It reads only
the staged path set and passes those paths to Stage 2 using `--files=`. Local
hooks are not auto-installed and can be bypassed by developers.

Known local, multiple-OKF, and global-impact changes produce an advisory. An
UNKNOWN Stage 2 result blocks by default. An exceptional bypass is available
only when explicitly set:

```text
OKF_SKIP_PRECOMMIT=1
```

The bypass is visible and does not create an authoritative skip record.

The CI workflow `.github/workflows/okf-validate.yml` validates the proposed
OKF/configuration data with trusted Stage 9 code, uses read-only permissions,
does not require provider or database secrets, and does not run Stage 6, Stage
8 apply, or Stage 10. CI validates bundle integrity and safety; it does not
prove that every source change has already been reflected in OKF.

## Common commands

From `backend/`:

```text
npm run okf:update
npm run okf:dry-run
npm run okf:validate
npm run okf:snapshot
node scripts/okf-detect-changes.js --files=<comma-separated-paths>
```

The snapshot command is explicit and may require the configured database. It is
not run by CI or the pre-commit check.

## Runtime and generated files

The following are generated or runtime state and are ignored by Git:

- `auto-runner-state.json`
- `db-schema-snapshot.json`
- `update-history.json`
- `learned-patterns.md`
- `human-review-required.json`
- `evidence-bundles/`
- `change-proposals/`
- `validated-proposals/`
- `backups/`

Do not casually commit or delete these files. They are not canonical OKF
knowledge.

## Exit codes

Stage 2:

- `0`: no OKF update required;
- `1`: OKF-impacting change detected;
- `2`: UNKNOWN or unsafe impact classification.

Stage 9:

- `0`: structurally valid and agent-safe;
- `1`: structurally valid but not agent-safe;
- `2`: structural validation failure;
- `3`: fatal validator failure.

Stage 10 and the automatic runner preserve their own structured summaries and
use `0` for successful outcomes, `1` for legitimate human-review outcomes,
`2` for rerun/safety-required outcomes, and `3` for fatal failures where the
current source supports that distinction.

## Manual editing

Canonical Markdown remains manually editable. Preserve evidence-backed facts,
do not convert `[INFERRED]` statements into confirmed facts without stronger
evidence, and run Stage 9 after manual edits.

## Stage 12 boundary

The future ERP Agent consumes an OKF bundle only after Stage 9 reports it safe.
This README does not claim any unimplemented Stage 12 backend behavior.
