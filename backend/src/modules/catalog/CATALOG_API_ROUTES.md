# Module 2: Catalog API Routes & Contract Specification

**Module**: Catalog (`cat_*`)  
**Production Base URL**: `/api/catalog`  
**Developer Lab Base URL**: `/api/dev/catalog`  
**Authentication**: Bearer JWT (`Authorization: Bearer <token>`)  
**Data Engine**: MySQL 8.0.16+ (`DECIMAL` exact arithmetic) / Node.js Express  

---

<a id="master-api-route-index"></a>
## ⚡ Master API Route Index (Clickable)

Click on any HTTP method or endpoint path below to jump directly to its complete contract specifications, request parameters, JSON body schema, and sample responses.

> **Jump by Category**:  
> [3. Units & Conversions](#3-units--decimal-conversions) • [4. Resources (Materials / Labour / Equipment)](#4-resources-materials-labour-equipment) • [5. Packaging Conversions](#5-resource-packaging-conversions) • [6. Effective-Dated Rates](#6-effective-dated-rates) • [7. Activities & Composition Norms](#7-activities--composition-norms) • [8. Dynamic Computation](#8-dynamic-computation--analysis) • [9. Audit Change Log](#9-audit-change-log) • [10. Dev Lab Diagnostics](#10-dev-lab-diagnostic--test-endpoints)

### Production Catalog Routes (`/api/catalog`)

| Method | Endpoint / Route | Action / Description | Scope | Jump Link |
|:---:|---|---|:---:|:---:|
| `GET` | [`/api/catalog/units`](#31-list-units) | List global system units & tenant custom units | Global / Org | [Section 3.1](#31-list-units) |
| `POST` | [`/api/catalog/units`](#32-create-custom-unit) | Create organization custom operational unit | Org | [Section 3.2](#32-create-custom-unit) |
| `PUT` | [`/api/catalog/units/:id`](#33-update-custom-unit) | Update tenant custom operational unit | Org | [Section 3.3](#33-update-custom-unit) |
| `POST` | [`/api/catalog/units/convert`](#34-exact-unit-converter) | Exact 10-decimal unit conversion engine | Engine | [Section 3.4](#34-exact-unit-converter) |
| `GET` | [`/api/catalog/resources`](#41-list-resources) | List materials, labour, equipment (filter by scope/kind) | Master / Proj | [Section 4.1](#41-list-resources) |
| `POST` | [`/api/catalog/resources`](#42-create-resource) | Create master or project-specific resource | Master / Proj | [Section 4.2](#42-create-resource) |
| `GET` | [`/api/catalog/resources/:id`](#43-get-resource-details) | Get single resource details with base unit metadata | Any | [Section 4.3](#43-get-resource-details) |
| `PUT` | [`/api/catalog/resources/:id`](#44-update-resource) | Update resource name, code, description, remarks | Any | [Section 4.4](#44-update-resource) |
| `POST` | [`/api/catalog/resources/:id/archive`](#45-archive-resource) | Soft-archive resource with audit reason | Any | [Section 4.5](#45-archive-resource) |
| `POST` | [`/api/catalog/resources/:id/restore`](#46-restore-resource) | Restore archived resource back to active | Any | [Section 4.6](#46-restore-resource) |
| `DELETE` | [`/api/catalog/resources/:id`](#47-delete-resource) | Hard-delete unused resource (with in-use protection) | Any | [Section 4.7](#47-delete-resource) |
| `POST` | [`/api/catalog/resources/import`](#48-import-resource-into-project) | Import master resource into project scope | Proj Copy | [Section 4.8](#48-import-resource-into-project) |
| `GET` | [`/api/catalog/resources/:id/sync-status`](#49-get-resource-sync-status) | Compare project copy synced version against master | Proj Copy | [Section 4.9](#49-get-resource-sync-status) |
| `GET` | [`/api/catalog/resources/:id/sync-diff`](#410-get-resource-sync-diff) | Field-by-field and rate-by-rate sync diff | Proj Copy | [Section 4.10](#410-get-resource-sync-diff) |
| `POST` | [`/api/catalog/resources/:id/sync-accept`](#411-accept-resource-sync) | Selectively pull updates from master into project copy | Proj Copy | [Section 4.11](#411-accept-resource-sync) |
| `GET` | [`/api/catalog/resources/:id/conversions`](#51-list-resource-conversions) | List packaging conversions for resource (e.g. bag $\leftrightarrow$ kg) | Resource | [Section 5.1](#51-list-resource-conversions) |
| `POST` | [`/api/catalog/resources/:id/conversions`](#52-set-resource-conversion) | Set packaging conversion factor for resource | Resource | [Section 5.2](#52-set-resource-conversion) |
| `DELETE` | [`/api/catalog/conversions/:conversionId`](#53-remove-resource-conversion) | Remove packaging conversion rule | Resource | [Section 5.3](#53-remove-resource-conversion) |
| `GET` | [`/api/catalog/resources/:id/rates`](#61-list-rates) | List full historical, active & scheduled rate ledger | Resource | [Section 6.1](#61-list-rates) |
| `GET` | [`/api/catalog/resources/:id/rate`](#62-get-rate-as-of-date) | Get single effective rate as of specified date | Resource | [Section 6.2](#62-get-rate-as-of-date) |
| `POST` | [`/api/catalog/resources/:id/rates`](#63-set-rate) | Set new rate (auto-closes prior open-ended rate) | Resource | [Section 6.3](#63-set-rate) |
| `PUT` | [`/api/catalog/rates/:rateId`](#64-correct-rate-audited) | Correct rate value or dates with mandatory audit reason | Rate | [Section 6.4](#64-correct-rate-audited) |
| `DELETE` | [`/api/catalog/rates/:rateId`](#65-remove-rate) | Delete scheduled future rate (past/active protected) | Rate | [Section 6.5](#65-remove-rate) |
| `GET` | [`/api/catalog/activities`](#71-list-activities) | List construction/engineering activities by scope | Master / Proj | [Section 7.1](#71-list-activities) |
| `POST` | [`/api/catalog/activities`](#72-create-activity) | Create master or project-specific activity | Master / Proj | [Section 7.2](#72-create-activity) |
| `GET` | [`/api/catalog/activities/:id`](#73-get-activity-details) | Get activity details and its current composition norms | Any | [Section 7.3](#73-get-activity-details) |
| `PUT` | [`/api/catalog/activities/:id`](#74-update-activity) | Update activity name, code, description, remarks | Any | [Section 7.4](#74-update-activity) |
| `POST` | [`/api/catalog/activities/:id/archive`](#75-archive-activity) | Soft-archive activity with audit reason | Any | [Section 7.5](#75-archive-activity) |
| `POST` | [`/api/catalog/activities/:id/restore`](#76-restore-activity) | Restore archived activity back to active | Any | [Section 7.6](#76-restore-activity) |
| `DELETE` | [`/api/catalog/activities/:id`](#77-delete-activity) | Hard-delete unused activity (with in-use protection) | Any | [Section 7.7](#77-delete-activity) |
| `POST` | [`/api/catalog/activities/import`](#78-import-activity-into-project) | Import master activity and clone norm lines to project | Proj Copy | [Section 7.8](#78-import-activity-into-project) |
| `GET` | [`/api/catalog/activities/:id/sync-status`](#79-get-activity-sync-status) | Compare project activity synced version against master | Proj Copy | [Section 7.9](#79-get-activity-sync-status) |
| `GET` | [`/api/catalog/activities/:id/sync-diff`](#710-get-activity-sync-diff) | Field-by-field and norm-by-norm sync diff | Proj Copy | [Section 7.10](#710-get-activity-sync-diff) |
| `POST` | [`/api/catalog/activities/:id/sync-accept`](#711-accept-activity-sync) | Pull latest master norms/fields into project activity | Proj Copy | [Section 7.11](#711-accept-activity-sync) |
| `GET` | [`/api/catalog/activities/:id/norms`](#712-get-activity-norms) | List composition norm consumption lines | Activity | [Section 7.12](#712-get-activity-norms) |
| `POST` | [`/api/catalog/activities/:id/norms`](#713-set-activity-norm-line) | Add or schedule resource consumption norm line | Activity | [Section 7.13](#713-set-activity-norm-line) |
| `PUT` | [`/api/catalog/norms/:normId`](#714-correct-norm-audited) | Correct norm quantity or dates with audit reason | Norm | [Section 7.14](#714-correct-norm-audited) |
| `DELETE` | [`/api/catalog/norms/:normId`](#715-remove-norm) | Delete scheduled future norm line | Norm | [Section 7.15](#715-remove-norm) |
| `GET` | [`/api/catalog/activities/:id/cost`](#81-compute-activity-unit-cost) | Dynamic unit cost computation ($norm \times rate$) as of date | Computation | [Section 8.1](#81-compute-activity-unit-cost) |
| `GET` | [`/api/catalog/activities/:id/expected-usage`](#82-expected-resource-usage-bom-generator) | Bill of Materials (BOM) generator for planned work qty | Computation | [Section 8.2](#82-expected-resource-usage-bom-generator) |
| `GET` | [`/api/catalog/changelog/:entity/:id`](#91-get-entity-audit-history) | Immutable audit trail with before/after snapshots | Audit | [Section 9.1](#91-get-entity-audit-history) |

### Developer Lab Diagnostic Routes (`/api/dev/catalog`)

| Method | Endpoint / Route | Action / Description | Scope | Jump Link |
|:---:|---|---|:---:|:---:|
| `POST` | [`/api/dev/catalog/units/seed`](#101-seed-global-standard-units) | One-time idempotent seed of global system standard units | Lab Dev | [Section 10.1](#101-seed-global-standard-units) |
| `POST` | [`/api/dev/catalog/units/repair`](#102-repair-system-units-self-healing) | One-click self-healing repair from authoritative registry | Lab Dev | [Section 10.2](#102-repair-system-units-self-healing) |
| `GET` | [`/api/dev/catalog/integrity`](#103-run-integrity-diagnostics) | Execute 10 deep automated catalog health integrity checks | Lab Dev | [Section 10.3](#103-run-integrity-diagnostics) |
| `GET` | [`/api/dev/catalog/in-use-simulator`](#104-get-in-use-simulator-state) | Inspect simulated downstream lock states | Lab Dev | [Section 10.4](#104-get-in-use-simulator-state) |
| `POST` | [`/api/dev/catalog/in-use-simulator`](#105-toggle-in-use-simulator-lock) | Toggle mock downstream foreign lock on resource or activity | Lab Dev | [Section 10.5](#105-toggle-in-use-simulator-lock) |
| `POST` | [`/api/dev/catalog/run-tests`](#106-run-automated-test-suite) | Execute 40 automated test scenarios against live MySQL | Lab Dev | [Section 10.6](#106-run-automated-test-suite) |

---

## Table of Contents
1. [Overview & Authentication](#1-overview--authentication)
2. [Error Code Catalog](#2-error-code-catalog)
3. [Units & Decimal Conversions](#3-units--decimal-conversions)
   - [3.1 List Units (`GET /api/catalog/units`)](#31-list-units)
   - [3.2 Create Custom Unit (`POST /api/catalog/units`)](#32-create-custom-unit)
   - [3.3 Update Custom Unit (`PUT /api/catalog/units/:id`)](#33-update-custom-unit)
   - [3.4 Exact Unit Converter (`POST /api/catalog/units/convert`)](#34-exact-unit-converter)
4. [Resources (Materials, Labour, Equipment)](#4-resources-materials-labour-equipment)
   - [4.1 List Resources (`GET /api/catalog/resources`)](#41-list-resources)
   - [4.2 Create Resource (`POST /api/catalog/resources`)](#42-create-resource)
   - [4.3 Get Resource Details (`GET /api/catalog/resources/:id`)](#43-get-resource-details)
   - [4.4 Update Resource (`PUT /api/catalog/resources/:id`)](#44-update-resource)
   - [4.5 Archive Resource (`POST /api/catalog/resources/:id/archive`)](#45-archive-resource)
   - [4.6 Restore Resource (`POST /api/catalog/resources/:id/restore`)](#46-restore-resource)
   - [4.7 Delete Resource (`DELETE /api/catalog/resources/:id`)](#47-delete-resource)
   - [4.8 Import Resource into Project (`POST /api/catalog/resources/import`)](#48-import-resource-into-project)
   - [4.9 Get Resource Sync Status (`GET /api/catalog/resources/:id/sync-status`)](#49-get-resource-sync-status)
   - [4.10 Get Resource Sync Diff (`GET /api/catalog/resources/:id/sync-diff`)](#410-get-resource-sync-diff)
   - [4.11 Accept Resource Sync (`POST /api/catalog/resources/:id/sync-accept`)](#411-accept-resource-sync)
5. [Resource Packaging Conversions](#5-resource-packaging-conversions)
   - [5.1 List Resource Conversions (`GET /api/catalog/resources/:id/conversions`)](#51-list-resource-conversions)
   - [5.2 Set Resource Conversion (`POST /api/catalog/resources/:id/conversions`)](#52-set-resource-conversion)
   - [5.3 Remove Resource Conversion (`DELETE /api/catalog/conversions/:conversionId`)](#53-remove-resource-conversion)
6. [Effective-Dated Rates](#6-effective-dated-rates)
   - [6.1 List Rates (`GET /api/catalog/resources/:id/rates`)](#61-list-rates)
   - [6.2 Get Rate As Of Date (`GET /api/catalog/resources/:id/rate`)](#62-get-rate-as-of-date)
   - [6.3 Set Rate (`POST /api/catalog/resources/:id/rates`)](#63-set-rate)
   - [6.4 Correct Rate (Audited) (`PUT /api/catalog/rates/:rateId`)](#64-correct-rate-audited)
   - [6.5 Remove Rate (`DELETE /api/catalog/rates/:rateId`)](#65-remove-rate)
7. [Activities & Composition Norms](#7-activities--composition-norms)
   - [7.1 List Activities (`GET /api/catalog/activities`)](#71-list-activities)
   - [7.2 Create Activity (`POST /api/catalog/activities`)](#72-create-activity)
   - [7.3 Get Activity Details (`GET /api/catalog/activities/:id`)](#73-get-activity-details)
   - [7.4 Update Activity (`PUT /api/catalog/activities/:id`)](#74-update-activity)
   - [7.5 Archive Activity (`POST /api/catalog/activities/:id/archive`)](#75-archive-activity)
   - [7.6 Restore Activity (`POST /api/catalog/activities/:id/restore`)](#76-restore-activity)
   - [7.7 Delete Activity (`DELETE /api/catalog/activities/:id`)](#77-delete-activity)
   - [7.8 Import Activity into Project (`POST /api/catalog/activities/import`)](#78-import-activity-into-project)
   - [7.9 Get Activity Sync Status (`GET /api/catalog/activities/:id/sync-status`)](#79-get-activity-sync-status)
   - [7.10 Get Activity Sync Diff (`GET /api/catalog/activities/:id/sync-diff`)](#710-get-activity-sync-diff)
   - [7.11 Accept Activity Sync (`POST /api/catalog/activities/:id/sync-accept`)](#711-accept-activity-sync)
   - [7.12 Get Activity Norms (`GET /api/catalog/activities/:id/norms`)](#712-get-activity-norms)
   - [7.13 Set Activity Norm Line (`POST /api/catalog/activities/:id/norms`)](#713-set-activity-norm-line)
   - [7.14 Correct Norm (Audited) (`PUT /api/catalog/norms/:normId`)](#714-correct-norm-audited)
   - [7.15 Remove Norm (`DELETE /api/catalog/norms/:normId`)](#715-remove-norm)
8. [Dynamic Computation & Analysis](#8-dynamic-computation--analysis)
   - [8.1 Compute Activity Unit Cost (`GET /api/catalog/activities/:id/cost`)](#81-compute-activity-unit-cost)
   - [8.2 Expected Resource Usage / BOM (`GET /api/catalog/activities/:id/expected-usage`)](#82-expected-resource-usage-bom-generator)
9. [Audit Change Log](#9-audit-change-log)
   - [9.1 Get Entity Audit History (`GET /api/catalog/changelog/:entity/:id`)](#91-get-entity-audit-history)
10. [Dev Lab Diagnostic & Test Endpoints](#10-dev-lab-diagnostic--test-endpoints)
    - [10.1 Seed Global Standard Units (`POST /api/dev/catalog/units/seed`)](#101-seed-global-standard-units)
    - [10.2 Repair System Units (Self-Healing) (`POST /api/dev/catalog/units/repair`)](#102-repair-system-units-self-healing)
    - [10.3 Run Integrity Diagnostics (`GET /api/dev/catalog/integrity`)](#103-run-integrity-diagnostics)
    - [10.4 Get In-Use Simulator State (`GET /api/dev/catalog/in-use-simulator`)](#104-get-in-use-simulator-state)
    - [10.5 Toggle In-Use Simulator Lock (`POST /api/dev/catalog/in-use-simulator`)](#105-toggle-in-use-simulator-lock)
    - [10.6 Run Automated Test Suite (`POST /api/dev/catalog/run-tests`)](#106-run-automated-test-suite)

---

## 1. Overview & Authentication

All endpoints are mounted under `/api/catalog` (production) and `/api/dev/catalog` (dev lab).
Every request must supply a valid JWT token:
```http
Authorization: Bearer <jwt_token>
```
The tenant organization is resolved automatically from `req.user.org_id`. In testing or developer mode, an explicit `?orgId=<id>` or body `{ "orgId": <id> }` may be supplied.

### Standard Response Envelope
All successful responses return HTTP `200` (or `201` for creation) with a uniform JSON envelope:
```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Error Envelope
All operational failures return an appropriate HTTP status code (`400`, `404`, `409`, `500`) with stable machine-readable error codes:
```json
{
  "error": {
    "code": "CAT_DUPLICATE_CODE",
    "message": "Resource code \"MAT-CEM-01\" already exists in this scope",
    "details": null
  }
}
```

---

## 2. Error Code Catalog

| Error Code | HTTP Status | Description / Trigger Condition |
|---|---|---|
| `CAT_NOT_FOUND` | 404 | Entity ID not found in database |
| `CAT_DUPLICATE_CODE` | 409 | Duplicate code in scope, or duplicate rate/norm start date |
| `CAT_KIND_MISMATCH` | 400 | Attempted to change resource `kind`, or project copy kind != master kind |
| `CAT_SCOPE_MISMATCH` | 400 | Master with `parent_id`, mixing master and project scopes in norms, or cross-org violation |
| `CAT_UNIT_INCOMPATIBLE` | 400 | Unit category does not match resource base unit category and no conversion exists |
| `CAT_NO_CONVERSION` | 400 | Conversion requested between incompatible categories with no valid path |
| `CAT_RATE_OVERLAP` | 400 | Attempted to create overlapping effective date windows for a resource rate |
| `CAT_NORM_OVERLAP` | 400 | Attempted to create overlapping effective date windows for an activity norm line |
| `CAT_IN_USE` | 400 | Attempted to delete or alter base unit of a resource referenced by rates, norms, or external checks |
| `CAT_ARCHIVED` | 400 | Attempted to mutate or add an archived entity to a new composition |
| `CAT_NOT_MASTER` | 400 | `importResource` or `importActivity` called on a row that is not a master (`project_id IS NOT NULL`) |
| `CAT_INVALID_VALUE` | 400 | Negative rates/quantities, invalid dates, empty codes/names, or modifying immutable system units |

---

## 3. Units & Decimal Conversions

Standard SI units are **global system constants** (`org_id IS NULL`, immutable). Tenants may define custom operational units (`org_id NOT NULL`).

### 3.1 List Units
* **Method**: `GET`
* **Path**: `/api/catalog/units`
* **Query Params**:
  * `orgId` (optional number): Target tenant ID. Defaults to `req.user.org_id`.
* **Needs / Purpose**: Returns all global standard units (`kg`, `g`, `m`, `m3`, `hr`, `nos`, etc.) plus any custom operational units belonging to the organization.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "org_id": null,
      "code": "kg",
      "name": "Kilogram",
      "category": "weight",
      "to_base_factor": "1.0000000000",
      "is_base": 1
    },
    {
      "id": 2,
      "org_id": null,
      "code": "g",
      "name": "Gram",
      "category": "weight",
      "to_base_factor": "0.0010000000",
      "is_base": 0
    }
  ]
}
```

### 3.2 Create Custom Unit
* **Method**: `POST`
* **Path**: `/api/catalog/units`
* **Body**:
  * `code` (required string, max 20): Unique unit code within org.
  * `name` (required string, max 60): Human-readable name.
  * `category` (required enum): `'weight' | 'volume' | 'area' | 'length' | 'count' | 'time'`.
  * `toBaseFactor` (required positive decimal string or number): Scaling factor to category base unit.
  * `isBase` (optional boolean): Defaults to `false`. Custom units cannot be base units if a base unit already exists.
* **Needs / Purpose**: Allows an organization to define a custom operational unit (e.g. `shift = 10 hr`). Cannot collide with global unit codes.
* **Response**: `201 Created`

### 3.3 Update Custom Unit
* **Method**: `PUT`
* **Path**: `/api/catalog/units/:id`
* **Body**:
  * `name` (optional string)
  * `code` (optional string)
  * `toBaseFactor` (optional positive decimal)
* **Needs / Purpose**: Updates a tenant's custom unit. **System standard units (`org_id IS NULL`) are immutable and will reject updates with `CAT_INVALID_VALUE`**.

### 3.4 Exact Unit Converter
* **Method**: `POST`
* **Path**: `/api/catalog/units/convert`
* **Body**:
  * `qty` (required decimal string or number)
  * `fromUnitId` (required number)
  * `toUnitId` (required number)
  * `resourceId` (optional number): Required if converting across categories (e.g. `kg` to `bag` via cement).
* **Needs / Purpose**: Performs exact 10-decimal precision conversion using native `BigInt` arithmetic. Resolves category factors and multi-step resource conversion graphs.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "result": 1.5
  }
}
```

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 4. Resources (Materials, Labour, Equipment)

Resources are flat items categorized into `material`, `labour`, or `equipment`. Master resources have `project_id = null`. Project copies have `project_id = N` and `parent_id = master.id`.

### 4.1 List Resources
* **Method**: `GET`
* **Path**: `/api/catalog/resources`
* **Query Params**:
  * `scope` (optional `'master' | 'project'`): Filters master or project resources.
  * `projectId` (optional number): Filters by specific project ID.
  * `kind` (optional `'material' | 'labour' | 'equipment'`)
  * `status` (optional `'active' | 'archived'`)
  * `search` (optional string): Substring search across code and name.
* **Needs / Purpose**: Populates resource pickers, inventory catalogs, and estimation sheets.

### 4.2 Create Resource
* **Method**: `POST`
* **Path**: `/api/catalog/resources`
* **Body**:
  * `kind` (required enum): `'material' | 'labour' | 'equipment'`.
  * `code` (required string, max 40): Unique code within `(org_id, scope_key)`.
  * `name` (required string, max 160).
  * `baseUnitId` (required number): Foreign key to `cat_unit.id`. Must be accessible to org.
  * `projectId` (optional number): If omitted or `null`, creates a Master resource.
  * `parentId` (optional number): Required if creating a direct project variant copy.
  * `description` (optional string, max 500).
  * `remarks` (optional string, max 500).
* **Needs / Purpose**: Registers a new resource in master or project catalog.
* **Response**: `201 Created`

### 4.3 Get Resource Details
* **Method**: `GET`
* **Path**: `/api/catalog/resources/:id`
* **Needs / Purpose**: Retrieves full details of a single resource, including its base unit code, name, category, and sync status.

### 4.4 Update Resource
* **Method**: `PUT`
* **Path**: `/api/catalog/resources/:id`
* **Body**:
  * `name` (optional string)
  * `code` (optional string)
  * `description` (optional string)
  * `remarks` (optional string)
  * `baseUnitId` (optional number): **Only allowed if no rates or norms reference this resource**.
* **Guarantees**: Resource `kind` is strictly immutable (`CAT_KIND_MISMATCH`). Bumps `version` on master.

### 4.5 Archive Resource
* **Method**: `POST`
* **Path**: `/api/catalog/resources/:id/archive`
* **Body**: `{ "reason": "optional audit reason" }`
* **Needs / Purpose**: Soft-archives a resource. Historical documents remain valid, but the resource cannot be used in new norms or imported.

### 4.6 Restore Resource
* **Method**: `POST`
* **Path**: `/api/catalog/resources/:id/restore`
* **Body**: `{ "reason": "optional audit reason" }`
* **Needs / Purpose**: Restores an archived resource back to `active`.

### 4.7 Delete Resource
* **Method**: `DELETE`
* **Path**: `/api/catalog/resources/:id`
* **Body**: `{ "reason": "optional audit reason" }`
* **Needs / Purpose**: Hard-deletes an unused resource. Rejects with `CAT_IN_USE` if any rate, norm, project copy, or registered downstream usage check references it.

### 4.8 Import Resource into Project
* **Method**: `POST`
* **Path**: `/api/catalog/resources/import`
* **Body**:
  * `masterId` (required number): ID of the master resource.
  * `projectId` (required number): Target project ID.
  * `asNewVariant` (optional boolean): When `true`, creates a new variant copy. When `false` (default), idempotent (returns existing copy if already imported).
  * `code` (optional string): Required if `asNewVariant` is true to avoid code collisions.
  * `name` (optional string).
* **Needs / Purpose**: Copies a master material/labour/equipment into a project scope, copying over baseline rates and conversions with `parent_id = master.id` and `synced_version = master.version`.

### 4.9 Get Resource Sync Status
* **Method**: `GET`
* **Path**: `/api/catalog/resources/:id/sync-status`
* **Needs / Purpose**: Compares project copy's `synced_version` against master's current `version`. Returns `{ hasUpdates: boolean, masterVersion: number, currentSyncedVersion: number }`.

### 4.10 Get Resource Sync Diff
* **Method**: `GET`
* **Path**: `/api/catalog/resources/:id/sync-diff`
* **Needs / Purpose**: Returns a field-by-field and rate-by-rate diff between the project copy and the latest master.

### 4.11 Accept Resource Sync
* **Method**: `POST`
* **Path**: `/api/catalog/resources/:id/sync-accept`
* **Body**:
  * `fields` (optional array of strings): e.g. `['name', 'description']`.
  * `rates` (optional boolean): Apply latest master rates.
  * `conversions` (optional boolean): Apply latest master packaging conversions.
  * `reason` (optional string).
* **Needs / Purpose**: Selectively pulls master updates into the project copy and advances `synced_version` to match master.

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 5. Resource Packaging Conversions

Packaging conversions link resource-specific trade metrics (e.g. `bag`, `truck`, `drum`) to standard base units (e.g. `kg`, `m3`, `litre`).

### 5.1 List Resource Conversions
* **Method**: `GET`
* **Path**: `/api/catalog/resources/:id/conversions`
* **Response**: Returns list of conversion records with `from_unit_code`, `to_unit_code`, and `factor`.

### 5.2 Set Resource Conversion
* **Method**: `POST`
* **Path**: `/api/catalog/resources/:id/conversions`
* **Body**:
  * `fromUnitId` (required number)
  * `toUnitId` (required number)
  * `factor` (required positive decimal string or number): Direct multiplier (`qtyInFrom * factor = qtyInTo`).
  * `reason` (optional string).
* **Needs / Purpose**: Defines e.g. `1 bag = 50 kg` for Cement. Bi-directional (allows converting `kg` $\rightarrow$ `bag` and `bag` $\rightarrow$ `kg`).

### 5.3 Remove Resource Conversion
* **Method**: `DELETE`
* **Path**: `/api/catalog/conversions/:conversionId`
* **Needs / Purpose**: Deletes a packaging conversion rule for a resource.

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 6. Effective-Dated Rates

Rates are defined per resource with non-overlapping effective dates (`effective_from` to `effective_to`).

### 6.1 List Rates
* **Method**: `GET`
* **Path**: `/api/catalog/resources/:id/rates`
* **Needs / Purpose**: Returns full historical, active, and scheduled future rate records for a resource.

### 6.2 Get Rate As Of Date
* **Method**: `GET`
* **Path**: `/api/catalog/resources/:id/rate`
* **Query Params**:
  * `date` (required string `YYYY-MM-DD`): Target evaluation date.
  * `inUnit` (optional number): Target unit ID. If provided, converts rate automatically.
* **Needs / Purpose**: Finds the single rate in force on that calendar date.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": 14,
    "resource_id": 8,
    "rate": "400.0000",
    "unit_id": 16,
    "unit_code": "bag",
    "effective_from": "2026-01-01",
    "effective_to": null,
    "note": "Standard supplier rate"
  }
}
```

### 6.3 Set Rate
* **Method**: `POST`
* **Path**: `/api/catalog/resources/:id/rates`
* **Body**:
  * `rate` (required non-negative decimal string or number).
  * `unitId` (required number): Must belong to resource base category or have an existing conversion.
  * `effectiveFrom` (required string `YYYY-MM-DD`).
  * `note` (optional string).
* **Guarantees**:
  * Automatically closes any active open-ended rate on the day before (`effectiveFrom - 1 day`).
  * Concurrency safety with `SELECT ... FOR UPDATE`. Rejects overlaps with `CAT_RATE_OVERLAP`.
* **Response**: `201 Created`

### 6.4 Correct Rate (Audited)
* **Method**: `PUT`
* **Path**: `/api/catalog/rates/:rateId`
* **Body**:
  * `rate` (optional decimal)
  * `effectiveFrom` (optional `YYYY-MM-DD`)
  * `effectiveTo` (optional `YYYY-MM-DD`)
  * `note` (optional string)
  * `reason` (required non-empty string): Mandatory audit reason.
* **Needs / Purpose**: Corrects a data entry mistake on past or active rates without breaking date integrity. Records before/after data in `cat_change_log`.

### 6.5 Remove Rate
* **Method**: `DELETE`
* **Path**: `/api/catalog/rates/:rateId`
* **Query or Body**: `{ "reason": "Price hike cancelled" }`
* **Guarantees**: **Only scheduled future rates (`effective_from > today`) can be deleted**. Past and active rates reject deletion with `CAT_INVALID_VALUE` to protect financial history.

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 7. Activities & Composition Norms

Activities represent construction or engineering tasks (e.g. Masonry, Painting, Excavation). Norms are flat resource consumption lines per unit of activity output.

### 7.1 List Activities
* **Method**: `GET`
* **Path**: `/api/catalog/activities`
* **Query Params**: `scope`, `projectId`, `status`, `search`.

### 7.2 Create Activity
* **Method**: `POST`
* **Path**: `/api/catalog/activities`
* **Body**:
  * `code` (required string, max 40): Unique code within scope.
  * `name` (required string, max 160).
  * `outputUnitId` (required number): Foreign key to `cat_unit.id` (e.g. `m2`, `m3`, `rm`).
  * `projectId` (optional number): Omit for Master activity.
  * `parentId` (optional number).
  * `description` (optional string).
  * `remarks` (optional string).
* **Response**: `201 Created`

### 7.3 Get Activity Details
* **Method**: `GET`
* **Path**: `/api/catalog/activities/:id`
* **Needs / Purpose**: Returns activity metadata and its current active norm lines.

### 7.4 Update Activity
* **Method**: `PUT`
* **Path**: `/api/catalog/activities/:id`
* **Body**: `name`, `code`, `description`, `remarks`, `outputUnitId`.

### 7.5 Archive Activity
* **Method**: `POST`
* **Path**: `/api/catalog/activities/:id/archive`
* **Body**: `{ "reason": "optional audit reason" }`
* **Needs / Purpose**: Soft-archives an activity. Historical progress records and previous estimations remain intact, but the activity is marked inactive and hidden from active pickers.
* **Response**: `200 OK`

### 7.6 Restore Activity
* **Method**: `POST`
* **Path**: `/api/catalog/activities/:id/restore`
* **Body**: `{ "reason": "optional audit reason" }`
* **Needs / Purpose**: Restores an archived activity back to active status.
* **Response**: `200 OK`

### 7.7 Delete Activity
* **Method**: `DELETE`
* **Path**: `/api/catalog/activities/:id`
* **Body**: `{ "reason": "optional audit reason" }`
* **Guarantees**: Hard-deletes an unused activity. Rejects with `CAT_IN_USE` if norms exist or downstream progress/schedule records reference it.
* **Response**: `200 OK`

### 7.8 Import Activity into Project
* **Method**: `POST`
* **Path**: `/api/catalog/activities/import`
* **Body**:
  * `masterId` (required number): ID of the master activity.
  * `projectId` (required number): Target project ID.
  * `asNewVariant` (optional boolean): When `true`, creates a new variant copy. When `false` (default), idempotent (returns existing copy if already imported).
  * `code` (optional string): Required if `asNewVariant` is true to avoid code collisions.
* **Guarantees**:
  * Reuses existing project copies of consumed resources if they were already imported, or imports missing ones automatically into the project scope.
  * Clones all active master norm lines into the project scope.
* **Response**: `201 Created`

### 7.9 Get Activity Sync Status
* **Method**: `GET`
* **Path**: `/api/catalog/activities/:id/sync-status`
* **Needs / Purpose**: Compares project activity's `synced_version` against the master activity's current `version`. Returns `{ hasUpdates: boolean, masterVersion: number, currentSyncedVersion: number }`.
* **Response**: `200 OK`

### 7.10 Get Activity Sync Diff
* **Method**: `GET`
* **Path**: `/api/catalog/activities/:id/sync-diff`
* **Needs / Purpose**: Returns a field-by-field and norm-by-norm diff between the project activity copy and the latest master.
* **Response**: `200 OK`

### 7.11 Accept Activity Sync
* **Method**: `POST`
* **Path**: `/api/catalog/activities/:id/sync-accept`
* **Body**:
  * `fields` (optional array of strings): e.g. `['name', 'description']`.
  * `norms` (optional boolean): Pull and apply latest master norm consumption lines.
  * `reason` (optional string).
* **Needs / Purpose**: Selectively pulls master updates into the project activity copy and advances `synced_version` to match master.
* **Response**: `200 OK`

### 7.12 Get Activity Norms
* **Method**: `GET`
* **Path**: `/api/catalog/activities/:id/norms`
* **Query Params**:
  * `date` (optional `YYYY-MM-DD`): If provided, returns only norm lines active on that calendar date.
* **Needs / Purpose**: Retrieves the resource consumption breakdown (e.g. 12 kg cement, 0.35 hr mason per $m^2$).
* **Response**: `200 OK`

### 7.13 Set Activity Norm Line
* **Method**: `POST`
* **Path**: `/api/catalog/activities/:id/norms`
* **Body**:
  * `resourceId` (required number): Resource to consume. **Must belong to the exact same scope** (`CAT_SCOPE_MISMATCH`).
  * `qtyPerUnit` (required positive decimal string or number).
  * `unitId` (required number): Unit of consumption. Must be compatible with the resource.
  * `effectiveFrom` (required string `YYYY-MM-DD`).
  * `note` (optional string).
* **Guarantees**:
  * Automatically closes any prior active norm for this resource on `effectiveFrom - 1 day`.
  * Rejects overlapping windows with `CAT_NORM_OVERLAP`.
* **Response**: `201 Created`

### 7.14 Correct Norm (Audited)
* **Method**: `PUT`
* **Path**: `/api/catalog/norms/:normId`
* **Body**:
  * `qtyPerUnit` (optional decimal)
  * `effectiveFrom` (optional `YYYY-MM-DD`)
  * `effectiveTo` (optional `YYYY-MM-DD`)
  * `note` (optional string)
  * `reason` (required non-empty string): Mandatory audit reason.
* **Needs / Purpose**: Corrects a data entry mistake on past or active norm lines without breaking date integrity. Records before/after data in `cat_change_log`.
* **Response**: `200 OK`

### 7.15 Remove Norm
* **Method**: `DELETE`
* **Path**: `/api/catalog/norms/:normId`
* **Query or Body**: `{ "reason": "Engineering revision cancelled" }`
* **Guarantees**: Only scheduled future norm lines (`effective_from > today`) can be deleted. Past and active norm lines reject deletion with `CAT_INVALID_VALUE` to protect estimation history.
* **Response**: `200 OK`

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 8. Dynamic Computation & Analysis

Cost and usage computations are evaluated dynamically on read. Values are never stored statically, avoiding stale data when rates or norms update.

### 8.1 Compute Activity Unit Cost
* **Method**: `GET`
* **Path**: `/api/catalog/activities/:id/cost`
* **Query Params**:
  * `date` (required string `YYYY-MM-DD`): Pricing evaluation date.
* **Needs / Purpose**: Calculates the direct cost per unit of work ($norm \times rate$). Sums exact decimal costs across all resources.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "activityId": 12,
    "activityCode": "ACT-PLAST-01",
    "activityName": "Internal Plastering 12mm",
    "outputUnitId": 8,
    "outputUnitCode": "m2",
    "date": "2026-06-01",
    "total": 142.50,
    "complete": true,
    "incomplete": false,
    "items": [
      {
        "resourceId": 4,
        "resourceCode": "MAT-CEM-01",
        "resourceName": "Cement OPC 53",
        "kind": "material",
        "normQty": 12.0,
        "normUnit": "kg",
        "rate": 7.50,
        "rateUnit": "kg",
        "subtotal": 90.00,
        "hasRate": true
      },
      {
        "resourceId": 5,
        "resourceCode": "LAB-MAS-01",
        "resourceName": "Mason",
        "kind": "labour",
        "normQty": 0.35,
        "normUnit": "hr",
        "rate": 150.00,
        "rateUnit": "hr",
        "subtotal": 52.50,
        "hasRate": true
      }
    ],
    "warnings": []
  }
}
```

### 8.2 Expected Resource Usage (BOM Generator)
* **Method**: `GET`
* **Path**: `/api/catalog/activities/:id/expected-usage`
* **Query Params**:
  * `outputQty` (required positive decimal): Planned quantity of activity (e.g. `250`).
  * `date` (required string `YYYY-MM-DD`).
* **Needs / Purpose**: Generates exact Bill of Materials and labour hours for scheduling and site procurement.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "activityId": 12,
    "activityCode": "ACT-PLAST-01",
    "activityName": "Internal Plastering 12mm",
    "outputQty": 250,
    "outputUnitCode": "m2",
    "date": "2026-06-01",
    "items": [
      {
        "resourceId": 4,
        "resourceCode": "MAT-CEM-01",
        "resourceName": "Cement OPC 53",
        "kind": "material",
        "qtyPerUnit": 12.0,
        "totalQty": 3000.0,
        "unitCode": "kg"
      },
      {
        "resourceId": 5,
        "resourceCode": "LAB-MAS-01",
        "resourceName": "Mason",
        "kind": "labour",
        "qtyPerUnit": 0.35,
        "totalQty": 87.5,
        "unitCode": "hr"
      }
    ]
  }
}
```

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 9. Audit Change Log

### 9.1 Get Entity Audit History
* **Method**: `GET`
* **Path**: `/api/catalog/changelog/:entity/:id`
* **Path Params**:
  * `entity` (required enum): `'resource' | 'activity' | 'rate' | 'norm' | 'conversion'`.
  * `id` (required number): Primary key of the entity.
* **Needs / Purpose**: Returns an immutable ledger of every mutation, including user IDs, reasons, and full before/after JSON snapshots.

[⬆ Back to Master API Route Index](#master-api-route-index)

---

## 10. Dev Lab Diagnostic & Test Endpoints

Mounted under `/api/dev/catalog` (behind `requireDevLabClearance` multi-door clearance guard: `NODE_ENV !== 'production'` + `ENABLE_DEV_LAB=true` + `x-dev-lab-clearance` token header).

| Method | Path | Action / Purpose | Link |
|---|---|---|---|
| `POST` | `/api/dev/catalog/units/seed` | Ensures global standard units exist once with `org_id: null` | [10.1](#101-seed-global-standard-units) |
| `POST` | `/api/dev/catalog/units/repair` | One-click self-healing repair from code-authoritative registry | [10.2](#102-repair-system-units-self-healing) |
| `GET` | `/api/dev/catalog/integrity` | Runs the 10 catalog health checks and returns violation details | [10.3](#103-run-integrity-diagnostics) |
| `GET` | `/api/dev/catalog/in-use-simulator` | Lists resource and activity IDs currently held by simulated mock downstream locks | [10.4](#104-get-in-use-simulator-state) |
| `POST` | `/api/dev/catalog/in-use-simulator` | Toggles an in-memory lock on a resource or activity to test downstream `CAT_IN_USE` rejection | [10.5](#105-toggle-in-use-simulator-lock) |
| `POST` | `/api/dev/catalog/run-tests` | Triggers the 40-case automated test suite runner against live MySQL | [10.6](#106-run-automated-test-suite) |

### 10.1 Seed Global Standard Units
* **Method**: `POST`
* **Path**: `/api/dev/catalog/units/seed`
* **Needs / Purpose**: Idempotently seeds predefined standard global units (`kg`, `g`, `m`, `m3`, `hr`, `nos`, etc.) with `org_id: null`. Safe to call repeatedly; skips existing units.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Global units seeded successfully",
    "inserted": 0
  }
}
```

### 10.2 Repair System Units (Self-Healing)
* **Method**: `POST`
* **Path**: `/api/dev/catalog/units/repair`
* **Needs / Purpose**: One-click recovery mechanism. Compares live database rows against the immutable `SYSTEM_UNITS` registry in `catUnitRegistry.js`. Automatically repairs tampered conversion factors, category mismatches, or restores accidentally deleted global system units.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "System units repaired successfully",
    "repairedCount": 0,
    "insertedCount": 0
  }
}
```

### 10.3 Run Integrity Diagnostics
* **Method**: `GET`
* **Path**: `/api/dev/catalog/integrity`
* **Needs / Purpose**: Executes 10 deep automated health checks across all catalog tables:
  1. Base unit consistency (every resource base unit must exist and be accessible).
  2. Effective date overlap detection (zero tolerance for overlapping rate windows).
  3. Master/project scope isolation (no cross-tenant leakage).
  4. Circular conversion graph detection.
  5. Multi-step conversion precision verification.
  6. Rate without resource orphaned check.
  7. Norm line without activity/resource check.
  8. Packaging conversion category verification.
  9. Downstream `CAT_IN_USE` registered reference consistency.
  10. System unit immutability verification (`SYSTEM_UNIT_TAMPERED` / `SYSTEM_UNIT_MISSING`).
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "violations": []
  }
}
```

### 10.4 Get In-Use Simulator State
* **Method**: `GET`
* **Path**: `/api/dev/catalog/in-use-simulator`
* **Needs / Purpose**: Returns the array of resource IDs and activity IDs currently held in the mock downstream in-memory lock simulator (simulating references from POs, Work Orders, or Cost Sheets).
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "lockedResources": [4, 7],
    "lockedActivities": [12]
  }
}
```

### 10.5 Toggle In-Use Simulator Lock
* **Method**: `POST`
* **Path**: `/api/dev/catalog/in-use-simulator`
* **Body**:
  * `entity` (required enum): `'resource' | 'activity'`.
  * `id` (required number): ID of the resource or activity.
  * `inUse` (required boolean): `true` to acquire mock lock, `false` to release.
* **Needs / Purpose**: Simulates downstream system dependencies to rigorously verify that `DELETE /api/catalog/resources/:id` and `DELETE /api/catalog/activities/:id` correctly reject deletions with `400 Bad Request` (`CAT_IN_USE`).
* **Response**: `200 OK`

### 10.6 Run Automated Test Suite
* **Method**: `POST`
* **Path**: `/api/dev/catalog/run-tests`
* **Body**:
  * `caseNum` (required number or string): Specific test case number (e.g. `1` to `40`) or `"all"` to run all 40 scenarios sequentially.
* **Needs / Purpose**: Executes the live database regression test runner directly from the Dev Lab UI, validating all business rules, date logic, conversions, and security locks against the live database.
* **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "total": 40,
    "passed": 40,
    "failed": 0,
    "results": [ ... ]
  }
}
```

---

[⬆ Back to Master API Route Index](#master-api-route-index)

