---
type: BusinessRule
title: Resource Price Impact Tracing
resource: res_rates -> res_compositions -> res_resources
tags: impact tracing, rates, compositions, budgets, resources
timestamp: 2026-08-21
---

# Resource Price Impact Tracing

A rate change can affect a composite item when that item includes the changed resource through `res_compositions`. The confirmed backend traversal ends at resource and composition data.

## Confirmed Traversal

1. Start with an effective row in `res_rates` identified by `resource_id`.
2. Find composition rows in `res_compositions` whose component column points to that resource.
3. Resolve each parent item through the runtime-selected parent column (`item_id` or `parent_resource_id`).
4. Repeat upward through parent items, respecting `effective_from` and `effective_to`.
5. Recalculate affected item rates using quantities, component rates, and unit conversions.

Project-scoped resources are copied rows in `res_resources` with `project_id` set. Project compositions and rates reference the copied resource IDs.

## Budget Boundary

`frontend/src/pages/ProjectDetails/Contracts/Budget/budgetData.js` contains hardcoded `BUDGET_SECTIONS` seed data. The backend exposes an AI analysis endpoint that accepts `budgetData` in a request, but no backend budget-section table, persistence service, or resource-to-budget foreign key was found.

Therefore, confirmed backend price tracing stops at `res_rates`, `res_compositions`, and `res_resources`. A traversal into project budget sections cannot be claimed from current backend evidence.

## Agent Constraints

- ALWAYS use effective dates when calculating impact.
- Include both master and project-scoped resource rows where the affected resource is copied into a project.
- Do not invent a budget table, budget foreign key, or resource-to-budget relationship.
- Label any frontend budget-section correlation as a separate UI-data association, not a persisted backend relationship.
- `_forceReplaceCompositions`, `bulkUpdateResources`, and `updateResource` can delete or replace `res_compositions`; preserve impact-tracing effective dates and distinguish master resources from project copies.
- `deleteResource` deletes `res_compositions`, `res_rates`, and `res_resources`; verify the resource and preserve organization scope. Do not infer a budget-table relationship.
- `removeProjectResource` deletes project-copy `res_compositions`, `res_rates`, `res_conversions`, and `res_resources`; unused-child cleanup is limited to `res_rates`, `res_conversions`, and `res_resources`; no child `res_compositions` deletion is present.
