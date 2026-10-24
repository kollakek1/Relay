# Relay — Deployment guide (self-hosting)

Relay is a single Next.js application backed by one PostgreSQL database. There is
no worker, no required object storage and no mandatory third-party service, so it
deploys to a plain VM or a serverless platform.

## Build and start

```bash
npm ci
npx prisma migrate deploy   # apply migrations (never reset a shared database)
npm run build
npm run start               # serves the production build on $PORT (default 3000)
```

`npm run build` regenerates the Prisma client first (`prebuild`), and `npm ci`
regenerates it on install (`postinstall`). The generated client is not committed.

## Required environment

```bash
DATABASE_URL="postgres://user:pass@host:5432/relay?sslmode=verify-full"
BASE_URL="https://relay.example.com"
BETTER_AUTH_SECRET="<openssl rand -base64 32>"
CRON_SECRET="<openssl rand -hex 32>"
```

See [CONFIGURATION.md](./CONFIGURATION.md) for everything else.

## Scheduled jobs

Relay has no long-running worker. Any scheduler can drive it:

```bash
# every minute — outbox fan-out, webhook delivery, automation retries
curl -X POST https://relay.example.com/api/jobs/drain \
  -H "Authorization: Bearer $CRON_SECRET"

# every hour — overdue / due-soon SLA notifications
curl -X POST https://relay.example.com/api/jobs/sla-scan \
  -H "Authorization: Bearer $CRON_SECRET"
```

- The secret is accepted **only** in the `Authorization` header, compared in
  constant time. Query-string secrets are rejected.
- Only `POST` is wired up; other methods get `405`.
- Without `CRON_SECRET` the endpoints answer `503` — they never pretend to run.
- Runs are idempotent per time bucket and record a `job_run` row.

## Email (optional)

Set `RESEND_API_KEY` and `EMAIL_FROM` to send invitation emails. Without them,
Relay creates the invitation and shows the link in-app instead of claiming the
mail was sent.

## HTTPS and reverse proxy

- Terminate TLS at your proxy and forward the original `Host`/`X-Forwarded-*`
  headers so `BASE_URL` stays correct.
- Keep the database connection on TLS (`sslmode=verify-full`).

## Backups and restore

- Back up PostgreSQL — it holds all application state. A `pg_dump` on a schedule
  plus tested restores is sufficient.
- Restoring is: stop the app, restore the dump, start the app. No other state
  exists outside the database (there is no local file store).

## Upgrades and rollback

1. Take a database backup.
2. Pull the new code, `npm ci`.
3. `npx prisma migrate deploy` (forward-only; review the SQL first).
4. `npm run build`, then restart.
5. To roll back application code, redeploy the previous build. Migrations are not
   automatically reversible — restore the backup if a migration must be undone.

## Serverless notes

- Every job invocation does a bounded amount of work (fixed batch sizes), so a
  short function timeout is fine.
- No filesystem writes are used at runtime.
- Set `CRON_SECRET` and use the platform's scheduler if it has one.

## Health checks

There is no dedicated health endpoint; hitting `/` exercises the routing, the
locale cookie read and the database-backed layout. For a DB-only check, query
`select 1` from your platform's monitoring.

## Post-deploy checklist

- [ ] `CRON_SECRET` set and both job endpoints return `200` from the scheduler.
- [ ] `BASE_URL` matches the public origin (check an invitation link).
- [ ] `BETTER_AUTH_SECRET` is a long random value and stable across restarts.
- [ ] Migrations applied and `prisma migrate status` reports no pending work.
- [ ] Backups scheduled and a restore has been tested at least once.