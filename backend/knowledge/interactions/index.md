---
type: Table
title: CRM Interactions
resource: crm_interactions
tags: interactions, follow-ups, contacts, vendors, clients
timestamp: 2026-08-21
---

# CRM Interactions

`crm_interactions` stores contact activity and follow-up scheduling for vendors and clients.

## Key Columns / Fields

- `id`: interaction identifier.
- `org_id`: organization boundary.
- `contact_id`: linked `crm_contacts.id`.
- `type`: interaction type, normalized to lower case by vendor interaction creation.
- `interaction_date`: date/time of the completed or logged interaction.
- `follow_up_date`: scheduled next follow-up date.
- `remarks`: interaction notes.
- `interacted_by`: optional user identifier.

## Business Rules

- Vendor interaction creation requires `type` and `interaction_date`; `follow_up_date` is optional and stored as NULL when absent.
- Client service aggregation reads the stored `follow_up_date` and returns it as `call_on_date` in client API responses. These are two names for the same scheduling value in this service flow; agents must handle both names.
- Deleting a vendor or client explicitly deletes related interaction rows first.

## Agent Definitions

- [STATED] An overdue follow-up is a contact where `follow_up_date < today` and no newer interaction row exists for that `contact_id`.
- [STATED] A relationship silence gap is a contact with no interaction row at all in the last 60 days, regardless of `follow_up_date`.

These definitions are supplied business rules, not claims about an existing backend query.

## Relationships

`crm_interactions.contact_id` links to `crm_contacts.id`. Vendor and client services query interaction history by contact and organization.

## Agent Constraints

- ALWAYS scope interaction queries by `org_id` and `contact_id`.
- `batchSaveClients` deletes client-category `crm_contacts` but does not delete `crm_interactions`.
- `deleteClient` deletes interaction history only after verifying the contact is an organization-scoped client.
- `deleteClients` deletes `crm_interactions` for all supplied IDs in the organization before filtering `crm_contacts` to client category; validate all bulk IDs before invoking it and confirm before removing interaction history.
- `deleteVendors` deletes `crm_interactions` for every supplied contact ID within the organization before filtering the `crm_contacts` deletion. The contact deletion excludes client and PMC categories, but that category filter does not protect the preceding interaction deletion. Validate every supplied ID as an intended vendor contact before invoking `deleteVendors`.
- Preserve the distinction between an overdue scheduled follow-up and a 60-day silence gap.
- When reading client API responses, accept `call_on_date`; when reading stored rows or vendor data, use `follow_up_date`.
- Do not treat an interaction row as proof that a follow-up occurred; inspect later interaction rows and dates.
- Confirm before deleting interaction history.
