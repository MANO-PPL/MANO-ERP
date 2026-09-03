---
type: Table
title: Resource Compositions
resource: res_compositions
tags: compositions, items, resources, cycle detection, versioning
timestamp: 2026-08-21
---

# Resource Compositions

`res_compositions` stores item recipes: a parent item is made from component resources with quantities and units. Only resources of type `item` may own compositions.

## Key Columns / Fields

- Parent column: current runtime schema may use `item_id` or `parent_resource_id`.
- Component column: current runtime schema may use `component_id` or `component_resource_id`.
- `quantity`: required component quantity.
- `unit_code`: unit in which the component quantity is expressed.
- `effective_from`: beginning of a composition version.
- `effective_to`: optional end of a composition version.
- `is_active`: active-version marker where present.

## Compatibility Rule

`backend/src/services/compositionResolver.js`, `getCompositionColumns()`, checks the database at runtime. It prefers `item_id`/`component_id`; if those are absent, it uses `parent_resource_id`/`component_resource_id`. `resourceService.js` and `projectResourceService.js` use these resolved aliases for queries and writes.

This is implemented legacy/current schema compatibility, not an inferred relationship.

## Business Rules

- A composition row requires a component resource, quantity, and unit code.
- Duplicate components in one composition version are rejected.
- Component unit category must match the component resource base unit category.
- Effective-date filters determine which composition rows apply to a requested date.
- Saving a composition calls `detectCycle()` before insertion.

## Cycle Protection

`detectCycle(parentId, componentId, dbClient, asOfDate, visited)` detects direct self-reference, revisited component IDs, and recursive paths that reach the proposed parent. When `asOfDate` is supplied, it filters rows by `effective_from <= asOfDate` and `effective_to` NULL or at least the date.

A cycle would make recursive rate resolution non-terminating or mathematically invalid, so composition saves must reject one.

## Relationships

Parent and component IDs both resolve to `res_resources.id`. Computed rates walk from an item through its component rows and component resources.

## Agent Constraints

- ALWAYS run cycle validation before saving or replacing item compositions.
- NEVER assume only one pair of column names exists; use the runtime compatibility behavior.
- NEVER attach a composition to a material or labour resource.
- Preserve effective-date boundaries when analyzing historical or future rates.
- Component resources may be of type `material`, `labour`, or `item`;
  only `item` types may own their own compositions.
- `_forceReplaceCompositions`, `bulkUpdateResources`, and `updateResource` can delete or replace `res_compositions`; enforce composition ownership/type compatibility, cycle prevention, and effective-date boundaries before replacement or type transition.
- `deleteResource` deletes resource-owned `res_compositions` and `res_resources`; verify the resource and keep both deletions organization/resource scoped.
- `removeProjectResource` deletes project-copy `res_compositions` and `res_resources`; its unused-child branch separately deletes child `res_rates`, `res_conversions`, and `res_resources`. No child `res_compositions` deletion is performed.
