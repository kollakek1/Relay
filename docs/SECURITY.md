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

## 7. Known limitations (accepted for the MVP)

> Superseded in part by Relay V2. The V2 stages add: DB-backed rate limiting
> (`shared/server/rate-limit.ts`), invitations with hashed single-use tokens,
> multi-workspace support with a re-validated active-org cookie, an admin audit
> trail (`org_audit_log`), structured redacting logs, and
> `docs/THREAT_MODEL.md` + `docs/INCIDENT_RESPONSE.md`.


| Area | Limitation | Mitigation / next step |
| --- | --- | --- |
| Rate limiting | No per-IP/route throttling; the atomic claim prevents task duplication but not brute-force on auth endpoints | Add reverse-proxy/edge rate limiting; Better Auth rate-limit plugin |
| SSL mode | The provided test URL uses `sslmode=require`, which current `pg` treats as `verify-full`; a future `pg` major switches semantics | Pin `sslmode=verify-full` (or `uselibpqstyle`) in production URLs |
| Audit immutability | `TaskActivity` is append-only by convention, not by DB constraint | Restrict UPDATE/DELETE via DB roles or triggers if required |
| Email verification | Disabled (`requireEmailVerification: false`) for the MVP | Enable with an email provider before public launch |
| Session/2FA | Single-factor password only | Better Auth plugins (2FA, OAuth providers) |
| Legacy RBAC | `features/permission/*` (client-only permission catalogue) and `features/user/repositories/userRepository.ts` remain in the tree but are **not** used for enforcement | Remove or repurpose when the permission matrix is finalized |
| Dev transitive CVEs | `npm audit` reports 6 dev-only transitive advisories (build/lint tooling) | Track upstream; see `DEPENDENCY_AUDIT.md` §5 |

## 8. Verifying the boundaries

Run `npm test`. The suite asserts, among other things:

- foreign-tenant reads/writes return `NOT_FOUND`;
- a MEMBER cannot manage workflows or members;
- the last owner cannot be demoted and ADMINs cannot remove OWNERs;
- invalid state transitions and cross-owner task actions are rejected;
- concurrent claims elect exactly one winner.
