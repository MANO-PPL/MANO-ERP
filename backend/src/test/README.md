# Backend Development Test Scripts (`backend/src/test`)

This directory houses **standalone integration test runners, developer harness scripts, and seeders** used during active feature development in MANO-ERP.

---

## 1. Directory Purpose & Structure

Unlike `backend/tests/` (which hosts automated, mocked unit tests run in CI/CD via `node:test`), this directory contains **executable integration scripts** that run directly against a live or local development database.

| Directory | Purpose | Execution | Target |
|---|---|---|---|
| **`backend/src/test/`** | Integration harnesses & manual feature verification scripts | `node backend/src/test/<script>.js` | Live DB / Dev Services |
| **`backend/tests/`** | Automated unit tests for CI/CD pipelines | `node --test tests/**/*.test.js` | Mocked / Bounded Services |

---

## 2. File Inventory & Usage

### 1. Module Test Suites (Co-located by Feature)
* **`backend/src/modules/locations/locationTests.js`**: Full 25-case integration test suite verifying all invariants of **Module 1 (Location Spec)**.
  - **Coverage**: Root creation, child nesting, materialized paths (`/1/5/`), cycle detection, sibling uniqueness, atomic subtree moves, max depth constraint (8), delete protection hooks, and path self-healing.
  - **Usage**:
    ```bash
    # Run all 25 test cases
    node backend/src/modules/locations/locationTests.js

    # Run an individual test case (e.g. Case 15)
    node backend/src/modules/locations/locationTests.js 15
    ```
  - *(Integrated into the `/dev/location-lab` UI with full suite and per-case execution).*

---

### 2. `foundationTests.js`
* **Purpose**: Verifies Phase 0 foundational backend services and database schema.
* **Coverage**:
  - `wf_document_lines` and `wf_document_attachments` table existence.
  - Event Bus payload versioning and event pub/sub mechanism (`eventBus.js`).
  - Approval hook registration and execution pipeline (`hookRegistry.js`).
* **Usage**:
  ```bash
  node backend/src/test/foundationTests.js
  ```

---

### 3. `runTests.js`
* **Purpose**: Unit test runner for unit of measurement (UOM) conversions and resource recipe composition resolution.
* **Coverage**:
  - `unitRegistry.js`: Weight, length, area, volume conversions (e.g. `kg` $\leftrightarrow$ `MT`, `ft` $\leftrightarrow$ `in`).
  - `compositionResolver.js`: Multi-level recipe graph resolution and circular composition cycle detection.
* **Usage**:
  ```bash
  node backend/src/test/runTests.js
  ```

---

### 4. `bulkImporter.js` & `lemonade.json`
* **Purpose**: Test script and JSON fixture for dynamic recipe bulk imports into inventory tables (`res_resources`).
* **Coverage**: Parses raw ingredients, labor items, and composite items, cleans previous test codes, and performs bulk upserts.
* **Usage**:
  ```bash
  node backend/src/test/bulkImporter.js [path/to/recipe.json]
  # Default: node backend/src/test/bulkImporter.js src/test/lemonade.json
  ```

