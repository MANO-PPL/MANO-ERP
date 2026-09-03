---
type: Module
title: MANO ERP Knowledge Index
resource: MANO ERP
tags: architecture, vendors, clients, resources, rates, compositions, interactions, projects
timestamp: 2026-08-21
---

# MANO ERP Knowledge Index

MANO ERP is an Express and Knex backend using MySQL. This bundle gives AI features operational knowledge about CRM contacts, projects, resources, rates, compositions, and interactions.

## In Scope

- Vendors and clients share `crm_contacts`, but their services apply different category rules.
- Project parties connect CRM contacts to projects through `pdoc_parties`.
- Resources are stored in `res_resources`; rates and compositions are separate dependent records.
- Interactions are stored in `crm_interactions`.
- Projects are stored in `proj_projects` and membership is stored in `proj_members`.

## ERP Knowledge Graph

### 1. Entity Tree

CRM Layer
├── `crm_contacts`
│   ├── `id` (contact identity used by all contact-level actions)
│   ├── `org_id` (hard tenant boundary for reads and writes)
│   ├── `category` (vendor/client/PMC classification used in filters)
│   ├── `job_nature_id` (job-type matching key for recommendations)
│   ├── `sector_id` (classification key resolved during vendor creation)
│   ├── `sector_id` → resolves to `crm_sectors.id`
│   ├── `job_nature_id` → resolves to `crm_job_nature.id`
│   ├── `location` (location-match signal for ranking)
│   └── child: `crm_interactions` via `crm_interactions.contact_id -> crm_contacts.id`
│       ├── `type` (interaction channel)
│       ├── `interaction_date` (latest-touch and recency signal)
│       ├── `follow_up_date` (schedule for follow-up compliance/overdue)
│       └── `remarks` (operator context)

Project Layer
├── `proj_projects`
│   ├── `id` (project identity)
│   ├── `org_id` (tenant boundary)
│   ├── `name` (project label for agent output)
│   ├── `location` (ranking signal input for vendor location match)
│   └── `status` (application-level status string; default `active`)
├── child: `proj_members` via `proj_members.project_id -> proj_projects.id`
│   ├── `project_id` (project membership link)
│   ├── `user_id` (member identity)
│   └── `permission_level` (action gate such as `view`/`edit`)
└── child: `pdoc_parties` via `pdoc_parties.project_id -> proj_projects.id`
		├── `pv_id` (project-party link identity)
		├── `project_id` (project side of association)
		└── `party_id` (contact side of association; links to `crm_contacts.id`)

Resource Layer
├── `res_resources`
│   ├── `id` (resource identity)
│   ├── `org_id` (tenant boundary)
│   ├── `type` (`material`/`item`/`labour` behavior switch)
│   ├── `base_unit_code` (unit compatibility anchor)
│   ├── `project_id` (NULL master vs project-scoped copy)
│   └── `parent_id` (optional hierarchy reference)
├── child: `res_rates` via `res_rates.resource_id -> res_resources.id`
│   ├── `resource_id` (rated resource)
│   ├── `rate` (manual rate value)
│   ├── `unit_code` (rate unit)
│   ├── `effective_from` (version start)
│   ├── `effective_to` (version end when closed)
│   ├── `is_active` (active version marker)
│   └── `remarks` (rate rationale)
├── child: `res_compositions` via parent/item column -> `res_resources.id`
│   ├── parent key (runtime compatible: `item_id` or `parent_resource_id`)
│   ├── component key (runtime compatible: `component_id` or `component_resource_id`)
│   ├── `quantity` (component quantity in parent recipe)
│   ├── `unit_code` (recipe unit for quantity)
│   ├── `effective_from` (composition version start)
│   ├── `effective_to` (composition version end)
│   └── `is_active` (active version marker)
└── child: `res_conversions` via `res_conversions.resource_id -> res_resources.id`
		├── `resource_id` (resource with conversion rule)
		├── `from_unit_id` (source unit)
		├── `to_unit_id` (target unit)
		└── `factor` (conversion multiplier)

### 2. Cross-Module Link Map

`crm_contacts.id`
    |
    | (crm_interactions.contact_id -> crm_contacts.id)
    +--> `crm_interactions`
	|
	| (`pdoc_parties.party_id -> crm_contacts.id`)
	v
`pdoc_parties.project_id` ---> `proj_projects.id`
																	|
																	| (`res_resources.project_id -> proj_projects.id`)
																	v
													 `res_resources.id`
																	|
																	| (`res_rates.resource_id -> res_resources.id`)
																	+--> `res_rates`
																	|
																	| (parent/component refs -> `res_resources.id`)
																	+--> `res_compositions`
																	|
																	| (`res_conversions.resource_id -> res_resources.id`)
																	+--> `res_conversions`

Budget boundary: `res_resources` (project copies) is where confirmed backend tracing ends - no backend budget table exists.

### 3. Agent Action Chains

- Vendor creation
	1. Resolve sector name and job nature name to IDs using the shared CRM lookup flow for `sector_id` and `job_nature_id`.
	2. Normalize and validate category.
	3. Write one row in `crm_contacts` with resolved IDs and normalized category.

- Vendor recommendation
	1. Resolve requested job nature name to `job_nature_id`.
	2. Filter `crm_contacts` with exact `job_nature_id` match (hard filter).
	3. Count distinct `project_id` associations from `pdoc_parties` for each contact.
	4. Pull latest `interaction_date` from `crm_interactions` for recency scoring.
	5. Compute follow-up compliance from `follow_up_date` and subsequent interaction timing.
	6. Apply project-location match using contact and project location.
	7. Rank by the stated order and cap output at 5 unless manager asks for more.

- Rate impact trace
	1. Start at effective manual rate rows in `res_rates`.
	2. Walk upward through `res_compositions` where the changed resource appears as a component.
	3. Resolve affected parent items in `res_resources` and recurse upward.
	4. Include project-scoped copies in `res_resources` using `project_id` context.
	5. Stop at the resource layer boundary; do not continue into non-existent backend budget tables.

- Interaction logging
	1. Write a new row in `crm_interactions` for the target `contact_id`.
	2. Set `interaction_date`, optional `follow_up_date`, and metadata.
	3. Overdue status for that contact is cleared by the presence of a newer interaction row under the stated rule.

- Party removal
	1. Read `proj_projects` to check if the project status is active.
	   If active, stop and request explicit manager confirmation before
	   proceeding — do not assume "checking" the status is the same as
	   getting manager approval.
	2. Delete only the `pdoc_parties` association row for the selected
	   project/contact pair only after confirmation is received.
	3. Keep `crm_contacts` unchanged.

- Composition save
	1. Validate resource type and row payload for composition updates.
	2. Run `detectCycle()`; abort if any cycle is found.
	3. Write composition version rows to `res_compositions` with effective dates.
	4. Treat parent-item computed rates as changed because composition dependencies changed.

### 4. Tracing Rules

- Rate change -> what it affects: Trace from `res_rates` to parent items through `res_compositions`, then include master and project-copy rows in `res_resources`.
- Vendor -> what projects it is on: Start at `crm_contacts.id`, then read matching `pdoc_parties.party_id` rows and map to `project_id`.
- Project -> what vendors it has: Start at `proj_projects.id`, read `pdoc_parties.project_id` rows, then resolve each `party_id` in `crm_contacts`.
- Vendor -> whether it is safe to delete: Check `pdoc_parties` links and `crm_interactions` history first; remove only when the intended impact is accepted.
- Job type -> ranked vendor list: Resolve `job_nature_id`, hard-filter contacts on exact match, then rank with project appearances, recency, follow-up compliance, and location match.

## Agent Boundary

Do not treat UI labels or frontend seed data as database schema. Service queries and runtime schema initialization are the primary evidence for backend behavior.
