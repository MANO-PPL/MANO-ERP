# Party Registry Module (`partyRegistry`)

A thin, isolated, kernel-facing Party registry service designed as a direct foundational dependency for the **Event Kernel**.

---

## 1. Architectural Role & Separation Rules

The Event Kernel records event lines referencing `party_id` (which points to `proj_parties.id`, historically known as `pv_id`). To enforce stock balance invariants (suppliers have unlimited capacity; contractors cannot go below zero), the kernel requires strict, fast, and secure party resolution without coupling to legacy services or frontend CRUD controllers.

### Strict Boundaries
- **No Legacy Imports**: `partyRegistryService.js` does **not** import `partyService`, `vendorService`, or `ledgerService`.
- **Own Queries**: Executes its own parameterized Knex queries joining `proj_parties`, `proj_projects`, and `crm_contacts`.
- **Zero Schema Startup Code**: Fully compliant with repository safety rules. No DDL is executed on server boot.
- **Minimal Mutation**: The service only ever updates `proj_parties.supplier_override`. It never creates, deletes, or modifies party or contact records.

---

## 2. Guarantees Provided to the Event Kernel

1. **Multi-Tenant Organization Enforcement**:
   All methods accept `orgId` as their first parameter. Every query enforces `proj_projects.org_id = orgId` AND `crm_contacts.org_id = orgId`.
2. **Zero Information Leakage**:
   Querying an unknown party ID or a party belonging to another organization produces an identical error:
   `PARTY_NOT_FOUND` with message `Party <id> not found`.
3. **Project Boundary Protection**:
   `assertProjectParty(orgId, pvId, projectId)` guarantees that `pvId` exists within `orgId` and is bound specifically to `projectId`. Passing a party from another project throws `PARTY_NOT_IN_PROJECT`.
4. **Batch Line Validation**:
   `getPartiesByIds(orgId, projectId, pvIds[])` validates all line parties in a single database round-trip. If any ID is missing or belongs to another project, it throws an error naming every offending ID.
5. **Project-Scoped Supplier Overrides**:
   A party's supply capacity can be overridden per project without touching master CRM contacts:
   - `supplier_override = 1`: Supplier on this project (unlimited capacity).
   - `supplier_override = 0`: Contractor on this project (finite stock tracking).
   - `supplier_override = NULL`: Falls back to `SUPPLIER_CATEGORIES.includes(category)` using exact string comparison.
   - `SUPPLIER_CATEGORIES` is exported as `['Supplier']`. Substrings like `'Ex-Supplier'` are strictly rejected.

---

## 3. Service API Specification

```javascript
import * as partyRegistry from './partyRegistryService.js';
```

### `getParty(orgId, pvId)`
Retrieves full party record for a single project party.
- **Returns**:
  ```typescript
  {
    pvId: number;
    projectId: number;
    contactId: number;
    name: string;
    category: string;
    isSupplier: boolean;
    supplierSource: 'override' | 'category';
  }
  ```
- **Throws**: `PartyRegistryError` (`PARTY_NOT_FOUND`) if party is missing or belongs to another org.

### `getPartiesByIds(orgId, projectId, pvIds[])`
Batch fetches and validates a list of party IDs for a single project.
- **Returns**: `Map<number, PartyObject>` keyed by `pvId`.
- **Throws**:
  - `PARTY_NOT_IN_PROJECT`: If one or more parties belong to another project.
  - `PARTY_NOT_FOUND`: If one or more parties do not exist.
  - The error message explicitly names every invalid ID (e.g. `missing [999998]; wrong project [42]`).

### `listProjectParties(orgId, projectId, filters)`
Lists all parties for a given project.
- **Filters**: `{ category?: string, isSupplier?: boolean, search?: string }`
- **Returns**: `Array<PartyObject>` sorted by contact name.
- **Throws**: `PARTY_NOT_FOUND` if `projectId` does not exist in `orgId`.

### `assertProjectParty(orgId, pvId, projectId)`
Guards a single party reference.
- **Returns**: `PartyObject` if valid.
- **Throws**:
  - `PARTY_NOT_FOUND` if missing or wrong org.
  - `PARTY_NOT_IN_PROJECT` if party belongs to a different project.

### `isSupplier(orgId, pvId)`
Returns boolean indicating whether the party has unlimited supply capacity.
- **Returns**: `true` | `false`
- **Throws**: `PARTY_NOT_FOUND` if missing or wrong org.

### `setSupplierOverride(orgId, pvId, value, { userId }?)`
Sets or resets project-specific supplier override.
- **Value**: Must be strictly `true`, `false`, or `null`.
- **Returns**: Updated `PartyObject`.
- **Throws**:
  - `PARTY_INVALID_VALUE` if value is not `true`, `false`, or `null`.
  - `PARTY_NOT_FOUND` if party is missing or wrong org.

---

## 4. How the Event Kernel Calls This Service

### 4.1 Validating All Transaction Lines at Ingestion
```javascript
import { getPartiesByIds } from '../partyRegistry/partyRegistryService.js';

export async function processEventBatch(orgId, projectId, lines) {
    const partyIds = lines.map(line => line.party_id);
    
    // Validates tenant isolation, project boundaries, and existence in one query
    const partyMap = await getPartiesByIds(orgId, projectId, partyIds);
    
    for (const line of lines) {
        const party = partyMap.get(line.party_id);
        
        // Stock rule check:
        if (line.signed_qty < 0 && !party.isSupplier) {
            await enforceAvailableStock(orgId, projectId, party.pvId, line.resource_id, line.signed_qty);
        }
    }
}
```

### 4.2 Single Party Custody Assertion
```javascript
import { assertProjectParty } from '../partyRegistry/partyRegistryService.js';

export async function recordCustodyTransfer(orgId, projectId, fromPartyId, toPartyId) {
    const fromParty = await assertProjectParty(orgId, fromPartyId, projectId);
    const toParty = await assertProjectParty(orgId, toPartyId, projectId);
    // Proceed with verified project-scoped parties...
}
```

---

## 5. Database Migration & Running Tests

### Applying the Additive DDL Migration
The DDL script adds the nullable column `supplier_override` to `proj_parties`:

```bash
# Apply UP migration (using MySQL CLI or DBeaver / Workbench):
mysql -h 127.0.0.1 -P 3307 -u dev_admin -p "MANO-ERP" < backend/src/db/sql/003_party_supplier_override.sql

# To rollback (DOWN migration):
mysql -h 127.0.0.1 -P 3307 -u dev_admin -p "MANO-ERP" < backend/src/db/sql/003_party_supplier_override_down.sql
```

### Running the Test Suite
The test suite executes 14 comprehensive test cases on real MySQL using dedicated test organizations (`9981`, `9982`):

```bash
node backend/src/modules/partyRegistry/partyRegistryTests.js
```

To run a specific test case (e.g. Case 8):
```bash
node backend/src/modules/partyRegistry/partyRegistryTests.js --case=8
```
