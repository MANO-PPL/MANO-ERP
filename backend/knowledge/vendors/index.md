---
type: Table
title: Vendors
resource: crm_contacts
tags: vendors, crm_contacts, categories, contacts, PMC
timestamp: 2026-08-21
---

# Vendors

A vendor is a CRM contact returned by the vendor service. The service does not require a literal `Vendor` category. Vendor queries include rows whose category is NULL or whose lower-case category is not `client` or `pmc`.

## Key Columns / Fields

- `id`: contact identifier.
- `org_id`: organization boundary; always scope queries and writes by organization.
- `name`: required for creation.
- `category`: contact classification.
- `contact_person`, `designation`: operational contact details.
- `telephone_no`, `mobile`, `email`: communication details.
- `address`, `location`, `website`: company details.
- `sector_id`, `job_nature_id`: links to CRM classification tables.
- `gst_no`, `constitution`, `reference`, `responsibility`, `remarks`: operational and commercial context.

## Category Rules

The vendor service defines `VALID_CATEGORIES` as:

- `Contractor`
- `Supplier`
- `Consultant`
- `Manufacturer`
- `Service Provider`
- `Client`
- `PMC`

`resolveCategory()` matches case-insensitively, defaults missing values to `Contractor`, and normalizes the input `Consultants` to stored value `Consultant`.

The client service separately defines a scope-aware list containing `Contractor`, `Consultants`, `Supplier`, `Client`, and `PMC`. No database-level canonical enum was found. Do not collapse these service-level lists into one shared enum.

“Vendor” is a UI/business grouping, not a literal category value.

## Business Rules

- Vendor reads exclude lower-case `client` and `pmc`, while allowing NULL categories.
- `createVendor()` requires `name` and writes a normalized category.
- Job nature and sector references may be resolved from names.
- Vendor interactions use `crm_interactions.follow_up_date`.
- Vendor deletion explicitly deletes related interaction rows before deleting contacts.

## Relationships

- `sector_id` links to `crm_sectors`.
- `job_nature_id` links to `crm_job_nature`.
- Project associations are represented by `pdoc_parties`; see `vendors/relationships.md`.
- Interactions link through `crm_interactions.contact_id`.

## Agent Constraints

- ALWAYS scope by `org_id`.
- NEVER write category `Vendor`; it is not an accepted literal category.
- Use only categories accepted by the operation being called, preserving vendor-service normalization.
- Treat `PMC` as a valid shared CRM category but outside the vendor/client agent scope.
- Confirm before deleting a contact with project-party associations or interaction history.
- `batchSaveClients` deletes only client-category `crm_contacts` and does not delete their interaction history.
- `deleteClient` verifies client category before deleting matching `crm_interactions` and `crm_contacts`.
- `deleteClients` deletes organization-scoped `crm_interactions` for all supplied IDs before applying the client-category filter to `crm_contacts`; validate bulk IDs before deletion.
- `deleteVendors` first deletes organization-scoped `crm_interactions` for all supplied contact IDs, then deletes `crm_contacts` whose category is null or is not client/PMC. The client/PMC exclusion applies only to the contact deletion, so validate all supplied IDs as intended vendor contacts before invoking it.
- `deleteJobNature` deletes unused `crm_job_nature` rows and `deleteSector` deletes unused `crm_sectors` rows after usage guards. Neither function deletes `crm_contacts`.
