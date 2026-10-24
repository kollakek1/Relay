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

## Current result

```
Test Files  6 passed (6)
Tests       28 passed (28)
```

## Not yet automated

- Browser-level E2E (Playwright) for the rendered UI — the MVP verifies server
  behaviour and the real data layer; UI flows were checked manually against a
  running dev server.
- Load testing of the claim endpoint beyond 5-way concurrency.
