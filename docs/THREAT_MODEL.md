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
| API keys & webhook signing secrets (later stages) | Machine access to tenant data |
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

## 4. Threats not yet fully addressed (residual)

| # | Threat | Status / plan |
| --- | --- | --- |
| R1 | SSRF via user-defined HTTP automation actions | **Not implemented yet** — design requires connect/redirect limits, loopback/private-IP blocking, protocol allowlist (planned Stage F) |
| R2 | Webhook signature forgery / replay | planned Stage G (HMAC + timestamp + idempotency) |
| R3 | API key leakage | planned Stage G (hashed storage, scopes, last-used, revoke) |
| R4 | Email verification / account enumeration | verification disabled; enumerate via invite/registration responses is limited but not eliminated |
| R5 | Immutable audit at the DB level | append-only by convention; DB roles/triggers not enforced |
| R6 | Distributed rate limiting fairness | fixed window (not sliding); acceptable for MVP, upgradeable |
| R7 | Dependency CVEs in dev tooling | tracked in `DEPENDENCY_AUDIT.md` |
| R8 | TLS semantics of `sslmode=require` | `pg` currently treats it as `verify-full`; pin explicitly in production |

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
