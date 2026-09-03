---
type: Table
title: Resources
resource: res_resources
tags: resources, materials, labour, items, units, project resources
timestamp: 2026-08-21
---

# Resources

Resources represent materials, labour, and composite items used by inventory and project operations. Master resources and project-scoped resources are rows in `res_resources`.

## Key Columns / Fields

- `id`: resource identifier.
- `org_id`: organization boundary.
- `name`: resource name.
- `type`: exactly `material`, `item`, or `labour` in service validation.
- `base_unit_code`: canonical unit for rates, quantities, and conversions.
- `project_id`: NULL for master scope and populated for project copies.
- `parent_id`: optional resource hierarchy link.

No repository evidence supports a `plant` type. It is an unsupported domain assumption, not a MANO ERP value.

## Business Rules

- Only `item` resources may have compositions.
- Materials and labour resolve directly as base resources.
- Project scope is represented by copying a resource row into `res_resources` with `project_id` set.
- Project-resource deletion removes dependent compositions, rates, conversions, and the copied resource where applicable.
- Unit changes must remain within the same measurement category.

## Relationships

- `res_rates.resource_id` references the resource whose manual rate is stored.
- `res_compositions` links item parents to component resources.
- `res_conversions.resource_id` stores resource-specific conversion data.
- `res_resources.project_id` links project copies to `proj_projects`.

## Agent Constraints

- ALWAYS validate `type` against `material`, `item`, and `labour`.
- NEVER create or assume `plant`.
- ALWAYS use `base_unit_code` as the unit compatibility anchor.
- Do not directly edit project copies when the operation requires importing or ensuring a project resource.
- `_forceReplaceCompositions`, `bulkUpdateResources`, and `updateResource` delete or replace `res_compositions`; enforce material/item/labour compatibility, composition ownership, cycle prevention, and project-copy boundaries.
- `_replaceConversions` deletes and replaces `res_conversions`, while `removeConversion` deletes a verified `res_conversions` row; retain target verification and resource scope.
- `deleteResource` deletes `res_compositions`, `res_conversions`, `res_rates`, and `res_resources`; all four deletions must remain verified and organization/resource scoped.
- `removeProjectResource` deletes project-copy `res_compositions`, `res_conversions`, `res_rates`, and `res_resources`; unused-child cleanup is limited to `res_rates`, `res_conversions`, and `res_resources`; no child `res_compositions` deletion is claimed.
