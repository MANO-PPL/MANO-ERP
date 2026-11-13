# Module 2: Catalog Specification Test Suite (Cases 1–44)

Comprehensive specification test cases verifying multi-tenant catalog invariants, units & physical conversions, resources, effective-dated rates, activities, norms, allowed wastage, master-to-project inheritance, sync diffing, and integrity checks.

---

## Quick Reference Table

| Case # | Title / Specification Goal | Target Domain | Expected Assertion / Behavior |
|:---:|:---|:---|:---|
| **1** | Create a master material with a base unit | Master Resource | Created with `version: 1`, `project_id: null`, status `active`. |
| **2** | Duplicate code in the same scope | Code Uniqueness | Throws `CAT_DUPLICATE_CODE` on duplicate code in identical scope. |
| **3** | Same code in two projects and master | Multi-Scope Code | Same code allowed across Master (`scope_key: 0`) and Projects (`scope_key: proj_id`). |
| **4** | Change a resource's kind | Immutability | Rejects mutating `kind` (`material` $\leftrightarrow$ `labour` $\leftrightarrow$ `equipment`) with `CAT_KIND_MISMATCH`. |
| **5** | Convert g to kg and cft to $m^3$ & self-heal | Units & Immunity | Decimal exact conversion; direct DB tampering detected (`SYSTEM_UNIT_TAMPERED`) and healed (`repairSystemUnits()`). |
| **6** | Convert kg to bag with no conversion | Free Conversion | Throws `CAT_NO_CONVERSION` when cross-category units lack a resource conversion. |
| **7** | Define 1 bag = 50 kg for cement, convert both ways | Packaging Conversion | Bi-directional conversion: 50 kg $\rightarrow$ 1 bag, 1 bag $\rightarrow$ 50 kg. |
| **8** | setRate on a resource with no rate | Rates Baseline | Creates initial open-ended rate row (`effective_to: null`). |
| **9** | setRate with a later date | Rates Timeline | Automatically sets previous rate's `effective_to = dayBefore(newEffectiveFrom)`. |
| **10** | setRate with a date inside a past period | Rates Timeline | Throws `CAT_RATE_OVERLAP` when trying to inject a rate inside an existing closed timeline. |
| **11** | getRate on the day before, day of, day after change | Effective Date Query | Returns prior rate for day-before, new rate for effective date and future dates. |
| **12** | getRate with no rate in force | Effective Date Query | Returns `null` without throwing an error when queried before the earliest rate. |
| **13** | setRate in an incompatible unit | Unit Compatibility | Throws `CAT_UNIT_INCOMPATIBLE` if rate unit category doesn't match resource base unit without conversion. |
| **14** | getRate inUnit bag for resource priced per kg | Unit Conversion Query | Correctly calculates and scales rate from kg to bag using active conversion factors. |
| **15** | correctRate with and without a reason | Audit Compliance | Rejects correction without reason (`CAT_INVALID_VALUE`); applies correction and logs change with reason. |
| **16** | removeRate on past vs future rate | Audit Compliance | Rejects deleting past/active rates; allows removing future-dated rate (`effective_from > today`). |
| **17** | importResource into a project | Scope Inheritance | Clones master resource into project with `parent_id`, copies rates & conversions, sets `synced_version`. |
| **18** | Import the same master again | Idempotency | Returns existing project resource copy; no duplicate row created. |
| **19** | Import with asNewVariant and different code | Scope Inheritance | Creates a secondary independent variant copy in the project with distinct code. |
| **20** | Import from a project row | Scope Guard | Rejects importing a project copy as a parent source (`CAT_NOT_MASTER`). |
| **21** | Rename and re-rate a project copy | Scope Isolation | Changes to project copy rates/names do not alter master or sibling project copies. |
| **22** | Edit a master rate | Version Tracking | Master version increments; project copies remain untouched and show `isBehind: true`. |
| **23** | getSyncDiff, then acceptSync with rate selected | Selective Sync | `getSyncDiff` shows rate difference; `acceptSync({ rates: true })` updates rate while preserving local project custom name. |
| **24** | Create an activity with an output unit | Master Activity | Created with `version: 1`, `output_unit_id`, and `parent_id: null`. |
| **25** | setNorm with a resource from another scope | Scope Invariant | Rejects mixing scopes (e.g. master activity with project resource) with `CAT_SCOPE_MISMATCH`. |
| **26** | setNorm in an incompatible unit | Unit Compatibility | Rejects norm unit if physical category doesn't match resource base unit (`CAT_UNIT_INCOMPATIBLE`). |
| **27** | Overlapping norm periods | Norms Timeline | Throws `CAT_NORM_OVERLAP` when norm start date overlaps or precedes existing norm periods. |
| **28** | importActivity clones norms and reuses resources | Scope Inheritance | Activity and norms cloned into project; auto-imports or reuses existing project resource copies. |
| **29** | importActivity twice | Idempotency | Second call returns existing project activity copy; no duplicate activities or norms created. |
| **30** | computeActivityCost with rate changes mid-year | Cost Computation | Evaluates cost using exact rate in force as of queried date across diverse norm units. |
| **31** | computeActivityCost with missing rate | Cost Computation | Returns total for priced lines, marks `incomplete: true`, and includes explicit missing rate warning. |
| **32** | Excavation sample & empty-norm activity | Cost Computation | Labour + equipment-only norm computes correctly; empty activity returns `total: 0`, `complete: true`. |
| **33** | expectedUsage for 20 $m^2$ brickwork | Usage Computation | Computes net, allowance, and gross quantities converted to base unit (`kg`, `nos`) as of target date. |
| **34** | Archive a resource, then add it to a new norm | Archival Guard | Rejects adding archived resource to new norm (`CAT_ARCHIVED`); existing norms remain intact for history. |
| **35** | Delete a resource used by norm or registered check | Delete Protection | Rejects deletion with `CAT_IN_USE` if resource is referenced by norms or external usage hooks. |
| **36** | Delete an unused resource | Lifecycle | Unused resource is cleanly deleted, and change log records `action: 'delete'`. |
| **37** | Two simultaneous setRate calls | Concurrency Control | Row locking (`FOR UPDATE`) ensures serialized execution without overlapping effective periods. |
| **38** | Two simultaneous imports of same master | Concurrency Control | Row locking prevents duplicate copy creation during concurrent import dispatches. |
| **39** | Corrupt rows by direct SQL, run checkIntegrity | Integrity Diagnostic | Detects `MASTER_RESOURCE_HAS_PARENT`, `NORM_SCOPE_MISMATCH`, `OVERLAPPING_RATE_PERIODS`, and incompatible units. |
| **40** | assertProjectScoped with wrong project | Scope Guard | Throws `CAT_SCOPE_MISMATCH` if resource/activity does not belong to specified `projectId`. |
| **41** | expectedUsage with wastage % and conversion | Wastage Math | 20 $m^2$ at 0.03 bag/$m^2$ + 5% waste $\rightarrow$ Net: 30 kg, Allowance: 1.5 kg, Gross: 31.5 kg in base unit. |
| **42** | computeActivityCost uses gross quantity | Wastage Costing | Line amounts and totals evaluate against gross quantity; 0% vs 10% wastage differs by exactly 10%. |
| **43** | Default 0 wastage & range validation | Wastage Invariant | Defaults to 0% wastage; rejects `< 0` (e.g. `-1`) and `> 100` (e.g. `100.001`) with `CAT_INVALID_VALUE`. |
| **44** | importActivity & sync diff with wastage % | Wastage Sync | `importActivity` copies wastage; editing master wastage bumps version, flagged in diff, and updated via `acceptSync`. |

---

## Detailed Specifications

### Case 1: Create a master material with a base unit
- **Setup**: Create master resource with `kind = 'material'`, `base_unit_id = kg`.
- **Assertions**:
  - `res.version === 1`
  - `res.project_id === null`
  - `res.parent_id === null`
  - `res.kind === 'material'`
  - `res.base_unit_code === 'kg'`

### Case 2: Duplicate code in the same scope
- **Setup**: Create resource `MAT-DUP-02` in Master scope. Attempt to create another with identical code in Master scope.
- **Assertions**:
  - Rejection throws `CatalogError` with `CAT_DUPLICATE_CODE`.

### Case 3: Same code in two different projects, and same code as a master
- **Setup**: Create `CODE-03` in Master (`project_id = null`), Project 1 (`project_id = 8881`), and Project 2 (`project_id = 8882`).
- **Assertions**:
  - All three create calls succeed independently without collision because `scope_key` differs.

### Case 4: Change a resource's kind
- **Setup**: Create resource with `kind = 'material'`. Attempt to call `updateResource` with `kind = 'labour'`.
- **Assertions**:
  - Rejection throws `CatalogError` with `CAT_KIND_MISMATCH`.

### Case 5: Convert g to kg, cft to $m^3$, and verify mathematical immunity
- **Setup**:
  1. Convert 2500 g to kg $\rightarrow$ `2.5`.
  2. Convert 100 cft to $m^3$ $\rightarrow$ `2.83168466`.
  3. Create custom unit `cshift = 10 hr` and convert 2 cshifts $\rightarrow$ `20 hr`.
  4. Simulate direct DB tampering on `cat_unit.to_base_factor` for `kg`.
- **Assertions**:
  - In-memory calculation engine remains 100% immune (1500 g still equals 1.5 kg).
  - `checkIntegrity()` flags `SYSTEM_UNIT_TAMPERED`.
  - `repairSystemUnits()` self-heals the database row back to factor `1`.

### Case 6: Convert kg to bag with no conversion
- **Setup**: Attempt to convert 50 kg to bag without defining a resource packaging conversion.
- **Assertions**:
  - Throws `CatalogError` with `CAT_NO_CONVERSION`.

### Case 7: Define 1 bag = 50 kg for cement, convert both ways
- **Setup**: Create cement resource, call `setConversion(cement.id, bag, kg, 50)`.
- **Assertions**:
  - 50 kg $\rightarrow$ 1 bag.
  - 1 bag $\rightarrow$ 50 kg.
  - 2.5 bags $\rightarrow$ 125 kg.

### Case 8: setRate on a resource with no rate
- **Setup**: Call `setRate(resource.id, 100, kg, '2026-01-01')`.
- **Assertions**:
  - Creates rate row with `effective_from = '2026-01-01'` and `effective_to = null`.

### Case 9: setRate with a later date
- **Setup**: Call `setRate` with effective date `2026-06-01`.
- **Assertions**:
  - First rate's `effective_to` automatically becomes `2026-05-31`.
  - New rate row has `effective_from = '2026-06-01'` and `effective_to = null`.

### Case 10: setRate with a date inside a past period
- **Setup**: With rates active for `2026-01-01..2026-05-31` and `2026-06-01..open`, attempt to set a rate starting on `2026-03-01`.
- **Assertions**:
  - Throws `CatalogError` with `CAT_RATE_OVERLAP`.

### Case 11: getRate on the day before, day of, and day after a change
- **Setup**: Rates active at 100 starting `2026-01-01` and 120 starting `2026-06-01`.
- **Assertions**:
  - `2026-05-31` $\rightarrow$ 100.
  - `2026-06-01` $\rightarrow$ 120.
  - `2026-06-02` $\rightarrow$ 120.

### Case 12: getRate with no rate in force
- **Setup**: Rate starts `2026-01-01`. Query `getRate` for date `2025-12-31`.
- **Assertions**:
  - Returns `null` without throwing an exception.

### Case 13: setRate in a unit with no link to base unit
- **Setup**: Base unit is `kg`. Attempt to set rate quoted in `litre` without conversion.
- **Assertions**:
  - Throws `CatalogError` with `CAT_UNIT_INCOMPATIBLE`.

### Case 14: getRate inUnit bag for a resource priced per kg, with a conversion
- **Setup**: Cement base unit `kg`, rate `10 / kg`, conversion `1 bag = 50 kg`.
- **Assertions**:
  - `getRate(..., { inUnit: bag.id })` returns rate `500` per bag.

### Case 15: correctRate with and without a reason
- **Setup**: Attempt `correctRate` without reason $\rightarrow$ fails. Provide reason `"Typo in rate entry"` $\rightarrow$ succeeds.
- **Assertions**:
  - Without reason: Throws `CAT_INVALID_VALUE`.
  - With reason: Rate value updated and `cat_change_log` records `action = 'correct'` with reason.

### Case 16: removeRate on a past rate and a future rate
- **Setup**: Attempt `removeRate` on past/active rate $\rightarrow$ rejected. Call `removeRate` on future-dated rate $\rightarrow$ succeeds.
- **Assertions**:
  - Past rate removal throws `CAT_INVALID_VALUE`.
  - Future rate removal deletes row and restores previous rate's `effective_to` to open.

### Case 17: importResource into a project
- **Setup**: Import master resource with rates and conversions into Project 1.
- **Assertions**:
  - Project copy created with `parent_id = master.id`, `synced_version = master.version`.
  - Rates and conversions cloned into project scope.

### Case 18: Import the same master again (idempotent)
- **Setup**: Call `importResource` for the same master and project.
- **Assertions**:
  - Returns existing copy; no duplicate row created.

### Case 19: Import with asNewVariant and a different code
- **Setup**: Import master with `{ asNewVariant: true, code: 'MAT-VAR-01' }`.
- **Assertions**:
  - Creates a distinct new resource copy in the project with its own ID.

### Case 20: Import from a project row
- **Setup**: Attempt to import a project resource copy as a parent master.
- **Assertions**:
  - Throws `CatalogError` with `CAT_NOT_MASTER`.

### Case 21: Rename and re-rate a project copy
- **Setup**: Update project copy name and set project-specific rate.
- **Assertions**:
  - Master resource and other project copies remain completely unchanged.

### Case 22: Edit a master rate
- **Setup**: Add or correct a rate on master resource.
- **Assertions**:
  - Master `version` increments by 1.
  - Project copies remain untouched; `getResourceSyncStatus` reports `isBehind = true`.

### Case 23: getSyncDiff, then acceptSync with only the rate selected
- **Setup**: Inspect diff via `getSyncDiff`. Call `acceptSync` with `{ rates: true }`.
- **Assertions**:
  - Project copy adopts master rate; local project custom name is preserved.
  - `synced_version` updates to match master `version`.

### Case 24: Create an activity with an output unit
- **Setup**: Create activity with `output_unit_id = m2`.
- **Assertions**:
  - Created with `version: 1`, `output_unit_code = 'm2'`, `project_id: null`.

### Case 25: setNorm with a resource from another scope
- **Setup**: Attempt to add a project-scoped resource to a master activity norm.
- **Assertions**:
  - Throws `CatalogError` with `CAT_SCOPE_MISMATCH`.

### Case 26: setNorm in an incompatible unit
- **Setup**: Resource base unit is `kg`. Attempt to define norm in `litre` without conversion.
- **Assertions**:
  - Throws `CatalogError` with `CAT_UNIT_INCOMPATIBLE`.

### Case 27: Overlapping norm periods
- **Setup**: Set norm starting `2026-01-01`. Attempt to add second norm starting on identical date.
- **Assertions**:
  - Throws `CatalogError` with `CAT_NORM_OVERLAP`.

### Case 28: importActivity clones norms and reuses existing resources
- **Setup**: Master activity uses master resources A and B. Project already imported resource A.
- **Assertions**:
  - Activity is cloned to project scope.
  - Reuses existing project copy for A; automatically imports B into project scope.

### Case 29: importActivity twice (idempotent)
- **Setup**: Call `importActivity` again for the same project.
- **Assertions**:
  - Returns existing project activity; no duplicate activity or norm rows created.

### Case 30: computeActivityCost with diverse units and mid-year rate changes
- **Setup**: Norm uses cement in bags and sand in tonnes. Cement rate increases on `2026-06-01`.
- **Assertions**:
  - Query on `2026-03-01` prices cement with old rate.
  - Query on `2026-07-01` prices cement with new rate.
  - All unit conversions are handled accurately.

### Case 31: computeActivityCost with one missing rate
- **Setup**: Activity has 2 norms. One resource has an active rate; the second has no rate.
- **Assertions**:
  - Evaluates priced line amount.
  - Missing rate line has `rate: null`, `amount: null`.
  - Flags `complete: false`, `incomplete: true`, with warning `MISSING_RATE`.

### Case 32: Excavation sample & empty-norm activity
- **Setup**:
  1. Excavation activity composed exclusively of labour + equipment norms (zero material norms).
  2. Inspection activity with zero norms.
- **Assertions**:
  - Excavation computes sum of operator + excavator costs.
  - Empty activity returns `total: 0`, `complete: true`, `incomplete: false`.

### Case 33: expectedUsage for 20 $m^2$ brickwork on a given date
- **Setup**: Brickwork activity norms: Cement (0.2 bag/$m^2$) and Bricks (50 nos/$m^2$). 1 bag = 50 kg.
- **Assertions**:
  - Query for 20 $m^2$ output:
    - Cement: $20 \times 0.2 \times 50\text{ kg} = 200\text{ kg}$.
    - Bricks: $20 \times 50 = 1000\text{ nos}$.

### Case 34: Archive a resource, then add it to a new norm
- **Setup**: Archive resource `ARC-34`. Attempt to use it in `setNorm`.
- **Assertions**:
  - Rejection throws `CatalogError` with `CAT_ARCHIVED`.
  - Existing historical norms and cost calculations continue to read normally.

### Case 35: Delete a resource used by a norm or registered check
- **Setup**:
  1. Attempt to delete resource referenced by an active norm.
  2. Attempt to delete resource flagged by external `registerUsageCheck` hook.
- **Assertions**:
  - Both attempts throw `CatalogError` with `CAT_IN_USE`.

### Case 36: Delete an unused resource
- **Setup**: Create standalone unused resource and call `deleteResource`.
- **Assertions**:
  - Row deleted from database.
  - Change log records `action = 'delete'`.

### Case 37: Two simultaneous setRate calls for the same resource
- **Setup**: Fire two concurrent `setRate` calls inside separate transactions.
- **Assertions**:
  - Serialized via `SELECT ... FOR UPDATE`; no overlapping periods produced.

### Case 38: Two simultaneous imports of the same master
- **Setup**: Fire two concurrent `importResource` requests for the same master into the same project.
- **Assertions**:
  - Handled safely via row locks; exactly one project copy created.

### Case 39: Corrupt rows by direct SQL, then run checkIntegrity
- **Setup**: Direct SQL inserts creating scope mismatches, parent on master, and overlapping periods.
- **Assertions**:
  - `checkIntegrity()` reports all violations: `MASTER_RESOURCE_HAS_PARENT`, `NORM_SCOPE_MISMATCH`, `OVERLAPPING_RATE_PERIODS`, `RATE_UNIT_INCOMPATIBLE`.

### Case 40: assertProjectScoped with the wrong project
- **Setup**: Call `assertProjectScoped('resource', resId, targetProjectId)` with mismatched IDs.
- **Assertions**:
  - Throws `CatalogError` with `CAT_SCOPE_MISMATCH`.

### Case 41: expectedUsage with wastage % and unit conversion
- **Setup**:
  - Cement base unit `kg`, conversion `1 bag = 50 kg`.
  - Activity norm: `0.03 bag / m2` output with `wastagePct = 5`.
  - Output quantity: `20 m2`.
- **Assertions**:
  - $\text{Net} = 20 \times 0.03\text{ bag} = 0.6\text{ bag} \times 50\text{ kg} = 30\text{ kg}$.
  - $\text{Allowance} = 30\text{ kg} \times 5\% = 1.5\text{ kg}$.
  - $\text{Gross} = 30 + 1.5 = 31.5\text{ kg}$.
  - Line returns `netQty: 30`, `allowanceQty: 1.5`, `grossQty: 31.5`, `wastagePct: 5`.

### Case 42: computeActivityCost uses gross quantity for line amount and total
- **Setup**: Steel priced at 100/kg. Activity A has 50 kg norm at 0% waste; Activity B has 50 kg norm at 10% waste.
- **Assertions**:
  - Activity A: $50\text{ kg gross} \times 100 = 5000$.
  - Activity B: $55\text{ kg gross} \times 100 = 5500$.
  - Cost B is exactly 10% higher than Cost A.

### Case 43: Default 0 leaves results unchanged, out-of-range wastage is rejected
- **Setup**:
  1. `setNorm` without `wastagePct` option $\rightarrow$ defaults to `0`.
  2. Attempt `setNorm` with `wastagePct = -1` or `100.001` $\rightarrow$ rejected.
  3. Attempt `correctNorm` with `wastagePct = -0.001` or `100.5` $\rightarrow$ rejected.
  4. Call `correctNorm` with `wastagePct = 7.5` $\rightarrow$ updates to `7.5`.
- **Assertions**:
  - Out-of-range inputs throw `CatalogError` with `CAT_INVALID_VALUE`.
  - Valid correction updates norm row and change log.

### Case 44: importActivity copies wastage_pct, getSyncDiff detects it and acceptSync updates it
- **Setup**:
  1. Master norm created with 4% wastage.
  2. Project imports activity $\rightarrow$ copy has 4% wastage.
  3. Master norm corrected to 8% wastage $\rightarrow$ master version bumps.
  4. Run `getSyncDiff` $\rightarrow$ flags `isBehind: true` and `norms.changed: true`.
  5. Run `acceptSync({ norms: true })` $\rightarrow$ updates project norm to 8% wastage.
- **Assertions**:
  - Wastage percentage propagates accurately through import, sync diffing, and selective sync acceptance.

