# Relay V2 — Roadmap

Derived from `V2_AUDIT.md`. Each stage is shippable on its own, verified, and
committed separately. Binding constraints: **one DB**, **serverless only**, **no
mandatory S3**, **no mass dependency upgrade**.

## Cross-cutting decisions

- **Active organization** is resolved per request from a cookie that is *always*
  re-validated against a real membership; it is never trusted as an authority.
- **Idempotency & retries** live in PostgreSQL (`OutboxEvent`, `IdempotencyKey`,
  `AutomationRun`), drained by a **secret-protected, cron-triggerable route**.
- **Email** goes through an adapter (`shared/server/email.ts`); without a
  configured provider the dev adapter exposes the invite link in-app only.
- **Workflow snapshot** gains `schemaVersion`; the engine runs v1 (linear) and
  v2 (conditions/forms/approval) without breaking old versions.

## Stages

### A — Audit & roadmap ✅
Deliver `docs/V2_AUDIT.md`, `docs/V2_ROADMAP.md`.

### B — Security & foundation
- DB-backed **rate limiting** (`RateLimitBucket` + atomic upsert), applied to
  auth-adjacent and heavy mutations.
- **Structured logging** with request ids and secret redaction (`shared/server/logger.ts`).
- Remove/neutralize dead code (`features/permission`, unused `userRepository`).
- Harden `getContext` error paths; keep tenant isolation tests green.

### C — Organizations & teams
- **Invitations**: model, create/list/revoke/resend/accept, expiring hashed
  token, role assignment, guard-rails, audit, dev email flow, accept page.
- **Multi-org + switching**: cookie-based active org, list/create/switch,
  server validation, tests for two organizations.
- **Team management**: member search/filter, ownership transfer, admin audit.
- **Org settings**: name, description, timezone.

### D — Workflow Engine V2
- Execution model with `schemaVersion`; **conditions** (skip/branch by a safe,
  server-evaluated predicate over process variables).
- **Process forms**: field definitions per step stored in the draft, frozen in
  the version, rendered + validated server-side, results stored per task.
- **Step types**: `TASK`, `APPROVAL`, `START`, `END`.
- **Versioning**: version history, diff, "new draft from version".
- **Templates**: real, creatable/editable workflow templates.

### E — Tasks & approvals
- **Approvals**: decision modes (`ANY`/`ALL`), approve/reject/request-changes,
  decision log, notifications.
- Expanded task views (mine / pool / team / overdue / completed), filters.
- Cancellation with reason; reopen with permission checks; observers/tags.

### F — Serverless automation
- `AutomationRun`, `OutboxEvent`, `IdempotencyKey`; triggers (status change,
  step completion, scheduled, API/webhook) and actions (notify, create task,
  transition, HTTP with SSRF guard).
- **SLA scanner**: idempotent, secret-protected cron route; overdue +
  due-soon notifications; missed-run safe.

### G — API & webhooks
- Versioned JSON API with **API keys**, scoping, pagination, uniform errors,
  rate limiting; a couple of real endpoints (tasks, instances).
- **Webhooks**: endpoints, event selection, HMAC signatures, retries/backoff,
  delivery log, disable on repeated failure.

### H — Analytics, search, export
- Process analytics (runs, completion, avg/median cycle time, overdue %, step
  bottlenecks) with indexed queries.
- Global search (tasks/workflows/instances/members) tenant + permission scoped.
- CSV export with limits and permission checks.

### I — DX & operations
- CI (lint, typecheck, tests, build on a test DB), `.env` validation,
  observability, query review.

### J — Stabilization
- Full check suite, security + tenant-isolation + migration + shadcn +
  serverless review, docs refresh, final report.

## Definition of Done (V2)

Tracked in the task brief §22. Honest status is reported per item; anything
blocked by a missing external service is documented with the reason.

## Progress log

| Stage | Status |
| --- | --- |
| A — Audit & roadmap | ✅ done |
| B — Security & foundation | ✅ done |
| C — Organizations & teams | ✅ done |
| D — Workflow Engine V2 | planned |
| E — Tasks & approvals | planned |
| F — Serverless automation | planned |
| G — API & webhooks | planned |
| H — Analytics, search, export | planned |
| I — DX & operations | planned |
| J — Stabilization | planned |
