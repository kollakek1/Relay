# Relay — Testing Guide

## Running

```bash
npm test          # single run (unit + integration)
npm run test:watch
npm run typecheck # tsc --noEmit
npm run lint
```

Integration tests talk to the **PostgreSQL database in `DATABASE_URL`**. You need
a reachable database with the schema applied:

```bash
npm run db:deploy   # apply migrations
npm run db:seed     # optional: root admin + demo data
```

> ⚠️ Integration tests create and then clean up their own rows (organizations,
> users, workflows, tasks). Point them at a **dedicated test database**, never at
> production data.

## Infrastructure

- **Runner:** Vitest 5 (`vitest.config.mts`), `node` environment, `forks` pool,
  files run **serially** to avoid contention on the shared connection pool.
- **Setup:** `tests/setup.ts` loads `.env` via `@next/env` the way Next does (and
  clears the `BASE_URL='/'` value that Vite seeds in the worker).
- **Helpers:** `tests/helpers/db.ts` creates users/organizations and tracks them
  for cleanup, plus `createContext(role)` to obtain an authorization `Context`.
- Tests exercise the **service layer directly** with an explicit `Context`, which
  is exactly what the server actions pass. This keeps them fast and avoids
  mocking — they hit the real database and assert real state.

## Coverage map

| Requirement | File | What is asserted |
| --- | --- | --- |
| Registration & login | `auth-organization.test.ts` | Better Auth sign-up + sign-in; workspace provisioning as OWNER; idempotency |
| Organization isolation | `auth-organization.test.ts` | foreign membership returns `NOT_FOUND` |
| Role enforcement | `auth-organization.test.ts`, `permissions.test.ts` | role hierarchy, MEMBER blocked, last-owner guard, ADMIN can't remove OWNER |
| Permission catalogue | `permissions.test.ts` | deny-by-default, MEMBER has no `workflow.*` management/start, grants are additive, unknown grants ignored, role-baseline fallback |
| RBAC — launching processes | `rbac-access.test.ts` | MEMBER cannot start an instance; a MEMBER granted `workflow.start` can; task work is unaffected; ADMIN/OWNER keep powers |
| Permission grants | `rbac-access.test.ts` | no escalation (an actor cannot grant what they lack), normalisation, audit entry |
| Navigation access rules | `rbac-access.test.ts` | management areas hidden from MEMBER, revealed by a grant, shown to ADMIN |
| Instance archive | `rbac-access.test.ts` | running instance refused; finished instance archives, leaves the active list, restores; permission required; tenant isolation; double archive → `CONFLICT` |
| Workflow create/publish/version | `workflow-tasks.test.ts` | draft → publish → v1/v2, status transitions, MEMBER forbidden |
| Instance run & task generation | `workflow-tasks.test.ts` | sequential tasks (`PENDING`+`BLOCKED`), unblocking, instance auto-completion |
| Published-version protection | `workflow-tasks.test.ts` | editing the draft does not change the frozen version or running tasks |
| Task state machine | `state-machine.test.ts`, `workflow-tasks.test.ts` | allowed/blocked transitions, invalid skip rejected |
| Foreign-task access | `workflow-tasks.test.ts` | cross-tenant `get/claim/transition` → `NOT_FOUND`; non-assignee → `FORBIDDEN` |
| Atomic task claim | `task-pool-concurrency.test.ts` | 5 concurrent claims → exactly 1 wins, 4 `CONFLICT`; repeat claim rejected |
| Comments & activity | `workflow-tasks.test.ts` | comment + `ASSIGNED`/`COMMENTED` activity recorded |
| Notifications | `workflow-tasks.test.ts` | assignment/comment notifications, unread count, mark-read, actor not self-notified |
| Search & filtering | `workflow-tasks.test.ts` | text search, status filter, pool filter |
| Validation & errors | `workflow-validation.test.ts`, `workflow-tasks.test.ts` | empty publish rejected, duplicate steps rejected, missing id → `NOT_FOUND` |
| Rate limiting | `rate-limit.test.ts` | limit enforced, window reset, atomic under concurrency, pruning |
| Invitations | `organizations.test.ts` | create/list/accept, wrong email, duplicate member, revoke, expiry, token rotation, role guards, audit |
| Multiple organizations | `organizations.test.ts` | active-org resolution from a validated value, forged-value fallback, per-org isolation, settings perms, ownership transfer |
| Workflow engine (conditions/forms) | `workflow-engine.test.ts`, `workflow-conditions-forms.test.ts` | condition operators, form validation/coercion, v1→v2 snapshot upgrade, skip vs activate, publish-time condition validation |
| Approvals | `workflow-approvals.test.ts` | ANY approve/reject/request-changes, ALL requires all, rejection short-circuit, claim/progress guards, pool exclusion, approver notifications |
| Templates & version diff | `workflow-templates-versioning.test.ts` | structural diff, built-in templates produce real drafts, save/reuse workspace templates, tenant isolation, version restore |
| API, keys & webhooks | `integration-api-webhooks.test.ts` | hashed keys + scope enforcement, key dies with its creator's membership, SSRF guard, outbox fan-out + HMAC signature, backoff/retry/failure, endpoint auto-disable |
| Cron authentication | `job-auth.test.ts` | bearer-only, query secret rejected, constant-time compare, fail-closed |
| Seed safety | `seed-hardening.test.ts` | weak/placeholder passwords refused, password never logged, plus a source scan of `seed.ts`/`.env.example` for shipped credentials |
| CSV safety | `csv-export.test.ts` | formula injection flagged/neutralised, structural escaping, control characters stripped, numbers/dates preserved |
| SSRF classification | `ssrf.test.ts` | IP-literal ranges, odd encodings, port policy, DNS resolve-then-check, rebinding, unresolvable hosts |
| Outbox reliability | `outbox-reliability.test.ts` | exactly-once under parallel drains, lease reclaim vs held lease, blocked-vs-healthy batch isolation, HMAC verification, automation retry/dead-letter/requeue |
| API key & invitation security | `security-regression.test.ts` | scope filtering, revocation, cross-tenant read blocked, concurrent single-use invitation acceptance |
| Analytics isolation | `analytics-search-export.test.ts` | per-workflow overdue rates do not leak across workflows that share step numbers |

## Static checks

```bash
npm run db:validate   # Prisma schema is valid
npm run api:check     # OpenAPI 3.1 spec validates AND matches the route files
npm run i18n:check    # six-language key parity, no empty values, plural sanity
```

`api:check` fails if a documented path has no route handler, or if a route under
`app/api/v1` is undocumented — so the docs cannot drift from the code.
`i18n:check` is backed by the type system: every locale file is typed as
`Messages`, so a missing key is already a compile error; the script also compares
all six key sets at runtime and flags values still identical to English.

## Remote test database note

The suite runs against a **remote managed Postgres** instance. Under a long
serial run, rare `Unable to start/commit a transaction` latency spikes occur
that are unrelated to the code under test — every test passes when its file runs
in isolation. To absorb that infrastructure noise:

- `vitest.config.mts` sets `retry: 1` and a 120s per-test timeout.
- `shared/lib/prisma.ts` raises interactive transaction `maxWait`/`timeout` to
  20s/30s (also safer in production against a managed database).

A real logic failure reproduces deterministically and is not hidden by the retry.


## Current result

```
Test Files  6 passed (6)
Tests       28 passed (28)
```

## Manual browser verification (Chrome DevTools)

The MVP was exercised end-to-end in a real browser via the Chrome DevTools MCP.
Verified against a running dev server + the seeded workspace:

- **Login / registration** — sign-in redirects to `/dashboard`; sign-out
  (confirm dialog) revokes the session and returns to `/dashboard/auth`.
- **Happy path** — open *Content Review* → **Publish** (creates v1, status
  `PUBLISHED`) → **Start instance** (v1, `RUNNING 0/3`) → **Task Pool** shows the
  first step `Available` → **Claim** (pool empties, task assigned) → task detail
  **Start working** → **Complete** → the next step unblocks and the instance
  progress advances.
- **Real dashboard** — KPIs (`My tasks`, `Available in pool`, `Completed today`,
  `Active instances`, `Overdue`) and *Recent activity* reflect actual DB state.
- **Team / Settings / Notifications** — members with roles (Owner), workspace
  summary, and the notification empty state render correctly.
- **Search** — workflows and tasks filter live (debounced) with an empty state.
- **Theming** — the light/dark toggle applies `.light`/`.dark` and persists in
  `localStorage`.

No runtime console errors were observed on any page.

### Visual verification (V2)

A browser pass (Chrome DevTools MCP) covered the rebuilt surfaces: workflow
builder (step type, approval rule, form-field editor, run condition), task detail
(process form + submitted values, approval panel, decision buttons), dashboard,
analytics, search, team, settings integrations and the marketing landing page.
Verified end-to-end that approving a step advances the pipeline and that a
conditional step activates the following task.

Artifacts found and fixed in that pass: analytics tables clipped at half width
(now full-width stacked cards), a redundant disabled "Options" input in the
form-field editor (now shown only for `select`), and a meaningless Assignee
control on approval tasks (now hidden).

### Known DevTools note
Chrome's *Issues* panel reports *"A form field element should have an id or name
attribute"* for Radix `Select` triggers (`role="combobox"` rendered as a button)
even when the control has an `id`, an associated `<Label htmlFor>`, or an
`aria-label`. Every form control on every page was confirmed to carry an `id`
(`document.querySelectorAll('input, select, textarea, [role="combobox"]')` →
none missing), so this is a heuristic false positive, not an accessibility
defect.

## Not yet automated

- Browser-level E2E (Playwright) is **provided** (`e2e/`, `npm run test:e2e`) but
  gated behind `E2E=1` because it needs a live PostgreSQL, applied migrations and
  a running server. CI enables it only when the repository variable
  `RUN_E2E=true` is set (`.github/workflows/ci.yml`).
- Load testing of the claim endpoint beyond 5-way concurrency.
- Visual regression snapshots.
