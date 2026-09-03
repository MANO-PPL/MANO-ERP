---
type: Table
title: Projects
resource: proj_projects
tags: projects, status, members, permissions, parties, resources
timestamp: 2026-08-21
---

# Projects

`proj_projects` stores organization-scoped projects. Project membership is stored in `proj_members`; project parties use `pdoc_parties`; project resource copies use `res_resources.project_id`.

## Key Columns / Fields

- `id`: project identifier.
- `org_id`: organization boundary.
- `name`: required at creation.
- `location`: project location.
- `status`: application-controlled status string.
- `project_code`: optional project reference.
- `start_date`, `end_date`: schedule boundaries.
- `metadata`: serialized project metadata.
- `logo_url`: optional logo object path or presigned response URL.

## Status Rules

`createProject()` defaults status to `active`. `updateProject()` accepts any truthy supplied status and does not validate it against an enum. No database-level project status enum or complete allowed-value list was found.

Treat `active` as the application default/convention, not as an enforced enum.

## Relationships

- `proj_members.project_id` links users to projects with permission levels such as `view` and `edit`.
- `pdoc_parties.project_id` links CRM contacts to projects.
- `res_resources.project_id` identifies project-scoped resource copies.
- Resource rates and compositions reference the project resource IDs indirectly through those copied rows.

## Business Rules

- Project reads are organization-scoped; non-admin users are limited by `proj_members` membership.
- Project permission validation recognizes `none`, `view`, and `edit` levels.
- Project resource operations require the project to exist and belong to the organization.

## Agent Constraints

- ALWAYS scope by `org_id` and verify project membership/permission before mutation.
- Do not assume `active` is the only valid status or a database-enforced enum.
- Warn before removing a party or resource associated with an operational project; the warning is an agent safety practice, not a universal backend guard.
- Do not claim that projects persist budget sections in the backend; current budget sections are frontend seed data.
- `removePartiesFromProject` deletes scoped `pdoc_parties` rows only after project-party validation; `syncProjectParties` deletes `pdoc_parties` for submitted removals. Verify organization/project association and confirm removal from an active project.
- `removeProjectResource` deletes project-copy and unused-child `res_resources` only within the verified organization/project/resource scope; child cleanup must remain explicit.
- `removeUserFromProject` deletes one `proj_members` membership scoped by `org_id`, `project_id`, and `user_id`; verify the membership exists before deletion.
- `updateUser` synchronizes `proj_members` from submitted `project_ids` and deletes memberships absent from that list, scoped by `user_id` and organization.
