# Relay — Workflows and tasks

This is the repository copy of the workflow guide. The same content (in English
and Russian) is rendered in the app at `/docs/workflows`.

## Concepts

- **Workflow** — an ordered list of steps. Starts as `DRAFT`.
- **Workflow version** — an immutable snapshot captured at publish time.
- **Process instance** — a run of a published version.
- **Task** — the unit of work generated for a step. `TASK` is human work;
  `APPROVAL` is a decision.

## Designing a workflow

1. Create a workflow and give it a name and description.
2. Add steps. Each step has an order, a name, an optional description, an optional
   required role, and an optional due-in-days value.
3. Decide whether a step is a `TASK` or an `APPROVAL`. Approvals additionally
   choose a mode: `ANY` (first decision wins) or `ALL` (every eligible approver
   must decide).
4. Optionally attach form fields and a condition that can skip the step.
5. Validate and publish.

## Forms and conditions

Form field definitions are stored on the step and copied onto the task when an
instance starts. Submitted values are validated on the server against the step
definition before the task can be completed. Collected values are available to
later step conditions, which is how a run can skip steps that do not apply.

## Publishing and versions

Publishing validates the draft and writes a `WorkflowVersion` row containing a
snapshot of the steps. Instances reference the version they were started with, so
editing the draft afterwards never mutates running work. You can compare versions
and restore a draft from a previous version.

## Running an instance

Starting an instance creates one task per non-skipped step. Tasks are released in
order: the next task becomes available once the previous one is `DONE`, unless a
task dependency currently blocks it.

## Task lifecycle

```
BLOCKED ──▶ PENDING ──▶ CLAIMED ──▶ IN_PROGRESS ──▶ DONE
   ▲                                     │
   └──────────── CANCELLED ◀─────────────┘
```

- `PENDING` tasks are claimable from the shared pool.
- Claiming is a single atomic conditional update; two people can never hold the
  same task. A lost race returns a conflict.
- Approvals record `APPROVED`, `REJECTED` or `CHANGES_REQUESTED`.
- Tasks can be reopened (with a reason) and carry tags, observers and
  dependencies.

## Permissions

- Any member can claim and work on tasks.
- Creating, editing, publishing and deleting workflows requires `ADMIN` or
  `OWNER`.
- The role hierarchy is `OWNER > ADMIN > MEMBER`, defined once in
  `shared/server/permissions.ts` and enforced in the service layer.