# Relay — Security Model

_Scope: MVP threat model, controls actually implemented, and known limitations._

## 1. Authentication

- **Better Auth 1.7** with email + password, mounted at `app/api/auth/[...all]`.
- Sessions are cookie-based (prefix `relay`); the server is the source of truth —
  every protected route and every mutation re-resolves the session with
  `auth.api.getSession({ headers })`.
- `BETTER_AUTH_SECRET` is required in production (the app throws at startup
  otherwise) to avoid a derived, non-rotatable secret.
- Password policy: minimum 8 characters (enforced by both the zod schema and
  Better Auth).

## 2. Tenant (organization) isolation

- Data belongs to an **Organization**. `Context` (`userId`, `organizationId`,
  `role`) is derived server-side from the authenticated user's `Membership`.
- **Every** service query filters by `ctx.organizationId`. Reads of another
  tenant's entity return `NOT_FOUND` rather than `FORBIDDEN`, so the API does not
  leak the existence of foreign records.
- Covered by tests: `tests/auth-organization.test.ts`,
  `tests/workflow-tasks.test.ts` ("blocks foreign-tenant access").

## 3. Authorization (roles)

- Role hierarchy `OWNER > ADMIN > MEMBER` is defined once in
  `shared/server/permissions.ts` and enforced via `requireRole` / capability
  helpers.
- Capabilities:
  | Action | Minimum role |
  | --- | --- |
  | Create / edit / publish / delete workflows | ADMIN |
  | Assign tasks, cancel tasks, manage members | ADMIN |
  | Claim / progress own tasks, comment | MEMBER |
  | Grant/revoke OWNER, remove owners, last-owner guard | OWNER |
- **The client is never trusted**: `usePermission`/UI hiding is cosmetic only;
  every mutation re-checks on the server. Buttons that require a role are also
  disabled, but the guard is server-side.

## 4. Input validation

- All server actions parse their input with Zod (`parseInput`) before touching a
  service. Invalid input becomes a `VALIDATION` result, never an unhandled error.
- Services additionally enforce invariants (state machine, publish validation,
  membership existence for assignees).

## 5. Data integrity & concurrency

- Multi-step mutations use `prisma.$transaction` (workflow save + publish,
  instance + tasks, claim, assign, comment, notification).
- The Task Pool claim is a single conditional `UPDATE`; concurrent claims cannot
  duplicate work (tested).
- Foreign keys use `onDelete: Cascade` for tenant-owned data and `Restrict` for
  authors so history is never orphaned silently.
- Deleting a workflow with running instances is refused.

## 6. Secrets

- `.env` is git-ignored; `.env.example` ships placeholders only. No real secrets
  are committed.
- `DATABASE_URL`/`BETTER_AUTH_SECRET` are read from the environment; the Prisma
  client fails fast if `DATABASE_URL` is missing.

## 7. Known limitations (accepted)

> This section is kept honest: entries that have since been addressed are marked
> **resolved** and point at the new control. The authoritative residual-risk list
> is `docs/KNOWN_LIMITATIONS.md`.

| Area | Status | Mitigation / next step |
| --- | --- | --- |
| Rate limiting | **Resolved (V2).** DB-backed fixed-window limiting on mutation, invite, claim, search and export endpoints | Upgrade to a sliding window / token bucket for precise quotas |
| SSRF on outbound requests | **Resolved (V2).** `shared/server/ssrf.ts` blocks non-http(s) schemes, credentials, private/reserved addresses (incl. after DNS resolution), non-standard ports and redirects | Close the DNS-rebinding TOCTOU with connect-time pinning or an egress proxy |
| Cron secret handling | **Resolved (V2).** Bearer-only, constant-time, POST-only, never in a URL | — |
| Default seed credentials | **Resolved (V2).** No defaults; weak/placeholder passwords refused; password never logged; demo data opt-in | — |
| CSV formula injection | **Resolved (V2).** `features/export/server/csv.ts` neutralises formula-leading cells | — |
| SSL mode | Open | Pin `sslmode=verify-full` in production URLs |
| Audit immutability | Open | `org_audit_log` is append-only by convention, not by DB constraint |
| Email verification | Open | Disabled (`requireEmailVerification: false`); enable with an email provider before a public launch |
| Session / 2FA | Open | Single-factor password only; Better Auth plugins (2FA, OAuth) |
| Translated dashboard surfaces | Open | App chrome, auth and the full public site/docs are EN+RU; deeper feature panels remain English-only (`docs/KNOWN_LIMITATIONS.md`) |
| Dev transitive CVEs | Open | Track upstream; see `DEPENDENCY_AUDIT.md` §5 |

## 8. Verifying the boundaries

Run `npm test`. The suite asserts, among other things:

- foreign-tenant reads/writes return `NOT_FOUND`;
- a MEMBER cannot manage workflows or members;
- the last owner cannot be demoted and ADMINs cannot remove OWNERs;
- invalid state transitions and cross-owner task actions are rejected;
- concurrent claims elect exactly one winner;
- cron endpoints reject query-string secrets and accept only bearer tokens;
- the seed refuses weak/placeholder credentials and never logs them;
- CSV exports neutralise formula injection without corrupting numbers/dates;
- the SSRF guard blocks loopback/private/metadata targets and rebinding;
- the outbox processes an event exactly once under parallel drains, recovers
  expired leases, dead-letters exhausted work and can requeue it;
- API keys enforce scopes, honour revocation and cannot read another tenant.

## 9. V2 hardening summary

The V2 pass (branch `v2/hardening`) closed the following classes of issue. Each
is covered by a test; see `docs/PRODUCTION_HARDENING.md` for the full table.

- **Seed**: no shipped defaults; explicit, validated credentials; no secret
  logging; production refuses unsafe configuration.
- **Cron**: `Authorization: Bearer` only, constant-time comparison, `POST`-only
  state changes, failed runs release their idempotency key.
- **Reliability**: atomic `SELECT … FOR UPDATE SKIP LOCKED` claims with leases,
  bounded retries with backoff + jitter, explicit `PENDING`/`PROCESSING`/
  `SUCCEEDED`/`FAILED` states, dead-letter + admin requeue, transactional
  automation actions, idempotent fan-out. Delivery is at-least-once.
- **Exports**: formula-injection-proof CSV.
- **Analytics**: per-workflow overdue isolation; bottlenecks keyed by
  `(workflowId, stepOrder)`.
- **SSRF**: scheme/port/address policy with DNS resolve-then-check and bounded,
  redirect-free requests.
- **Invitations**: atomic single-use acceptance.
- **Outbound secrets**: `CRON_SECRET` and API keys are never accepted from a URL.
