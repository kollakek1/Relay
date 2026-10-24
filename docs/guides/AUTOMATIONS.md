# Relay — Automations and background jobs

Repository copy of the automations guide (also rendered at `/docs/automations`).

## Automation rules

A rule pairs a **trigger** (a domain event) with an **action**, plus a validated
configuration. Rules are per-workspace and can be enabled or disabled.

### Triggers

`task.created`, `task.claimed`, `task.completed`, `task.decided`,
`instance.started`, `instance.completed`, `workflow.published`.

### Actions

| Action | Config | Effect |
| --- | --- | --- |
| `notify_role` | `role`, optional `title` | Notifies every member at or above the role. |
| `add_tag` | `tag` | Adds a tag to the triggering task (no duplicate). |
| `set_priority` | `priority` | Sets the triggering task's priority. |
| `create_task` | `name`, optional `assigneeRole` | Adds a follow-up task to the instance. |

## Reliability model

- **Effectively-once per (rule, event).** `AutomationRun` has a unique key on
  `(ruleId, eventId)`. A repeated drain of the same event never re-runs a
  completed action.
- **Atomic claim with a lease.** A run is claimed by flipping it to `PROCESSING`
  with `lockedAt`/`lockedBy`. A worker that crashes mid-run leaves a lease that
  the next drain reclaims. Concurrent workers never share a run.
- **Transactional action.** The action and its status update commit in a single
  database transaction, so a crash rolls both back — no partially-applied effect.
- **Bounded retries.** Failures reschedule with exponential backoff and jitter
  (`shared/server/retry.ts`). After the attempt cap the run is **dead-lettered**
  (`FAILED`, no next attempt) and appears in the admin diagnostics.
- **Idempotent actions.** `add_tag` checks for the tag first; `create_task` looks
  up an existing follow-up task keyed by `(instance, name, creator)`.
- **Batch isolation.** One failing rule never aborts the rest of the batch.

## Jobs

Relay has no worker. Two secret-protected endpoints do the work:

| Endpoint | Suggested cadence | What it does |
| --- | --- | --- |
| `POST /api/jobs/drain` | every minute | Fans out new outbox events to webhook endpoints, attempts due deliveries, retries failed automations. |
| `POST /api/jobs/sla-scan` | every hour | Notifies the right people about overdue and due-within-24h tasks, and prunes expired rate-limit counters. |

Both require `Authorization: Bearer <CRON_SECRET>` (never a query parameter),
accept only `POST`, are idempotent per time bucket, are bounded in batch size, and
record a `job_run` row.

## Outbox and webhooks

Domain events are written to the transactional outbox in the same transaction as
the mutation that produced them. The drain job claims events with
`SELECT … FOR UPDATE SKIP LOCKED` plus a lease, fans them out idempotently (unique
`(endpointId, eventId)`), and only marks an event `PROCESSED` after both fan-out
and automation dispatch succeed. Exhausted events become `FAILED` (dead-letter)
and can be requeued.

Delivery is **at-least-once**; receivers should deduplicate on the
`x-relay-delivery` header. See [INTEGRATIONS.md](./INTEGRATIONS.md) for signature
verification.