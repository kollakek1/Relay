# Relay — Architecture

## 1. Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC + Server Actions) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS v4 + shadcn/ui (radix-ui, lucide) |
| Data | PostgreSQL via Prisma 7 (`prisma-client` generator + `@prisma/adapter-pg`) |
| Auth | Better Auth 1.7 (email + password, Prisma adapter) |
| Validation | Zod 4 |

## 2. Directory layout

```
app/
  (main)/                  public marketing shell
  dashboard/auth/          login / registration (redirects when signed in)
  dashboard/(protected)/   session + workspace guarded area
    page.tsx               dashboard (real KPIs)
    workflows/             list + builder ([id])
    instances/             process runs
    tasks/                 task list + detail ([id])
    pool/                  claimable tasks
    team/                  members & roles
    notifications/         in-app notification center
    settings/              profile + workspace
  api/auth/[...all]/       Better Auth handler
features/
  <domain>/
    schemas/               zod input schemas
    server/                service layer (business logic + data access)
    components/            domain UI (client)
    actions.ts             'use server' thin wrappers
shared/
  components/ui/           shadcn/ui primitives (dumb, no business logic)
  components/              cross-cutting presentation (page header, empty state)
  lib/                     prisma, auth, auth-client, format, utils
  server/                  getContext/requireContext/requireRole, permissions, errors
  hooks/                   useAuth, useAction, useIsMobile
prisma/
  schema/                  base, auth, user, organization, workflow
  migrations/              SQL migrations
  generated/               generated Prisma client (committed)
  seed.ts                  idempotent seed
tests/                     vitest unit + integration tests
```

## 3. Layering rules

1. **`components/ui`** contains only presentational primitives. No data access,
   no business rules.
2. **`features/<domain>/server`** is the only place that talks to Prisma. It
   receives a `Context` (`{ userId, organizationId, role }`) and always scopes
   queries by `organizationId`.
3. **`features/<domain>/actions.ts`** are `'use server'` functions that resolve
   the context (`requireContext`/`requireRole`), validate input with Zod and call
   a service. They never contain business logic.
4. **`shared/server/*`** provides the authorization primitives shared by all
   domains (`errors`, `permissions`, `context`, `auth-context`).
5. Components call actions through the `useAction` hook, which surfaces the real
   `ActionResult` as a toast — no optimistic fake success.

## 4. Authorization model

- Every authenticated user belongs to at least one **Organization** through a
  **Membership** carrying an `OrgRole`: `OWNER > ADMIN > MEMBER`.
- `getContext()` resolves the active workspace from the session; `requireRole(min)`
  enforces the hierarchy. `shared/server/permissions.ts` is the single source of
  the role order.
- Services never trust IDs from the client: a resource is loaded with
  `where: { id, organizationId: ctx.organizationId }`, so a request for another
  tenant's entity resolves to `NOT_FOUND` (no existence leak).

## 5. Domain model

```
User ── Membership ── Organization
                        │
                        ├── Workflow ── WorkflowStep        (mutable draft)
                        │        └── WorkflowVersion          (immutable snapshot)
                        │                 └── ProcessInstance ── Task
                        │                                          ├── Comment
                        │                                          └── TaskActivity
                        └── Notification
```

- **Workflow / WorkflowStep** is the editable draft.
- **WorkflowVersion** stores a JSON snapshot of the steps captured at publish
  time. **ProcessInstance** references a version, so editing the draft never
  mutates a running process.
- **Task** carries `status`, `priority`, `requiredRole`, `assigneeId`,
  `dueAt` and `claimVersion` (optimistic-lock token used for the atomic claim).
- **TaskActivity** is an append-only audit trail; **Comment** holds discussion;
  **Notification** is per-user and tenant-scoped.

## 6. Task lifecycle

```
BLOCKED ──▶ PENDING ──▶ CLAIMED ⇄ IN_PROGRESS ──▶ DONE
   │           │           │           │
   └───────────┴───────────┴───────────┴──▶ CANCELLED
```

- The transition table lives in `features/task/server/state-machine.ts` and is
  enforced server-side.
- Running an instance creates one task per step: the first is `PENDING`, the rest
  `BLOCKED`. Completing a step unblocks the next; completing the last closes the
  instance.
- **Atomic claim**: `claimTask` runs a single conditional
  `UPDATE ... WHERE status='PENDING' AND assigneeId IS NULL`. Postgres serializes
  the row write, so under concurrency exactly one claimant matches and the rest
  receive `CONFLICT`. See `tests/task-pool-concurrency.test.ts`.

## 7. Request flow (example: claiming a task)

```
TaskTable (client) → useAction → claimTaskAction ('use server')
  → requireContext()            (session → active membership)
  → parseInput(taskIdSchema)
  → claimTask(ctx, taskId)      (transaction + conditional update + activity row)
  → ActionResult
→ toast + router.refresh()
```

## 8. Configuration

- `DATABASE_URL` — Postgres connection string (driver adapter).
- `BASE_URL` — public origin (Better Auth).
- `BETTER_AUTH_SECRET` — required in production.
- Prisma CLI reads `prisma.config.ts`; the datasource URL comes from `.env`.

See `.env.example` for the full list.

## 9. V2 additions

| Concern | Module |
| --- | --- |
| DB-backed rate limiting | `shared/server/rate-limit.ts` (+ `rate_limit_bucket`) |
| Structured, redacting logs | `shared/server/logger.ts` |
| Idempotency/dedupe for at-least-once work | `shared/server/idempotency.ts` (+ `idempotency_key`) |
| Email adapter (optional provider, honest dev flow) | `shared/server/email.ts` |
| Active-org resolution (cookie re-validated vs membership) | `shared/server/auth-context.ts` (`resolveContext`, `setActiveOrganizationCookie`) |
| Invitations, audit trail, org settings | `features/organization/server/{invitations,audit,service}.ts` |
| Global search | `features/search/server/service.ts` |
| Analytics | `features/analytics/server/service.ts` |
| CSV export (bounded, permission-checked) | `features/export/server/service.ts`, `app/api/export/route.ts` |
| SLA scan (idempotent, cron-triggered) | `features/sla/server/service.ts`, `app/api/jobs/sla-scan/route.ts` (+ `job_run`) |

### Serverless execution model

There is **no long-running worker**. Work that must happen periodically is a
bounded, idempotent, secret-protected route handler (`/api/jobs/*`) that a cron
or platform scheduler calls. Idempotency is enforced in PostgreSQL via
`idempotency_key`: a successful `create` means "do it", a unique-constraint
violation means "already done". Each run records a `job_run` row for
observability. This makes missed or duplicated triggers safe.
