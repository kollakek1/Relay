# Roles & permissions

Relay uses a single, server-enforced authorization model. This guide explains
what each role may do, how extra permissions can be granted, what the dashboard
shows for each role, and the rules for archiving finished processes.

## The model

There are three **fixed organization roles**, ordered from strongest to weakest:

| Role     | Rank | Typical purpose                          |
| -------- | ---- | ---------------------------------------- |
| `OWNER`  | 3    | Owns the workspace; can transfer ownership |
| `ADMIN`  | 2    | Runs the workspace day to day            |
| `MEMBER` | 1    | Does the work assigned to them           |

On top of the role baseline, an administrator may grant **individual extra
permissions** to a member (for example, let one trusted member start processes
without promoting them to `ADMIN`). Effective permissions are always:

```
effective = baseline(role) ∪ extra grants
```

Two invariants hold everywhere:

- **Deny by default.** A permission that is not listed is denied.
- **No escalation.** An administrator can only grant permissions they hold
  themselves, and only an `OWNER` can change another `OWNER`'s grants. The last
  owner of a workspace can never be demoted or removed while a change would
  leave the workspace without an owner.

The catalogue lives in [`shared/server/permissions.ts`](../../shared/server/permissions.ts).
The interface **only reflects** permissions; it is never the control.

## Permission catalogue

| Permission              | What it allows                              |
| ----------------------- | ------------------------------------------- |
| `workflow.view`         | View processes and runs                     |
| `workflow.create`       | Create process templates                    |
| `workflow.edit`         | Edit process templates                      |
| `workflow.publish`      | Publish process templates                   |
| `workflow.delete`       | Archive / restore / delete processes        |
| `workflow.start`        | Start process instances                     |
| `workflow.cancel`       | Cancel running processes                    |
| `template.manage`       | Manage shared templates                     |
| `task.view`             | View tasks                                  |
| `task.claim`            | Claim tasks from the pool                   |
| `task.execute`          | Work on and complete tasks                  |
| `task.assign`           | Assign tasks to others                      |
| `approval.decide`       | Decide on approval steps                    |
| `member.manage`         | Manage members and roles                    |
| `organization.manage`   | Change organization settings                |
| `analytics.view`        | View analytics                              |
| `automation.manage`     | Manage automation rules                     |
| `webhook.manage`        | Manage webhooks                             |
| `apikey.manage`         | Manage API keys                             |

## Baseline permissions by role

| Permission            | MEMBER | ADMIN | OWNER |
| --------------------- | :----: | :---: | :---: |
| `workflow.view`       |   ✅   |  ✅   |  ✅   |
| `workflow.create`     |   —    |  ✅   |  ✅   |
| `workflow.edit`       |   —    |  ✅   |  ✅   |
| `workflow.publish`    |   —    |  ✅   |  ✅   |
| `workflow.delete`     |   —    |  ✅   |  ✅   |
| `workflow.start`      |   —    |  ✅   |  ✅   |
| `workflow.cancel`     |   —    |  ✅   |  ✅   |
| `template.manage`     |   —    |  ✅   |  ✅   |
| `task.view`           |   ✅   |  ✅   |  ✅   |
| `task.claim`          |   ✅   |  ✅   |  ✅   |
| `task.execute`        |   ✅   |  ✅   |  ✅   |
| `task.assign`         |   —    |  ✅   |  ✅   |
| `approval.decide`     |   ✅   |  ✅   |  ✅   |
| `member.manage`       |   —    |  ✅   |  ✅   |
| `organization.manage` |   —    |  ✅   |  ✅   |
| `analytics.view`      |   —    |  ✅   |  ✅   |
| `automation.manage`   |   —    |  ✅   |  ✅   |
| `webhook.manage`      |   —    |  ✅   |  ✅   |
| `apikey.manage`       |   —    |  ✅   |  ✅   |

> The crucial default: **a plain `MEMBER` cannot start process instances.**
> They can still view processes and work on the tasks of instances that are
> already running. To let a member start runs, grant them `workflow.start`.

## Starting processes

`workflow.start` is enforced on the server in `runInstance`
(`features/workflow/server/service.ts`), which is reached by:

- the dashboard "run" action (`runInstanceAction`),
- the public API `POST /api/v1/workflows/:id/run`.

The public API additionally requires an API key with the `instances:write`
scope, and the key acts with the **current** role and grants of the user who
created it — demoting or re-granting that user immediately changes what the key
can do. A hidden button is never the control: a `MEMBER` who guesses the URL or
calls the API directly gets a `403 FORBIDDEN`.

## What each role sees

Navigation is derived from the same rules the pages enforce
(`shared/server/access.ts`), so a hidden tab and a blocked URL can never
disagree. An area is shown when the caller holds **at least one** of its
permissions.

| Area                 | Required permission (any of)                                   | MEMBER | ADMIN/OWNER |
| -------------------- | ------------------------------------------------------------- | :----: | :---------: |
| Dashboard / Search   | —                                                             |   ✅   |     ✅      |
| Workflows            | `workflow.create` · `workflow.edit` · `workflow.publish` · `workflow.start` | — (unless granted) | ✅ |
| Templates            | `workflow.create` · `template.manage`                         |   —    |     ✅      |
| Runs                 | `workflow.view`                                               |   ✅   |     ✅      |
| Archive              | `workflow.view`                                               |   ✅   |     ✅      |
| Tasks                | `task.view`                                                   |   ✅   |     ✅      |
| Task pool            | `task.claim`                                                  |   ✅   |     ✅      |
| Analytics            | `analytics.view`                                              |   —    |     ✅      |
| Access & permissions | —                                                             |   ✅   |     ✅      |
| Team                 | `member.manage`                                               |   —    |     ✅      |
| Notifications        | —                                                             |   ✅   |     ✅      |
| Settings             | — (profile always; admin sections gated)                      |   ✅   |     ✅      |

Granting a `MEMBER` the `workflow.start` permission also reveals the Workflows
area, because they now have something useful to do there.

## The permission center

`/dashboard/access` shows every member what they are allowed to do, in plain
language. There is no way to raise your own privileges there.

For owners and administrators it is also a management surface: they can grant
extra permissions to a member. Every change is written to the organization audit
log (`member.permissions_changed`) and takes effect on the server immediately.

## Deleting vs. archiving a finished process

Relay never hard-deletes a process instance from the UI. Instead, a **finished**
instance can be **archived** — a reversible soft delete that hides it from the
active run list while keeping all of its history.

An instance can be archived only when **all** of the following hold:

1. it is in a terminal state (`COMPLETED` or `CANCELLED`);
2. none of its tasks are outstanding (`BLOCKED`, `PENDING`, `CLAIMED`,
   `IN_PROGRESS` all count as outstanding);
3. the caller holds `workflow.delete`;
4. the instance belongs to the caller's organization.

Being in a terminal state is **not** the same as "has no pending tasks": the
check inspects the task states directly. Cancelled, rejected and completed are
distinct outcomes, and a running instance can never be archived.

Archiving is a single conditional `UPDATE … WHERE archivedAt IS NULL`, so two
concurrent archive requests cannot both succeed and no partially-archived row
exists. The instance's tasks, comments, activity, notifications, outbox events
and audit trail are untouched — analytics and the audit log stay intact.

An archived instance can be **restored** by anyone with `workflow.delete`. It
returns to the active list **in the terminal state it was archived in**;
restoring is not a re-run.

> See also: [`docs/SECURITY.md`](../SECURITY.md) and
> [`docs/THREAT_MODEL.md`](../THREAT_MODEL.md) for the authorization and
> tenancy guarantees.
