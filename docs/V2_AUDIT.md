# Relay V2 — Audit

_Date: 2026-10-24 · Branch `main` · Base commit `bb2254c` · Working tree clean._

## 1. Method

I read the actual code, not just the previous report: Prisma schemas, all
`features/*/server` services, `features/*/actions.ts`, `shared/server/*`, the
`(protected)` route group, `package.json`/lockfile and `docs/*`. Everything below
reflects what is really in the tree at `bb2254c`.

## 2. What the MVP actually delivers (verified)

| Capability | State | Evidence |
| --- | --- | --- |
| Email/password auth (Better Auth 1.7) | ✅ real | `shared/lib/auth.ts`, `app/api/auth/[...all]` |
| Registration + workspace auto-provisioning | ✅ real | `features/organization/server/bootstrap.ts`, `useAuth.register` |
| Organizations + `OWNER/ADMIN/MEMBER` | ✅ real | `prisma/schema/organization.prisma` |
| Server-side role enforcement | ✅ real | `shared/server/permissions.ts`, used by every service |
| Tenant isolation on reads/writes | ✅ real | every query filtered by `ctx.organizationId`; foreign id → `NOT_FOUND` |
| Linear workflow draft + steps | ✅ real | `Workflow`, `WorkflowStep` |
| Publish + immutable version | ✅ real | `WorkflowVersion.steps` JSON snapshot |
| Run instance → sequential tasks | ✅ real | `runInstance`, `BLOCKED→PENDING` unblocking |
| Task state machine | ✅ real | `features/task/server/state-machine.ts` |
| Atomic pool claim | ✅ real | conditional `updateMany`, tested |
| Comments + TaskActivity | ✅ real | `Comment`, `TaskActivity` |
| In-app notifications + unread count | ✅ real | `Notification`, sidebar badge |
| Dashboard on real data | ✅ real | `features/dashboard/server/service.ts` |
| shadcn/ui + light/dark | ✅ real | `shared/components/ui`, `next-themes` |
| Vitest unit + DB integration (28 tests) | ✅ real | `tests/**` |

**Verdict:** the MVP is genuinely functional for a single team in a single
workspace. It is not a façade.

## 3. What is missing or only partial (gap analysis vs V2 target)

### 3.1 Organizations & team (biggest product gap)
- **No invitations at all.** New signups always create a *new* organization; there
  is no way to join an existing one. (Confirmed: only `createOrganizationForUser`
  and `ensureOrganization` exist.)
- **No multi-organization support.** `getContext()` hard-picks the *oldest*
  membership (`orderBy: { createdAt: 'asc' }`). A user in two orgs cannot switch.
- No organization settings beyond `name`/`slug`; no timezone/locale, no description.
- No ownership transfer; no member search/filter; no admin action audit trail.

### 3.2 Workflow engine
- Only **linear** execution. No conditions, no branching, no merge, no explicit
  start/end nodes. `WorkflowStep` = `{order,name,description,assigneeRole,dueInDays}`.
- **No process forms.** No way to capture structured input per step.
- No version diff / "new draft from a published version".
- No step types other than an implicit "task". No approval semantics.
- No templates library.
- Builder is a form list, not a visual graph (acceptable per constraints, but
  conditions/forms are missing).

### 3.3 Tasks & approvals
- No approvals (approve/reject/request-changes, single/multi approver modes).
- No tags, observers, parent/child links, custom fields, cancellation reason.
- Task fields: `status/priority/assignee/dueAt/requiredRole` only.
- Views: one list + pool + detail. No "assigned to team", "overdue",
  "completed" saved views.

### 3.4 Serverless automation
- **None.** No triggers, no scheduled actions, no outbox, no retries, no
  idempotency keys. SLA does nothing on a timer (there is no timer).
- No protected cron endpoint.

### 3.5 Integrations / API
- **No public API**, no API keys, no webhooks, no rate limiting.

### 3.6 Analytics / search / export
- Dashboard has 5 counters + activity feed. No process analytics (throughput,
  cycle time, bottlenecks), no global search, no CSV export.

### 3.7 Security & platform
- **No rate limiting** (in-memory would be wrong here — must be DB-backed).
- `getContext` cannot express "active org" (see 3.1).
- No structured logging / request ids; errors are `console.error`.
- `TaskActivity` append-only by convention only.
- No CSRF/security review docs for API (no API yet).
- `sslmode=require` semantics warning from `pg` (documented, not fixed).

### 3.8 DX / testing / ops
- No CI. No browser E2E. No `.env` validation beyond a runtime throw.
- Dead code: `features/permission/**` (client-only catalogue, unused for
  enforcement) and `features/user/repositories/userRepository.ts` (unscoped,
  unused).
- Optimistic locking only on claim (`claimVersion`), nowhere else.

## 4. Infrastructure constraints (binding for V2)

1. **One Postgres DB** for everything → keep tenant isolation in *server logic*,
   not per-tenant schemas. All new tenant tables get `organizationId` + indexes.
2. **Serverless only** → no long-lived workers/loops/WebSocket servers. Use
   Server Actions, Route Handlers, PostgreSQL as source of truth, a
   transactional outbox, and short idempotent jobs invoked by a cron-triggered
   endpoint.
3. **No S3 required** → attachments stay metadata-only (honestly marked
   unavailable); storage behind an interface with a dev-only local adapter.
4. **Do not re-upgrade dependencies** → keep Next 16.4.3 / React 19.3.1 /
   Prisma 7.10.1 / Better Auth 1.7.12 / Tailwind 4.3.3. Add libraries only with a
   concrete reason, verified against the current stack + serverless.

## 5. Reusable foundations (extend, don't rewrite)

- `Context { userId, organizationId, role }` + `requireContext/requireRole` —
  extend with active-org resolution and a `Capability` helper.
- `AppError` + `ActionResult` + `useAction` — reuse for every new action.
- `WorkflowVersion.steps` JSON snapshot — extend the snapshot shape with
  conditions/forms/step types; the immutability contract already holds.
- `TaskActivity` — extend the enum rather than add a parallel table.
- `Notification` + outbox-ready shape — add delivery/outbox tables alongside.
- shadcn primitives already present: add `switch`, `popover`, `scroll-area`,
  `alert`, `skeleton` usage; only add new primitives if genuinely needed.

## 6. Risks & dependencies between stages

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Active-org change touches every request | Broad regression surface | Do it in Stage C with tests for 2 orgs before other features |
| Conditional execution changes `WorkflowVersion.steps` shape | Old versions must still run | Version the snapshot schema (`schemaVersion`); engine handles v1 (linear) and v2 (conditions/forms) |
| Rate limiting on serverless | Multi-instance races | DB-backed counter with atomic upsert, not memory |
| Outbox delivery without a worker | Lost events | Cron-triggered idempotent drain endpoint + retries/backoff; DB as truth |
| Email provider absent | Invitations unusable | Adapter + dev flow (copyable link) + docs; never fake "sent" |
| Scope size | Half-finished features | Ship stage-by-stage, each with tests + commit; document partials honestly |

## 7. Recommended V2 order (see `V2_ROADMAP.md`)

A audit → B security/foundation (rate limit, logging, dead-code) → C
organizations (invitations, multi-org, settings) → D workflow engine
(conditions, forms, versions, templates) → E tasks & approvals → F serverless
automation (outbox, SLA cron) → G API & webhooks → H analytics/search/export →
I DX (CI, E2E, observability) → J stabilization.

Each stage is independently shippable and committed.
