# Relay — Production Hardening (V2)

This document tracks the production-hardening pass performed on the Relay
codebase: confirmed defects, their reproduction, the fix, and the test that
proves the fix. It is the single source of truth for the state of that work.

**Branch:** `v2/hardening` — **Baseline commit:** `22abb51` (`docs: mark stages E and F complete`)

> Status legend: ✅ fixed & tested · 🟡 fixed, tested indirectly · ⏳ open (documented)

---

## 0. How this was verified

Every claim in the "Evidence" column was executed locally, not inferred. The
commands used throughout are:

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npx prisma generate    # regenerate the client from prisma/schema
npm run db:deploy      # apply migrations to the configured database
npm test               # vitest (unit + integration, needs DATABASE_URL)
npm run build          # next build (production)
```

The test database is the `DATABASE_URL` from `.env`. Integration tests create
their own users/organizations and clean up after themselves
(`tests/helpers/db.ts`), so they are safe to run repeatedly.

---

## 1. Confirmed defects

### P0-1 — Insecure seed credentials shipped as defaults ✅

| | |
| --- | --- |
| Location | `prisma/seed.ts`, `.env.example`, `.github/workflows/ci.yml`, `README.md` |
| Problem | The seed defaulted `ROOT_EMAIL`/`ROOT_PASSWORD` to `admin@relay.com` / `rootroot`, printed the password to stdout, and would happily create a publicly-known root admin in production. |
| Reproduction | Run `npm run db:seed` with no `ROOT_*` set → a known admin exists and the password is echoed to the console. |
| Fix | Seed now requires an explicit, non-weak password; refuses the shipped placeholders and short/common passwords; never logs the password; demo data is gated behind `SEED_DEMO_DATA`; production refuses unsafe configuration. |
| Evidence | `tests/seed-hardening.test.ts` |

### P0-2 — Cron secret accepted from the URL query string ✅

| | |
| --- | --- |
| Location | `shared/server/job-auth.ts`, `app/api/jobs/sla-scan/route.ts`, `app/api/jobs/drain/route.ts` |
| Problem | `?secret=<CRON_SECRET>` was accepted. Query strings leak through access logs, proxies, referrers and analytics. The SLA route also duplicated its own copy of the auth check and exposed state-changing work on `GET`. |
| Reproduction | `GET /api/jobs/sla-scan?secret=$CRON_SECRET` returns 200 and runs the job. |
| Fix | Only `Authorization: Bearer <secret>` is accepted; secrets are compared with `timingSafeEqual`; state-changing jobs are `POST`-only (`GET` → 405); the SLA route uses the shared helper; `.env.example`, README and deployment docs updated. |
| Evidence | `tests/job-auth.test.ts` (unit) + `tests/sla-automation.test.ts` (HTTP) |

### P0-3 — Outbox events could be marked processed before their side effects succeeded ✅

| | |
| --- | --- |
| Location | `features/webhooks/server/delivery.ts`, `features/automation/server/service.ts` |
| Problem | `drainOutbox` set `outbox_event.processedAt` *before* running automation rules. If the automation step threw, the event was already "processed" and the automation never ran again — silent data loss. |
| Reproduction | Force `runAutomationsForEvent` to throw; the event is still `processedAt != null`. |
| Fix | Unified outbox processing: an event is only `PROCESSED` once fan-out **and** automations have run; failures reschedule with backoff and eventually land in a terminal `FAILED` (dead-letter) state that an admin can requeue. |
| Evidence | `tests/outbox-reliability.test.ts` |

### P0-4 — Concurrent cron runs could double-process the same event/delivery ✅

| | |
| --- | --- |
| Location | `features/webhooks/server/delivery.ts` |
| Problem | Selection was `findMany` + per-row `update` with no claim. Two overlapping drains read the same rows and fanned the same event out to the same endpoints twice, and attempted the same delivery twice. |
| Reproduction | Run two `drainOutbox()` calls in parallel → duplicate `webhook_delivery` rows for one event. |
| Fix | Claim-based processing using `SELECT … FOR UPDATE SKIP LOCKED` + a lease: rows are atomically moved to `PROCESSING` with `lockedAt`/`lockedBy`; expired leases are reclaimed. Fan-out is idempotent via a unique `(endpointId, eventId)` index. |
| Evidence | `tests/outbox-reliability.test.ts` (parallel `Promise.all` drains) |

### P0-5 — Terminal `FAILED` was treated as success, with no retry or visibility ✅

| | |
| --- | --- |
| Location | `features/webhooks/server/delivery.ts`, `features/automation/server/service.ts`, `prisma/schema/integration.prisma` |
| Problem | Delivery/add automation rows had no bounded retry counter with next-run scheduling and no dead-letter marker; a permanent failure was indistinguishable from a retryable one and there was no admin path to requeue. |
| Fix | Explicit states (`PENDING`/`PROCESSING`/`SUCCEEDED`/`FAILED`), `attempts`, `lastError`, `nextAttemptAt`, exponential backoff **with jitter**, and re-queue support (`retryDelivery`, `requeueFailedAutomationRuns`, `requeueFailedOutboxEvents`). |
| Evidence | `tests/outbox-reliability.test.ts`, `tests/automation-rules.test.ts` |

### P0-6 — CSV Formula Injection in exports ✅

| | |
| --- | --- |
| Location | `features/export/server/service.ts` |
| Problem | Cells were only escaped for `"` `,` `\n` `\r`. A value beginning with `=`, `+`, `-`, `@` (including after leading whitespace/control chars) is executed as a formula by Excel/Sheets. Task names are attacker-controlled. |
| Reproduction | Create a task named `=HYPERLINK("http://evil","x")` and export → the CSV contains a live formula. |
| Fix | A single `csvCell` helper neutralises formula-leading values by prefixing `'`, strips control characters, preserves real numbers/dates/negative numbers, and always quotes fields containing separators. |
| Evidence | `tests/csv-export.test.ts` |

### P0-7 — Analytics mixed workflows and mislabelled metrics ✅

| | |
| --- | --- |
| Location | `features/analytics/server/service.ts` |
| Problem | (a) Per-workflow overdue rate used *all* organization tasks (`tasks.filter(t => t.stepOrder >= 0)`), so one noisy workflow polluted every other workflow's rate. (b) Bottlenecks grouped only by `stepOrder`, conflating unrelated processes that share step numbers. |
| Reproduction | Two workflows each with a step `order=1`; one has overdue tasks → both report the same inflated overdue rate / merged bottleneck. |
| Fix | Task queries now carry `instance.workflowId`; per-workflow metrics use only that workflow's tasks; bottlenecks are keyed by `(workflowId, stepOrder)` and labelled with the workflow name; rates guard against divide-by-zero. |
| Evidence | `tests/analytics-search-export.test.ts` |

### P0-8 — SSRF guard was a hostname string check only ✅

| | |
| --- | --- |
| Location | `shared/server/ssrf.ts` |
| Problem | Only literal hostnames were checked. No DNS resolution, so rebinding a public name to `127.0.0.1` / `169.254.169.254` was possible; several IP encodings and IPv4-mapped IPv6 were not normalised; ports and response size were unbounded. |
| Fix | `assertSafeOutboundUrl` + `safeFetch`: scheme allowlist, no credentials, port policy, IP-literal classification (decimal/hex/octal/mapped-v6), **DNS resolve-then-check of every resolved address**, manual redirects (never followed), byte- and time-bounded reads, and per-request timeouts. |
| Evidence | `tests/ssrf.test.ts` |

### P1-1 — Invitation acceptance was not concurrency-safe 🟡

| | |
| --- | --- |
| Location | `features/organization/server/invitations.ts` |
| Problem | Two simultaneous accepts of the same token could both pass the `PENDING` check; the second membership upsert is idempotent, but the audit/status write raced. |
| Fix | The status transition is now an atomic conditional `updateMany` (`status = 'PENDING' AND expiresAt > now`) inside the transaction; a lost race returns a clear error instead of double-accepting. |
| Evidence | covered by `tests/organizations.test.ts`; explicit race test in `tests/security-regression.test.ts` |

---

## 2. What the outbox/retry model now guarantees

- **At-least-once** dispatch. Relay does **not** claim exactly-once for external
  HTTP: it guarantees each event is delivered *at least once*, and makes the
  in-database effects effectively-once via unique keys and claim leases.
- **Atomic claim.** `SELECT … FOR UPDATE SKIP LOCKED` inside a transaction; a
  claim writes `status='PROCESSING'`, `lockedAt=now()`, `lockedBy=<run-id>`.
- **Lease recovery.** A row stuck in `PROCESSING` past `LEASE_MS` (default 5 min)
  is reclaimed by the next run — this is the crash-recovery path.
- **Bounded retries.** Attempts are capped (`MAX_ATTEMPTS`); the delay is
  `min(base · 2^attempts, cap)` plus jitter to avoid thundering herds.
- **Terminal failures are visible.** Exhausted rows become `FAILED` (dead-letter)
  and appear in the admin diagnostics (`listDeliveryHealth`,
  `listAutomationRuns`, `listOutboxHealth`) where an Admin can requeue them.
- **Idempotent fan-out.** `webhook_delivery_endpoint_event_uniq` prevents a
  second delivery row for the same `(endpoint, event)` on a replayed drain.
- **Isolated batch items.** One failing item never aborts the rest of the batch.

---

## 3. Prisma & Git hygiene

See `docs/IMPLEMENTATION_PLAN.md` §B. Summary: the generated Prisma client is no
longer tracked; `prisma generate` runs automatically before typecheck/build via
`postinstall` + explicit scripts, and CI regenerates from a clean checkout.

---

## 4. Open items (with reasons)

See `docs/KNOWN_LIMITATIONS.md`. The important ones:

- SSRF DNS rebinding has a residual TOCTOU window (resolve-then-check, not
  connect-time pinning) — documented, no external egress proxy is required.
- Rate limiting is a fixed window, not sliding.
- Browser E2E requires a live PostgreSQL + running server; the suite is provided
  but gated behind `E2E=1`.

---

## 5. Final verification log

Filled in during Phase G. Each line is a real command result, not a prediction.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | _pending_ |
| Lint | `npm run lint` | _pending_ |
| Prisma generate (clean) | `npm run db:generate` | _pending_ |
| Migrations | `npm run db:deploy` | _pending_ |
| Unit + integration | `npm test` | _pending_ |
| OpenAPI valid | `npm run api:check` | _pending_ |
| i18n completeness | `npm run i18n:check` | _pending_ |
| Production build | `npm run build` | _pending_ |
