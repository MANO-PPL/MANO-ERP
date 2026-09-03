---
type: BusinessRule
title: Resource Rate Versioning
resource: res_rates
tags: rates, resources, effective dates, compositions, price impact
timestamp: 2026-08-21
---

# Resource Rate Versioning

`res_rates` stores manual rate versions for resources. Rates are associated with a resource through `resource_id`; project scope is resolved through the resource row rather than a rate `project_id`.

## Key Columns / Fields

- `resource_id`: linked resource.
- `rate`: manual numeric rate.
- `unit_code`: rate unit; must be compatible with the resource base unit.
- `effective_from`: date on which the version becomes effective.
- `effective_to`: closing date for an active version where used by the schema.
- `rate_effective_from`: legacy/conceptual name used in earlier requirements; current service logic uses `effective_from` for rate rows.
- `is_active`: active-rate marker used by service queries.
- `remarks`: explanation for the rate version.

## Business Rules

- An effective manual `res_rates` row overrides a computed composition rate.
- The service selects an effective row whose `effective_from` is not after the requested date and whose active/effective range applies.
- New manual versions must have a non-negative rate and a compatible unit.
- A new version must be later than the latest existing version for the resource.
- Historical rows are preserved so prior effective rates remain explainable.
- For project resources, a project-specific manual rate takes precedence where applicable; project items with their own composition do not incorrectly short-circuit to the master item rate.
- If no effective manual rate exists, composite item rates are calculated recursively from compositions.

## Relationships

`res_rates.resource_id` -> `res_resources.id`. Computed item rates traverse `res_compositions` and component resources, applying unit conversions as needed.

## Agent Constraints

- ALWAYS query by effective date, not simply by greatest row ID.
- NEVER overwrite historical rate versions to represent a new price.
- Confirm the requested unit is compatible before writing a rate.
- Treat manual rates as authoritative over computed rates.
- Price impact analysis must begin from the affected rate/resource and traverse composition dependencies; no backend budget-section persistence was found.
- `deleteResource` deletes all associated `res_rates` as part of intentional resource deletion. Never use `deleteResource` to revise pricing or rate history; invoke it only when the resource itself is intended to be removed.
- `removeProjectResource` deletes project-copy `res_rates` and may also delete unused-child `res_rates`. Treat this as project-resource cleanup, not rate-version editing; do not invoke it merely to alter or remove historical rate versions.
