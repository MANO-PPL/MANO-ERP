---
type: Table
title: Clients
resource: crm_contacts
tags: clients, crm_contacts, categories, interactions
timestamp: 2026-08-21
---

# Clients

Clients are stored in the shared `crm_contacts` table. Legacy client queries select rows where `LOWER(category) = 'client'`; create and update paths write `Client`, while one batch path writes lower-case `client`.

## Key Columns / Fields

- `id`: contact identifier.
- `org_id`: organization boundary.
- `name`: required for contact creation.
- `scope`: used by scope-aware contact operations.
- `category`: validated by the scope-aware client contact helper.
- `sector_id`, `job_nature_id`: CRM classification links.
- `contact_person`, `designation`, `telephone_no`, `mobile`, `email`: communication details.
- `address`, `location`, `website`, `gst_no`, `constitution`, `reference`, `responsibility`, `remarks`: operational context.

## Category Rules

The scope-aware client helper defines `CONTACT_CATEGORIES` as:

- `Contractor`
- `Consultants`
- `Supplier`
- `Client`
- `PMC`

This differs from vendor-service `VALID_CATEGORIES`, which also accepts `Consultant`, `Manufacturer`, and `Service Provider`, and normalizes `Consultants` to `Consultant`. No canonical database enum was found.

## Business Rules

- Client reads filter case-insensitively for category `client`.
- Client creation requires a name and writes the client category.
- Deleting clients explicitly deletes related `crm_interactions` rows first.
- Client responses expose the latest stored interaction `follow_up_date` under the API property `call_on_date`.

## Relationships

- `crm_interactions.contact_id` links interaction history.
- `pdoc_parties.party_id` can link a client to a project.
- `sector_id` and `job_nature_id` link to CRM classification tables.

## Agent Constraints

- ALWAYS scope by `org_id` and use the client service’s case-insensitive client filter.
- `batchSaveClients` deletes only client-category `crm_contacts` from its submitted deleted IDs and does not delete `crm_interactions`.
- `deleteClient` first verifies one organization-scoped client, then deletes its matching `crm_interactions` and `crm_contacts`.
- `deleteClients` deletes organization-scoped `crm_interactions` for all supplied contact IDs before applying the client-category filter to the `crm_contacts` deletion; therefore validate every supplied ID as an intended client before bulk deletion and confirm project links or interaction history.
- `deleteJobNature` deletes only unused rows from `crm_job_nature`, and `deleteSector` deletes only unused rows from `crm_sectors`, after verified usage guards. These lookup operations do not delete `crm_contacts`.
- Do not assume the vendor category list applies to client writes.
- Handle both `follow_up_date` in stored interaction data and `call_on_date` in client API responses.
- Treat `PMC` as shared-schema data outside the normal client scope.
