---
type: Relationship
title: Vendor Project Relationships
resource: pdoc_parties
tags: vendors, projects, pdoc_parties, crm_contacts, recommender
timestamp: 2026-08-21
---

# Vendor Project Relationships

`pdoc_parties` is the project-party join table. It connects a project to a CRM contact and supports vendors and clients through the shared contact table.

## Key Columns / Fields

- `pv_id`: relationship identifier.
- `project_id`: linked `proj_projects.id`.
- `party_id`: linked `crm_contacts.id`.

A unique index prevents duplicate project/contact links.

## Business Rules

- Adding a party creates a project association; it does not create a new contact.
- Removing a party removes the association, not necessarily the CRM contact.
- Party lists join `crm_contacts` to return contact name and category.
- The service abstracts legacy `pdoc_vendors` data automatically; always query through the service layer, not directly against table names, to avoid legacy/current schema mismatches.

## Relationships

`proj_projects` 1-to-many `pdoc_parties` many-to-1 `crm_contacts`.

## Agent Constraints

- ALWAYS resolve the contact through `party_id` and verify organization/project scope.
- Do not assume every party is a vendor; inspect `crm_contacts.category`.
- Exclude `PMC` when the agent is specifically producing vendor/client results unless the user explicitly requests PMC.
- Confirm before removing a party from an active project because the operation changes project participation data.
- `batchSaveClients` deletes `crm_contacts` only. `deleteClient` verifies client identity before deleting its interactions and contact. `deleteClients` removes `crm_interactions` for all supplied organization-scoped IDs before filtering the `crm_contacts` delete to clients; resolve project-party relationships and validate every bulk ID before removal.
- `deleteVendors` deletes `crm_interactions` for all supplied organization-scoped contact IDs before deleting eligible `crm_contacts`. Because client/PMC category exclusion applies only to contact deletion, resolve each supplied ID as the intended vendor contact before removal.
- `removePartiesFromProject` deletes scoped `pdoc_parties`, and `syncProjectParties` deletes `pdoc_parties` for submitted removals; verify project/party association and confirm active-project removal.

## Recommender Ranking Rules

[STATED] Vendor recommendation requires an exact `job_nature` match as a hard filter - vendors whose `job_nature_id` does not match the requested job nature must never appear in results.

[STATED] Job nature matching requires resolving the manager's supplied
name to a job_nature_id via the crm_job_nature table before filtering  — do not compare a name string directly against job_nature_id.

[STATED] Rank vendors by the following signals in order:
1. Project appearances: count of distinct `project_id` values in `pdoc_parties` for this contact - higher count ranks higher.
2. Interaction recency: date of most recent `crm_interactions` row for this contact - more recent ranks higher.
3. Follow-up compliance: ratio of `follow_up_date` values that have a subsequent interaction row within 7 days - higher ratio ranks higher.
4. Location match: vendor `location` field matches the project `location` - match ranks above no match.

[STATED] A vendor with an open overdue follow-up (as defined in `interactions/index.md`) should be flagged in results but not excluded - the manager decides whether to proceed.

[STATED] Recommend a maximum of 5 vendors per request unless the manager asks for more.
