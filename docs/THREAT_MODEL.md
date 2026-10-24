# Relay — Threat Model

_Scope: the Relay application as deployed (single Postgres database, serverless
compute, no mandatory object storage). This is a working document; it lists the
assets, the trust boundaries, the threats we defend against today, and the ones
we explicitly do not yet._

## 1. Assets

| Asset | Why it matters |
| --- | --- |
| Organization data (workflows, instances, tasks, comments) | Tenant confidentiality and integrity |
| Membership & roles | Access control decisions |
| Invitations & tokens | Entry point into a tenant |
| Sessions / auth credentials | Account takeover |
| API keys & webhook signing secrets | Machine access to tenant data |
| Audit log | Non-repudiation of admin actions |
| Secrets in env (`DATABASE_URL`, `BETTER_AUTH_SECRET`, provider keys) | Full compromise if leaked |

## 2. Trust boundaries

```
Browser (untrusted)  ──▶  Next.js Server Actions / Route Handlers (trusted)
                                     │
                                     ├─▶  Auth layer (Better Auth)
                                     ├─▶  Service layer (authz + tenant scope)
                                     └─▶  PostgreSQL (source of truth)
```

- The **client is never trusted**. `organizationId`, roles, ids and form values
  are re-derived/validated server-side on every request.
- The **active-organization cookie** is a *preference*, re-validated against a
  real membership; a forged value falls back to the user's oldest membership and
  never grants access to another tenant.
- The **database** is the only trusted store. No in-memory state is relied upon
  for correctness.

## 3. Threats & mitigations (current)

| # | Threat | Mitigation | Evidence |
| --- | --- | --- | --- |
| T1 | Cross-tenant read/write via guessed ids | every query scoped by `organizationId`; foreign id → `NOT_FOUND` | services + `tests/organizations.test.ts`, `workflow-tasks.test.ts` |
| T2 | Privilege escalation (member acting as admin) | role hierarchy enforced server-side in every mutation | `permissions.ts`, service guards, tests |
| T3 | Last-owner lockout / owner removal by admin | last-owner guard; only owners manage owners | `service.ts`, tests |
| T4 | Invitation token theft / replay | only SHA-256 hash stored; single-use; email must match; expiry; revoke/rotate | `invitations.ts`, tests |
| T5 | Brute force / abuse of mutations | DB-backed fixed-window rate limiting (429) | `rate-limit.ts`, `tests/rate-limit.test.ts` |
| T6 | Duplicate task claim under concurrency | atomic conditional `UPDATE` | `claimTask`, `task-pool-concurrency.test.ts` |
| T7 | Malformed input / injection | Zod validation at every action boundary; Prisma parameterization; raw SQL parameterized | `action-utils.ts`, `rate-limit.ts` |
| T8 | Secret leakage in logs | structured logger redacts sensitive keys | `logger.ts` |
| T9 | Auth-session confusion | server-resolved session on every request | `auth-context.ts` |
| T10 | Over-permissive data exposure | `NOT_FOUND` (not `FORBIDDEN`) for foreign ids avoids existence leaks | services |
| T11 | SSRF via user-defined outbound URLs | scheme allow-list, no credentials, port policy, private/reserved address blocking, **DNS resolve-then-check**, no redirect following, bounded response | `shared/server/ssrf.ts`, `tests/ssrf.test.ts` |
| T12 | Webhook signature forgery / replay | HMAC-SHA256 over `t.body` with a timestamp header; receivers deduplicate on the delivery id | `delivery.ts`, `tests/outbox-reliability.test.ts` |
| T13 | API key leakage / over-reach | only the hash is stored; explicit scopes; keys act with the creator's current role; revocable | `features/api/server/keys.ts`, `tests/security-regression.test.ts` |
| T14 | Cron secret exposure | `Authorization: Bearer` only, constant-time compare, never in the URL; POST-only | `shared/server/job-auth.ts`, `tests/job-auth.test.ts` |
| T15 | Duplicate/parallel processing of events | atomic `FOR UPDATE SKIP LOCKED` claims with leases + unique idempotency keys | `delivery.ts`, `tests/outbox-reliability.test.ts` |
| T16 | CSV formula injection in exports | formula-leading cells are neutralised while numbers/dates are preserved | `features/export/server/csv.ts`, `tests/csv-export.test.ts` |
| T17 | Insecure default seed credentials | no defaults; weak/placeholder passwords refused; password never logged; demo data opt-in | `prisma/seed-lib.ts`, `tests/seed-hardening.test.ts` |

## 4. Threats not yet fully addressed (residual)

| # | Threat | Status / plan |
| --- | --- | --- |
| R1 | SSRF DNS rebinding (TOCTOU between resolve-then-check and connect) | Residual. Mitigated by resolving and validating every address before connecting; a connect-time pinned socket or egress proxy would close it fully. Documented in `docs/KNOWN_LIMITATIONS.md`. |
| R2 | Exact-once webhook delivery | Not claimed. Delivery is at-least-once with in-database effectively-once semantics; receivers deduplicate on `x-relay-delivery`. |
| R3 | Email verification / account enumeration | Verification disabled; enumeration via invite/registration responses is limited but not eliminated. |
| R4 | Immutable audit at the DB level | append-only by convention; DB roles/triggers not enforced |
| R5 | Distributed rate limiting fairness | fixed window (not sliding); acceptable for abuse control, upgradeable |
| R6 | Dependency CVEs in dev tooling | tracked in `DEPENDENCY_AUDIT.md` |
| R7 | TLS semantics of `sslmode=require` | `pg` currently treats it as `verify-full`; pin `sslmode=verify-full` explicitly in production |
| R8 | Translated dashboard surfaces | **Resolved.** The whole user-facing UI, the public site, docs and API reference are EN+RU (836 keys, parity enforced in CI). Technical identifiers stay untranslated by design; server errors are mapped to translated messages by code. See `docs/KNOWN_LIMITATIONS.md`. |

## 5. Assumptions

- TLS terminates with a trusted certificate for the app origin and DB.
- `BETTER_AUTH_SECRET` is strong, unique and rotated out-of-band.
- The platform provides request isolation between serverless invocations.
- No untrusted party can write to the database directly.

## 6. Review cadence

Re-assess this model at every stage that adds a new trust boundary (outbound
HTTP, webhooks, API keys, file upload). Each addition must land with: server-side
validation, authorization, rate limiting where relevant, an idempotency story,
and tests.
