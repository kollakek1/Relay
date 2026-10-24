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

### Known DevTools note

Chrome's *Issues* panel reports *"A form field element should have an id or name
attribute"* for Radix `Select` triggers (`role="combobox"` rendered as a button)
even when the control has an `id`, an associated `<Label htmlFor>`, or an
`aria-label`. Every form control on every page was confirmed to carry an `id`
(`document.querySelectorAll('input, select, textarea, [role="combobox"]')` →
none missing), so this is a heuristic false positive, not an accessibility
defect.

## Not yet automated


- Browser-level E2E (Playwright) for the rendered UI — the MVP verifies server
  behaviour and the real data layer; UI flows were checked manually against a
  running dev server.
- Load testing of the claim endpoint beyond 5-way concurrency.
