# Relay — Incident Response

A pragmatic runbook for operating Relay. It assumes a single Postgres database
and serverless compute, so every recovery action is a database or configuration
operation — there are no long-lived processes to drain.

## 1. Severity levels

| Level | Definition | Examples |
| --- | --- | --- |
| **SEV1** | Active data exposure or full outage | cross-tenant data leak, auth bypass, DB unreachable |
| **SEV2** | Degraded security or integrity | leaked secret, abuse spike bypassing limits, corrupted process state |
| **SEV3** | Localized bug | a single workflow fails to publish, a notification misses |

## 2. First hour (any severity)

1. **Declare** the incident and name an owner.
2. **Preserve** evidence: export relevant `org_audit_log` rows and server logs
   (structured JSON) before changing anything.
3. **Assess scope**: which organizations, users and time windows are affected?
4. **Contain** using the runbooks below.
5. **Communicate** status to affected workspace owners.

## 3. Runbooks

### 3.1 Suspected secret compromise
- Rotate `BETTER_AUTH_SECRET` (invalidates existing sessions opportunistically),
  `DATABASE_URL` credentials, and any provider keys (`RESEND_API_KEY`).
- Revoke and reissue any API keys (**Settings → API keys**) and webhook signing secrets.
- Confirm no secret is present in the repo: `git log -p | grep -i secret`
  (the app never commits `.env`; `.env.example` holds placeholders only).

### 3.2 Cross-tenant data exposure (SEV1)
- Identify the leaking code path; every service query must filter by
  `ctx.organizationId`. Foreign ids must resolve to `NOT_FOUND`.
- Add/extend a regression test in `tests/organizations.test.ts` that reproduces
  the leak, fix, deploy.
- Notify affected organization owners with the concrete data categories exposed.

### 3.3 Abuse / rate-limit bypass
- Inspect `rate_limit_bucket` for hot keys.
- Tighten the relevant rule in `shared/server/rate-limit.ts` and deploy.
- For targeted abuse, invalidate the actor's sessions and, if needed, remove the
  membership (`removeMember`).

### 3.4 Runaway invitations
- `UPDATE "invitation" SET status='REVOKED', "revokedAt"=now() WHERE
  "organizationId" = '<org>' AND status='PENDING';`
- Rotate: tokens are hashes, so revoking is sufficient; issue fresh invites.

### 3.5 Stuck process instances
- Inspect `task` rows with `status IN ('BLOCKED','PENDING','CLAIMED',
  'IN_PROGRESS')` for the instance.
- Re-drive manually via the task detail actions (server-validated transitions),
  or admin-cancel the task (`CANCELLED`) and re-run the instance.
- All transitions are validated by the state machine, so manual fixes cannot
  create invalid states.

### 3.6 Database outage
- The app relies solely on Postgres; there is no cache to serve stale data.
  Surface a clear error (the UI already shows action errors).
- On recovery, no backfill is required for serverless work because there is no
  in-flight background state; scheduled jobs are idempotent and safe to re-run.

### 3.7 Bad deployment
- Roll back to the previous image. Migrations are additive; do **not** use
  `db push`. If a migration must be reverted, write an explicit down migration.

### 3.8 Background work not progressing
Symptoms: webhooks not delivered, SLA notifications missing, automations not
running.

1. Confirm the scheduler is calling the endpoints: `SELECT * FROM "job_run"
   ORDER BY "finishedAt" DESC LIMIT 20;` — no recent rows means no calls.
2. Confirm `CRON_SECRET` is set; the endpoints return `503` without it.
3. Inspect backlog and dead-letters:
   ```sql
   SELECT "status", count(*) FROM "outbox_event" GROUP BY 1;
   SELECT "status", count(*) FROM "webhook_delivery" GROUP BY 1;
   SELECT "status", count(*) FROM "automation_run" GROUP BY 1;
   ```
4. **Stuck in `PROCESSING`** with an old `lockedAt` is a crashed worker. The next
   drain reclaims rows past the lease automatically; to unstick immediately:
   ```sql
   UPDATE "outbox_event" SET "status"='PENDING', "lockedAt"=NULL, "lockedBy"=NULL
     WHERE "status"='PROCESSING' AND "lockedAt" < now() - interval '15 minutes';
   ```
   The same pattern applies to `webhook_delivery` and `automation_run`.
5. **Dead-lettered** rows are safe to requeue from the admin UI (webhooks panel /
   automation diagnostics); requeuing resets attempts and schedules an immediate
   retry.
6. One endpoint failing never blocks others; a `FAILED` delivery is expected until
   its endpoint is fixed. Endpoints are auto-disabled after repeated exhaustion.

## 4. Data-subject / owner requests
- Export an organization's data with the CSV export scoped to that org.
- Deletion: removing memberships cascades correctly; organization deletion is an
  explicit admin operation. Log every such action in `org_audit_log`.

## 5. Post-incident

Within 5 business days, write a blameless postmortem covering: timeline, root
cause, blast radius, detection gap, and a concrete remediation list with owners.
Add regression tests so the same class of bug cannot recur silently.

## 6. Contacts & escalation
- Maintain an out-of-band contact list (not in this repo) for on-call,
  infrastructure provider support, and the database provider.
