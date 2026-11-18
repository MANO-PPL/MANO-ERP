# Party Module Technical Audit Report: `proj_parties` & `crm_contacts`

**Date**: November 2026  
**Auditor**: Antigravity AI Engine  
**Target System**: MANO-ERP Backend  
**Objective**: Audit the Party module (`proj_parties` and `crm_contacts`) for architectural and data integrity readiness as a foundational dependency for the new Event Kernel.  
**Mode**: Read-Only Audit (Zero source modifications; zero DDL operations; schema queries and database inspections performed via SELECT only).

---

## Executive Summary

The Party module connects organization-level CRM contacts (`crm_contacts`) with project-level stakeholder memberships (`proj_parties`). The upcoming **Event Kernel** requires a robust, isolated, and strictly typed Party service to record event lines referencing `proj_parties.pv_id`, validate project membership, enforce unlimited supply allocation for suppliers, and prevent negative stock for contractors.

This audit reveals **critical architectural gaps and existing database corruption**:
1. **Surrogate Key Naming & Unstable Identity**: The column `pv_id` does not physically exist on `proj_parties`. The database column is `id` (`INT UNSIGNED AUTO_INCREMENT`), which is aliased to `pv_id` across legacy queries. When a party is removed and re-added to a project, it receives a new `id`, permanently breaking historical lineage.
2. **Orphaned Transaction History in Production/Dev Database**: `txn_transaction_lines.party_id` lacks a foreign key constraint to `proj_parties`. Neither the database nor the application code guards against deleting a party with transaction history. In the dev database, **12 transaction lines are currently orphaned** (referencing deleted party IDs `1` and `3`).
3. **Cross-Project Supply Capacity Blast Radius**: The stock capacity rule ("is this a supplier") is resolved dynamically from `crm_contacts.category` (`ledgerService.js:52-70`). Because `category` lives on the shared CRM contact rather than on the project membership, mutating a contact's category in one project (or via master CRM) silently changes its supply capacity across **all** linked projects.
4. **Missing Kernel Service Surface**: None of the five primary service functions required by the Event Kernel (`getParty`, clean filtered `listProjectParties`, `assertProjectParty`, `isSupplier`, and usage-check deletion guards) exist as standalone contracts.
5. **Cross-Tenant and Cross-Project Security Holes**: Endpoints such as `GET /ledger/project-parties/:projectId` (`ledgerRoutes.js:19`) and `DELETE /projects/:id/parties` (`partyController.js:64-81`) omit organization scoping, allowing cross-tenant reading and deletion. Furthermore, `createTransaction` (`ledgerService.js:100-165`) does not assert that transaction lines reference parties belonging to the transaction's project.

---

## A. Detailed Audit Findings

### 1. Schema Truth

The running database schema was inspected via `INFORMATION_SCHEMA` on the MySQL database (`127.0.0.1:3307`).

#### 1.1 `proj_parties`
Physical table definition from `INFORMATION_SCHEMA.COLUMNS` and `SHOW CREATE TABLE`:
- **Columns**:
  - `id`: `int unsigned NOT NULL AUTO_INCREMENT` (Primary Key)
  - `contact_id`: `int unsigned NOT NULL`
  - `project_id`: `int unsigned NOT NULL`
  - `joined_at`: `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP`
- **Keys & Constraints**:
  - `PRIMARY KEY (id)`
  - `UNIQUE KEY proj_contacts_ids (project_id, contact_id)`: Prevents duplicate associations between the same CRM contact and project.
  - `KEY proj_parties_contact (contact_id)`
  - `KEY idx_proj_parties_project_id (project_id)`
  - `CONSTRAINT proj_parties_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts (id)`: Default `ON DELETE RESTRICT` / `NO ACTION`.
  - `CONSTRAINT proj_parties_project_id FOREIGN KEY (project_id) REFERENCES proj_projects (id)`: Default `ON DELETE RESTRICT` / `NO ACTION`.
- **Observations**:
  - There is **no physical column named `pv_id`** on `proj_parties`.
  - There is **no `org_id` column** on `proj_parties`.
  - There is **no `role` column** on `proj_parties`.
  - There is **no `status` or soft-delete column** (`deleted_at`, `is_active`) on `proj_parties`.

#### 1.2 `crm_contacts`
Physical table definition from `INFORMATION_SCHEMA.COLUMNS` and `SHOW CREATE TABLE`:
- **Columns**:
  - `id`: `int unsigned NOT NULL AUTO_INCREMENT` (Primary Key)
  - `org_id`: `int unsigned NOT NULL`
  - `name`: `varchar(255) NOT NULL`
  - `sector_id`: `int unsigned DEFAULT NULL`
  - `scope`: `enum('master','project') NOT NULL DEFAULT 'master'`
  - `job_nature_id`: `int unsigned DEFAULT NULL`
  - `category`: `enum('Contractor','Supplier','Consultant','Manufacturer','Service Provider','Client','PMC') NOT NULL DEFAULT 'Contractor'`
  - `contact_person`: `varchar(100) DEFAULT NULL`
  - `designation`: `varchar(100) DEFAULT NULL`
  - `telephone_no`: `varchar(100) DEFAULT NULL`
  - `mobile`: `varchar(100) DEFAULT NULL`
  - `email`: `varchar(255) DEFAULT NULL`
  - `address`: `varchar(500) DEFAULT NULL`
  - `location`: `varchar(255) DEFAULT NULL`
  - `website`: `varchar(255) DEFAULT NULL`
  - `gst_no`: `varchar(50) DEFAULT NULL`
  - `constitution`: `varchar(50) DEFAULT NULL`
  - `reference`: `varchar(255) DEFAULT NULL`
  - `responsibility`: `varchar(50) DEFAULT NULL`
  - `remarks`: `varchar(255) DEFAULT NULL`
  - `created_at`: `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP`
  - `updated_at`: `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
- **Keys & Constraints**:
  - `PRIMARY KEY (id)`
  - `KEY fk_desg_id (designation)`
  - `KEY job_nature_id (job_nature_id)`
  - `KEY sector_id (sector_id)`
  - `CONSTRAINT fk_job_nature FOREIGN KEY (job_nature_id) REFERENCES crm_job_nature (id) ON UPDATE CASCADE`
  - `CONSTRAINT fk_sector FOREIGN KEY (sector_id) REFERENCES crm_sectors (id)`
- **Observations**:
  - There is no unique index on `(org_id, name)`. Duplicate contacts with the same name can exist.

#### 1.3 Tables Referencing `proj_parties` and `crm_contacts`

##### Inbound Foreign Keys (Physical Database Constraints):
1. **Referencing `proj_parties`**:
   - `proj_directory.party_id` -> `proj_parties.id` (`CONSTRAINT pdoc_directory_party`). Nullable foreign key without cascading delete.
2. **Referencing `crm_contacts`**:
   - `proj_parties.contact_id` -> `crm_contacts.id` (`CONSTRAINT proj_parties_contact`).
   - `crm_interactions.contact_id` -> `crm_contacts.id` (`CONSTRAINT fk_contact_id`).
   - `pdoc_parties.party_id` -> `crm_contacts.id` (`CONSTRAINT fk_pp_party_ref`). Note: Legacy table, 0 rows.

##### Logical References (NO Foreign Key Constraint in MySQL):
1. `txn_transaction_lines.party_id`:
   - `INT UNSIGNED NOT NULL`.
   - References `proj_parties.id` (documented as `proj_parties.pv_id` in `ledgerService.js:97`).
   - **NO FOREIGN KEY CONSTRAINT EXISTS IN THE DATABASE**.
2. `txn_transactions.responsible_party_id`:
   - `INT UNSIGNED DEFAULT NULL`.
   - Intended to reference a project party (`ledgerService.js:111`).
   - **NO FOREIGN KEY CONSTRAINT EXISTS IN THE DATABASE**. Currently 0 non-null values in the database.
3. Legacy tables:
   - `pdoc_parties`: Table exists with columns `pv_id` (PK), `project_id`, `party_id` (FK to `crm_contacts`), `deleted_at`. Has 0 rows.
   - `pdoc_vendors`: Referenced in old documentation and code comments; **does not exist** in the running database.

---

### 2. Identity

#### 2.1 What `pv_id` Is
- `pv_id` is a legacy identifier name carried over from the superseded `pdoc_parties` / `pdoc_vendors` schema.
- In `proj_parties`, the actual primary key column is `id` (`INT UNSIGNED AUTO_INCREMENT`).
- Application queries explicitly alias `pp.id AS pv_id`:
  - `backend/src/modules/projects/parties/partyService.js:60`: `'pp.id as pv_id'`
  - `backend/src/modules/ledger/ledgerService.js:55`: `'pp.id as pv_id'`
  - `backend/src/modules/ledger/ledgerService.js:379`: `'pp.id as pv_id'`
  - `backend/src/modules/projects/org/orgService.js:41`: `'pp.id as pv_id'`
  - `backend/src/modules/projects/directory/directoryService.js:18`: `'pd.party_id as pv_id'`
- Therefore, in all current business logic and APIs, `pv_id` is identical to `proj_parties.id`.

#### 2.2 Stability of `pv_id`
- **Unstable across project lifecycle**:
  - When a party is removed from a project (via `removePartiesFromProject` at `partyService.js:184-187` or `syncProjectParties` at `partyService.js:219-223`), the row in `proj_parties` is **hard deleted** from MySQL.
  - If the same contact is subsequently re-linked to the project, MySQL `AUTO_INCREMENT` allocates a **brand new `id`**.
  - All previously posted ledger transactions retain the old `party_id` (`pv_id`), which now points to a non-existent record. The re-added party starts with a zero running balance under the new `id`.

#### 2.3 Contact Cardinality Across and Within Projects
- **Can the same contact appear in several projects?**
  - **YES**. `proj_parties` associates `(project_id, contact_id)`. Contacts with `scope = 'master'` are designed to be shared across projects.
  - In the dev database, **4 contacts are linked to multiple projects**:
    - `contact_id: 4598` (Client, "Apollo Hospitals Enterprise Ltd") linked to projects `72, 76` (party IDs `13, 26`).
    - `contact_id: 4602` (Client, "Adani Logistics & Port Infrastructure") linked to projects `1, 3, 72, 75, 80` (party IDs `6, 12, 16, 23, 29`).
    - `contact_id: 4617` (Contractor, "Blue Star Engineering & Electronics") linked to projects `1, 76, 80` (party IDs `24, 32, 44`).
    - `contact_id: 4648` (Supplier, "Astral Limited (Astral Pipes)") linked to projects `1, 76, 80` (party IDs `25, 28, 40`).
- **Can the same contact appear several times in ONE project?**
  - **NO**, as a single database contact. The composite unique index `UNIQUE KEY proj_contacts_ids (project_id, contact_id)` strictly prohibits duplicate rows for the same `(project_id, contact_id)`.
  - However, because `crm_contacts` lacks a unique constraint on company name, multiple separate contact rows for the same real-world company can be created and independently linked to the same project under distinct contact IDs.
- **Can a contact appear under several roles?**
  - `proj_parties` has **no role column**. A party cannot have a role attached to its project membership.
  - `crm_contacts` has only a single enum column `category`. A contact has only one category across the entire database.
  - `txn_transaction_lines` has an unvalidated `role varchar(64)` column (`ledgerService.js:132`), which defaults to `EXECUTOR` or `OWNER`. Currently, all 77 rows in `txn_transaction_lines` have `role = 'EXECUTOR'`.

---

### 3. Roles and Categories

#### 3.1 Values of `category` and Role Columns
1. **`crm_contacts.category`**:
   - Database Enum: `'Contractor'`, `'Supplier'`, `'Consultant'`, `'Manufacturer'`, `'Service Provider'`, `'Client'`, `'PMC'`.
   - Default: `'Contractor'`.
2. **`txn_transaction_lines.role`**:
   - Column: `varchar(64) DEFAULT NULL`.
   - Application Constants (`backend/src/modules/ledger/ledgerValidation.js:16-20`):
     ```javascript
     export const ROLES = {
         OWNER: 'OWNER',
         EXECUTOR: 'EXECUTOR',
         SUPPLIER: 'SUPPLIER',
     };
     ```
   - Current Database State: 100% of existing rows (77/77) contain `'EXECUTOR'`.

#### 3.2 Where Categories and Roles are Set
- **`vendorService.js:159-169`**: Defines `VALID_CATEGORIES` and normalizes input case (`'consultants'` -> `'Consultant'`, fallback `'Contractor'`).
- **`vendorService.js:186, 229`**: Sets `category` on `createVendor` and `updateVendor`.
- **`partyService.js:243, 271, 313`**: On `syncProjectParties`, sets `category: p.category || 'Contractor'`. Crucially, line 288 executes `await trx('crm_contacts').where({ id: contactId }).update(updatePayload)`, **mutating the category globally** on `crm_contacts` during a project-level party sync.
- **`directoryService.js:174, 252, 288`**: Defaults `category` to `'Contractor'`.
- **`agentWriteService.js:11, 62, 373, 708`**: Defaults vendor category to `'Supplier'`.
- **`ledgerService.js:420, 427`**: In `assignSupplyToContractor`, sets `role: ROLES.OWNER` on both outflow and inflow lines.
- **`ledgerService.js:454, 461`**: In `transferBetweenContractors`, sets `role: ROLES.EXECUTOR` on both lines.

#### 3.3 Every Decision Site: "Is this a Supplier?" vs "Is this a Contractor?"

##### Decision Sites for "Is this a Supplier?"
1. **Primary Stock Rule Decision Site (Stock Capacity)**:
   - `backend/src/modules/ledger/ledgerService.js:64-70`:
     ```javascript
     const party = partyMap[line.party_id];
     const category = (party?.category || '').toLowerCase();
     const partyName = party?.name || `Party #${line.party_id}`;

     // Suppliers can issue unlimited supply — skip stock balance enforcement for Suppliers
     if (category.includes('supplier')) {
         continue;
     }
     ```
     **Behavior**: If `c.category` (from `crm_contacts`) contains `'supplier'`, stock balance enforcement is bypassed.
2. **AI Agent Tool Routing & Preconditions**:
   - `backend/src/modules/agent/agentWriteService.js:173-176`: Checks `data.category !== 'Supplier'` when `options.agentSupplierOnly === true`.
   - `backend/src/modules/agent/agentExportService.js:59`: `c.category || 'Supplier'`.
   - `backend/src/modules/knowledge/knowledgeGraphService.js:431`: `category: c.category || (isClient ? 'Client' : 'Supplier')`.

##### Decision Sites for "Is this a Contractor?"
1. **Implicit Stock Rule Decision Site**:
   - `backend/src/modules/ledger/ledgerService.js:72-92`: Any party failing the `category.includes('supplier')` check is treated as a contractor/custodian subject to finite stock validation (`posQuery` sum check).
2. **Vendor vs Client Partitioning in Directory**:
   - `backend/src/modules/vendors/vendorService.js:15-17, 115-116, 216-217, 282-283, 364-365`:
     ```javascript
     this.whereNull('c.category')
         .orWhereRaw('LOWER(??) NOT IN (?, ?)', ['c.category', 'client', 'pmc']);
     ```
     `vendorService` treats all non-client, non-PMC contacts (Contractor, Supplier, Consultant, Manufacturer) as "vendors".
3. **Client Category Partitioning**:
   - `backend/src/modules/clients/clientService.js:45, 163, 244, 309, 334, 411, 508, 552`: Filters strictly by `LOWER(c.category) = 'client'`.
   - `backend/src/modules/projects/core/projectExecutiveService.js:109`: `parties.find(p => String(p.category || '').toLowerCase() === 'client')`.
   - `backend/src/modules/projects/org/orgService.js:54`: `parties.find(p => (p.category || '').toLowerCase() === 'client')`.

---

### 4. Lifecycle & Deletion Behavior

#### 4.1 Deactivation and Status
- Neither `proj_parties` nor `crm_contacts` has a `status`, `is_active`, or `deleted_at` column.
- There is **no soft-delete mechanism**. All deletions are hard `DELETE FROM` statements.

#### 4.2 Removing a Party from a Project
When `DELETE /projects/:id/parties` or `PUT /projects/:id/parties/sync` is invoked:
- `backend/src/modules/projects/parties/partyService.js:177-190`:
  ```javascript
  return await db.transaction(async (trx) => {
      // Safe cascade: delete any proj_directory records referencing these parties first
      await trx('proj_directory')
          .where('project_id', projectId)
          .whereIn('party_id', existingIds)
          .del();

      const deletedCount = await trx('proj_parties')
          .where('project_id', projectId)
          .whereIn('id', existingIds)
          .del();

      return { deletedCount, deletedPvIds: existingIds, notFoundPvIds: notFound };
  });
  ```
- `backend/src/modules/projects/parties/partyService.js:215-223`:
  ```javascript
  await trx('proj_directory')
      .where('project_id', projectId)
      .whereIn('party_id', partyPks)
      .del();
  await trx('proj_parties')
      .where('project_id', projectId)
      .whereIn('id', partyPks)
      .del();
  ```

#### 4.3 Protection Against Orphaned `txn_transaction_lines.party_id`
- **Database Foreign Keys**: **NONE**.
  `txn_transaction_lines` only defines an FK on `transaction_id` referencing `txn_transactions(id) ON DELETE CASCADE`.
- **Application Guards**: **NONE**.
  Neither `partyService.removePartiesFromProject` nor `partyService.syncProjectParties` inspects `txn_transaction_lines` prior to deletion.
- **Direct Consequence**:
  Deleting a party succeeds immediately in MySQL, leaving existing transaction lines with orphaned `party_id` values.
  In the dev database, **12 lines** in `txn_transaction_lines` currently reference non-existent party IDs (`party_id: 1` and `party_id: 3`).

#### 4.4 Deleting a Master Contact (`crm_contacts`)
- When `deleteVendors` (`vendorService.js:278-285`) or `deleteClient` (`clientService.js:319`) is called:
  - If the contact is referenced in `proj_parties`, MySQL blocks the deletion with an uncaught `ER_ROW_IS_REFERENCED_2` error due to constraint `proj_parties_contact`.
  - If the contact is not in `proj_parties`, the contact and its `crm_interactions` are hard deleted.

---

### 5. Scope & Isolation

#### 5.1 Enforcing `org_id` and `project_id` on Reads
1. **`partyService.getProjectParties`** (`partyService.js:50-56`):
   - Accepts `(projectId, fields, orgId, options)`.
   - If `orgId` is provided, it validates `db('proj_projects').where({ id: projectId, org_id: orgId })`. If missing, throws 404.
   - `partyController.listProjectParties` (`partyController.js:14`) correctly passes `req.user.org_id`.
2. **`ledgerService.getProjectParties`** (`ledgerService.js:371-393`) / `ledgerController.getProjectParties` (`ledgerController.js:94-103`):
   - Route: `GET /ledger/project-parties/:projectId` (`ledgerRoutes.js:19`).
   - **VULNERABILITY**: `ledgerController.getProjectParties` does **not** read `req.user.org_id` and does **not** verify that `projectId` belongs to the caller's organization. Any user can dump the full party list of any project in any organization.
3. **`ledgerService.getPartyLedger`** (`ledgerService.js:315-329`):
   - Route: `GET /ledger/party-ledger/:party_id` (`ledgerRoutes.js:15`).
   - `org_id` is an optional filter (`rawOrgId = req.user?.orgId || null`). If omitted, it queries across all organizations.

#### 5.2 Enforcing `org_id` and `project_id` on Writes
1. **`partyController.removeProjectParties`** (`partyController.js:64-81`):
   - Route: `DELETE /projects/:id/parties`.
   - **CRITICAL VULNERABILITY**: `req.user.org_id` is **never passed** to `removePartiesFromProject(projectId, pp_ids)`. Neither the controller nor the service validates that `projectId` belongs to `req.user.org_id`. Any authenticated user can delete project parties from any tenant.
2. **`partyService.syncProjectParties`** (`partyService.js:196-224`):
   - Route: `PUT/POST /projects/:id/parties/sync`.
   - Although `req.user.org_id` is passed into `syncProjectParties`, lines 206-224 delete from `proj_parties` where `project_id = projectId` without verifying that `projectId` belongs to `orgId`.
3. **`ledgerService.createTransaction`** (`ledgerService.js:100-165`):
   - **LOGICAL ISOLATION BREACH**: `verifyProjectResourceMembership` (`ledgerService.js:142`) verifies that resources belong to `header.project_id`. However, there is **zero validation that `line.party_id` belongs to `header.project_id`**.
   - A caller can create a transaction under Project 10 with a `party_id` belonging to Project 20, silently moving inventory across project boundaries.

---

### 6. Service Surface Inventory

| Module & Service File | Function Name | Purpose / What it Does | Used by Ledger? |
|---|---|---|---|
| `partyService.js:27` | `initializeProjectPartiesSchema()` | Boot DDL modifying column `joined_at` and indexes | No |
| `partyService.js:50` | `getProjectParties(projectId, fields, orgId, options)` | Lists parties on a project joined with CRM contact & job nature; attaches directory persons | No (Ledger maintains a duplicate copy) |
| `partyService.js:144` | `getAvailableProjectParties(projectId, orgId, query)` | Fetches CRM contacts eligible to be linked to project | No |
| `partyService.js:155` | `addPartiesToProject(projectId, partyIds, orgId)` | Bulk links existing CRM contacts to project via `clientService.linkContactsToProject` | No |
| `partyService.js:163` | `removePartiesFromProject(projectId, ppIds)` | Hard-deletes `proj_directory` and `proj_parties` rows | No |
| `partyService.js:196` | `syncProjectParties(projectId, payload, orgId)` | Bulk syncs parties: inserts new contacts, updates existing contacts globally, links/unlinks `proj_parties` | No |
| `vendorService.js:6` | `getVendors(orgId, query)` | Paginated master list of vendors (`category NOT IN ('Client', 'PMC')`) | No |
| `vendorService.js:111` | `getVendorById(orgId, id, options)` | Gets single contact with interaction log | No |
| `vendorService.js:138` | `createInteraction(orgId, id, data)` | Logs CRM interaction for a contact | No |
| `vendorService.js:171` | `createVendor(orgId, data, options)` | Inserts new master contact with category normalization | No |
| `vendorService.js:211` | `updateVendor(orgId, id, data, options)` | Updates master contact in `crm_contacts` | No |
| `vendorService.js:269` | `deleteVendors(orgId, ids)` | Deletes interactions and contact | No |
| `vendorService.js:294` | `bulkInsertVendors(orgId, rowsData)` | Bulk inserts vendors from spreadsheet | No |
| `vendorService.js:344` | `bulkValidateVendors(orgId, vendors)` | Validates vendor rows for import | No |
| `clientService.js:698` | `createProjectContact(orgId, projectId, data)` | Inserts contact with `scope='project'` and links to `proj_parties` | No |
| `clientService.js:718` | `linkContactInTransaction(trx, orgId, projectId, contactId)` | Validates project/contact scope and inserts row into `proj_parties` | No |
| `clientService.js:754` | `linkContactsToProject(orgId, projectId, contactIds)` | Wraps `linkContactInTransaction` in a transaction | No |
| `ledgerService.js:44` | `verifyPartyStockSufficiency(trx, projectId, orgId, lines, txnType)` | Private function. Directly queries `proj_parties JOIN crm_contacts` to check `category.includes('supplier')` and enforces positive balance for contractors | **Core Ledger Guard** |
| `ledgerService.js:100` | `createTransaction(txnData, linesData)` | Atomic transaction creation; calls `verifyPartyStockSufficiency` | **Core Ledger Writer** |
| `ledgerService.js:170` | `confirmTransaction(transactionId)` | Validates stock sufficiency and marks confirmed | **Core Ledger Writer** |
| `ledgerService.js:268` | `getPartyResourcePosition(pvId, resourceId, projectId, orgId)` | Queries net confirmed quantity for `l.party_id = pvId` | **Core Ledger Query** |
| `ledgerService.js:315` | `getPartyLedger(pvId, projectId, orgId)` | Queries running ledger passbook for `l.party_id = pvId` | **Core Ledger Query** |
| `ledgerService.js:371` | `getProjectParties(rawProjectId)` | Duplicate party list query used by ledger frontend; returns `pp.id as pv_id` | **Exposed on `/ledger/project-parties/:projectId`** |
| `ledgerService.js:403` | `assignSupplyToContractor(...)` | Creates `SUPPLY_ASSIGN` transaction between parties | **Action Endpoint** |
| `ledgerService.js:437` | `transferBetweenContractors(...)` | Creates `TRANSFER_PARTY` transaction between contractors | **Action Endpoint** |

---

### 7. Tests & Test Coverage

- **Automated Test Script in `package.json:6`**:
  `"test": "echo \"Error: no test specified\" && exit 1"`. There is no global test suite runner configured.
- **Coverage of `proj_parties` and `partyService.js`**: **ZERO**.
  Searching `backend/tests/` and `backend/src/test/` for `proj_parties` or `partyService` yields 0 matches.
- **Coverage of `ledgerService.js`**: **ZERO**.
  There are no unit or integration tests for `verifyPartyStockSufficiency`, `createTransaction`, or `getPartyLedger`.
- **Existing Tests Touching `crm_contacts`**:
  - `backend/tests/agent/persistence.test.js:53-85`: Creates disposable in-memory tables for `crm_contacts` to verify LLM agent write tool isolation and rollback handling.
  - `backend/tests/agent/crmWrites.test.js:1-90`: Tests spreadsheet parsing limits and tool argument validation schemas for `clients.bulkImport`, `clients.create`, and `vendors.update`.
  - `backend/tests/agent/policy.test.js:10-45`: Tests RBAC authorization boundaries for `vendors.create` and `projectParties.list`.
- **Conclusion**: There are **zero behavioral, invariant, or regression tests** verifying party lifecycle, party-project linkage integrity, or ledger stock sufficiency rules.

---

### 8. Dev Database Data Inspection (SELECT-Only)

Queries executed on `MANO-ERP` (Port 3307):

#### 8.1 Parties with No Matching `crm_contact`
```sql
SELECT pp.id, pp.project_id, pp.contact_id
FROM proj_parties pp
LEFT JOIN crm_contacts cc ON pp.contact_id = cc.id
WHERE cc.id IS NULL;
```
- **Result**: `0 rows`. Foreign key constraint `proj_parties_contact` has maintained referential integrity from `proj_parties` to `crm_contacts`.

#### 8.2 Duplicates of the Same Contact in One Project
```sql
SELECT project_id, contact_id, COUNT(*)
FROM proj_parties
GROUP BY project_id, contact_id
HAVING COUNT(*) > 1;
```
- **Result**: `0 rows`. Constraint `proj_contacts_ids UNIQUE (project_id, contact_id)` has prevented duplicate linkage.

#### 8.3 Orphaned Parties in `txn_transaction_lines` (Parties That No Longer Exist)
```sql
SELECT DISTINCT ttl.party_id, COUNT(*) as line_count,
       GROUP_CONCAT(DISTINCT tx.project_id) as project_ids,
       GROUP_CONCAT(DISTINCT tx.id) as txn_ids
FROM txn_transaction_lines ttl
LEFT JOIN txn_transactions tx ON ttl.transaction_id = tx.id
LEFT JOIN proj_parties pp ON ttl.party_id = pp.id
WHERE pp.id IS NULL
GROUP BY ttl.party_id;
```
- **Result**: **12 orphaned lines across 2 distinct missing party IDs**:
  1. `party_id: 1` — **3 lines** in Transaction `32` (Project `87`).
  2. `party_id: 3` — **9 lines** in Transaction `2` (Project `4`).
- **Cause**: Parties `1` and `3` were hard deleted from `proj_parties`. Because `txn_transaction_lines.party_id` has no foreign key constraint, MySQL executed the deletion silently.

#### 8.4 Category Distribution
```sql
SELECT category, COUNT(*) FROM crm_contacts GROUP BY category;
```
- **In `crm_contacts` (Total: 2,529 rows)**:
  - `Contractor`: 1,091 (43.1%)
  - `Supplier`: 821 (32.5%)
  - `Consultant`: 423 (16.7%)
  - `Client`: 149 (5.9%)
  - `Manufacturer`: 42 (1.7%)
  - `PMC`: 3 (0.1%)
  - `Service Provider`: 0 (0.0%)

```sql
SELECT cc.category, COUNT(*) FROM proj_parties pp JOIN crm_contacts cc ON pp.contact_id = cc.id GROUP BY cc.category;
```
- **In `proj_parties` (Total: 43 active project memberships)**:
  - `Client`: 14 (32.6%)
  - `Contractor`: 13 (30.2%)
  - `Supplier`: 8 (18.6%)
  - `PMC`: 3 (7.0%)
  - `Consultant`: 3 (7.0%)
  - `Manufacturer`: 2 (4.7%)

#### 8.5 Contacts Used in Multiple Projects
- **4 contacts** are currently linked across multiple projects:
  - `contact_id: 4598` ("Apollo Hospitals Enterprise Ltd", Client) in projects `72, 76`.
  - `contact_id: 4602` ("Adani Logistics & Port Infrastructure", Client) in projects `1, 3, 72, 75, 80`.
  - `contact_id: 4617` ("Blue Star Engineering & Electronics", Contractor) in projects `1, 76, 80`.
  - `contact_id: 4648` ("Astral Limited (Astral Pipes)", Supplier) in projects `1, 76, 80`.

#### 8.6 Contact Used as Supplier in One Project and Non-Supplier in Another
- **Direct Linkage Check**: None of the 4 multi-project contacts currently has conflicting categories, because category is stored in `crm_contacts` (single value per contact row).
- **Duplicate Contact Rows Check**:
  - In `crm_contacts`, **28 company names** appear multiple times with conflicting categories.
  - Example: Company name `"test"` exists under `contact_id: 4561` as `Contractor` (linked to Project 85 as `party_id: 54`) and under another contact ID as `Client`.
  - Risk: If an administrator creates a new contact for an existing vendor under category `Supplier` to issue initial materials, the vendor will have unlimited supply capacity under one contact ID and restricted contractor capacity under another.

---

## B. Gaps Against What the Event Kernel Needs

The new Event Kernel requires a dedicated, isolated Party service surface. Direct table reads by the kernel are forbidden.

| Required Service Contract | Target Signature & Behavior | Current Status | Analysis & Existing Code Gap |
|---|---|---|---|
| **`getParty(pvId)`** | Returns party object `{ pvId, projectId, contactId, name, category, isSupplier }` for a given `pv_id` | **MISSING** | No function exists to fetch a single party by `pv_id`. `vendorService.getVendorById` takes `contact_id`, not `pv_id`. Existing callers fetch all parties for a project via `getProjectParties` or execute ad-hoc joins. |
| **`listProjectParties(projectId, filter)`** | Returns array of parties for a project, filtered by `category`, `isSupplier`, `search`, etc. | **PARTLY EXISTS** | `partyService.getProjectParties` (`partyService.js:50`) exists, but filtering is rudimentary (only `options.category` when `agentRead: true`). `ledgerService.getProjectParties` (`ledgerService.js:371`) is a duplicate implementation with zero filter support. Neither is designed as an internal kernel provider. |
| **`assertProjectParty(pvId, projectId)`** | Throws 400/404 if `pvId` does not exist or does not belong to `projectId` | **MISSING** | Completely absent. Currently, `ledgerService.createTransaction` accepts any positive integer `party_id` and never asserts that `party_id` belongs to `header.project_id`. |
| **`isSupplier(pvId)`** | Returns boolean: `true` if party has unlimited supply capacity, `false` otherwise | **MISSING** | No standalone function. The logic is currently hardcoded inline inside `ledgerService.js:68` (`category.includes('supplier')`) via an ad-hoc SQL join. |
| **`usageCheckHook(pvId)`** | Guard invoked before party removal; rejects deletion if party has events/lines | **MISSING** | Completely absent. `partyService.removePartiesFromProject` (`partyService.js:184-187`) and `syncProjectParties` (`partyService.js:219-223`) execute unconstrained `del()` queries, causing active ledger corruption. |

---

## C. Risks, Ranked

### [RANK 1] CRITICAL: Hard Deletes of Project Parties Cause Orphaned Ledger History
- **Mechanism**: `removePartiesFromProject` (`partyService.js:184`) and `syncProjectParties` (`partyService.js:219`) execute hard `del()` on `proj_parties`. MySQL allows this because `txn_transaction_lines.party_id` lacks a foreign key constraint.
- **Impact**: All historical transaction lines lose their party identity. The running balance ledger (`getPartyLedger`) fails or reports missing party names (`Party #<id>`).
- **Evidence**: Live dev database contains **12 orphaned transaction lines** referencing deleted parties `1` and `3`.

### [RANK 2] CRITICAL: Shared CRM Category Mutates Stock Capacity Globally Across Projects
- **Mechanism**: Stock capacity is derived from `crm_contacts.category` (`ledgerService.js:53, 68`).
- **Impact**: When a contact is linked to multiple projects (e.g. Adani, Blue Star, Astral), changing its category from `Contractor` to `Supplier` in one project (via `syncProjectParties`, line 288) or via master vendor edit (`vendorService.js:265`) instantly grants that contact **unlimited allocation capacity across all other projects**. Conversely, changing a Supplier to Contractor immediately freezes outbound supply movements with "Insufficient stock" errors.

### [RANK 3] HIGH: Cross-Project Party Contamination in Transactions
- **Mechanism**: `ledgerService.createTransaction` (`ledgerService.js:146`) verifies project resource membership, but **never verifies party membership** (`line.party_id` belonging to `header.project_id`).
- **Impact**: A transaction in Project A can post debit or credit entries against a `party_id` belonging to Project B. This silently corrupts the net stock balances of contractors in unrelated projects.

### [RANK 4] HIGH: Identity Discontinuity on Party Re-Admission
- **Mechanism**: `pv_id` is an `AUTO_INCREMENT` surrogate key on `proj_parties`.
- **Impact**: If a contractor is temporarily removed from a project and later re-added, it receives a new `id`. The contractor's previous on-site inventory cannot be transferred or consumed under the new ID because historical lines remain tied to the deleted `id`.

### [RANK 5] MEDIUM: String Substring Matching for Supplier Determination
- **Mechanism**: `ledgerService.js:68` uses `category.toLowerCase().includes('supplier')`.
- **Impact**:
  - `Manufacturer` contacts (42 rows in CRM, 2 active in projects) are **not** matched by `.includes('supplier')` and are treated as contractors subject to strict non-negative balance checks, preventing direct supply issuance.
  - Any future category containing "supplier" (e.g. "Ex-Supplier", "Supplier-Blacklisted") would be granted unlimited supply capacity.

### [RANK 6] MEDIUM: Cross-Tenant Information Disclosure & Unauthenticated Deletion
- **Mechanism**:
  - `ledgerRoutes.js:19`: `GET /ledger/project-parties/:projectId` performs zero organization check.
  - `partyController.js:64-81`: `DELETE /projects/:id/parties` does not pass `req.user.org_id`.
- **Impact**: An authenticated user in Tenant A can read parties and delete party associations belonging to Tenant B.

---

## D. Recommendation: Where "Supplier" Should Live

### Option Analysis

#### Option 1: Retain in `crm_contacts.category` (Status Quo / Minimal Schema Change)
- **Concept**: Continue deriving supplier status from the master contact record.
- **Smallest Change**: Requires zero DDL.
- **Fatal Flaws**:
  - **Shared Contact Blast Radius**: A corporate entity cannot act as a material supplier on Project A and an execution trade contractor on Project B.
  - **Global Mutation**: Modifying category during project party sync mutates the master CRM directory for all users.

#### Option 2: Add `role` / `is_supplier` to `proj_parties` (Recommended)
- **Concept**: Add a column to `proj_parties` representing project-level engagement:
  - `is_supplier`: `tinyint(1) NOT NULL DEFAULT 0` (or `role enum('SUPPLIER', 'CONTRACTOR', 'CLIENT') NOT NULL DEFAULT 'CONTRACTOR'`).
  - When linking a contact to a project, initialize `is_supplier` based on `crm_contacts.category = 'Supplier'`.
  - Allow project managers to toggle `is_supplier` per project without touching master CRM.
- **Affected Existing Code**:
  1. `backend/src/modules/projects/parties/partyService.js`:
     - Update `getProjectParties` (lines 58-65) to select `pp.is_supplier`.
     - Update `syncProjectParties` (lines 283-299) to stop mutating `crm_contacts.category` and instead update `proj_parties.is_supplier`.
  2. `backend/src/modules/ledger/ledgerService.js`:
     - Update `verifyPartyStockSufficiency` (lines 52-68) to inspect `pp.is_supplier` instead of `c.category.includes('supplier')`.
  3. Frontend: Project party table / directory to display and toggle role on the project.
- **Why this is optimal**: Decouples enterprise master CRM data from project site operational rules. Provides the exact boolean required by `isSupplier(pvId)`.

#### Option 3: Derive from Line Role (`txn_transaction_lines.role`)
- **Concept**: Allow lines with `role = 'SUPPLIER'` to have unlimited supply capacity.
- **Fatal Flaws**: Completely unworkable. Anyone submitting an outflow transaction could bypass stock balance checks by tagging their line as `'SUPPLIER'`. Stock capacity is an attribute of the party's contract on the project, not a per-transaction claim.

### Recommended Transition Strategy
1. **Immediate Service Layer Encapsulation (Zero Schema Change)**:
   Create a dedicated thin service `partyKernelService.js` that exposes `isSupplier(pvId)` querying `crm_contacts.category = 'Supplier'` through an internal join. This isolates the kernel from raw SQL and table structures.
2. **Planned Schema Migration**:
   Introduce `proj_parties.is_supplier` in the next scheduled DDL migration, backfilling it from `crm_contacts.category = 'Supplier'`. Update `partyKernelService.isSupplier` to read directly from `proj_parties.is_supplier`.

---

## E. Questions Unanswered from Code

1. **Multi-Role Vendor Business Policy**: Does business policy permit a single vendor to act as both a material supplier and a trade contractor on the same project simultaneously? If yes, should they hold two distinct `proj_parties` entries (requiring removal of `UNIQUE (project_id, contact_id)`), or one party entry with dynamic per-resource roles?
2. **Operational Role of `Manufacturer`**: In live operations, do `Manufacturer` contacts issue raw material supply directly (e.g. RMC concrete delivery from ACC), or do they only supply through distributor intermediaries? If they supply directly, why are they excluded from supplier status in `ledgerService.js:68`?
3. **Reconciliation of Orphaned Lines**: For the 12 existing orphaned lines in `txn_transaction_lines` (Transactions 2 and 32), what were the historical company identities of parties `1` and `3`, and should they be restored or reconciled before event kernel ledger initialization?
4. **Original Intent for Soft Deletes**: Why was the `deleted_at` column present in legacy `pdoc_parties` dropped when `proj_parties` was created? Was hard deletion an intentional design choice, or should soft deletion (`deleted_at`) be reintroduced to prevent breaking transaction references?
