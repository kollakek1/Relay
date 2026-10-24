# Relay — Configuration reference

Every environment variable Relay reads. Nothing here has an unsafe default.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string, used by the Prisma driver adapter and the Prisma CLI. |
| `BASE_URL` | yes | Public origin of the app. Used by Better Auth and by invitation links. |
| `BETTER_AUTH_SECRET` | production | Signing secret for sessions. `openssl rand -base64 32`. |
| `NEXT_PUBLIC_BASE_URL` | no | Exposes the API base URL to the browser. Defaults to the current origin. |
| `CRON_SECRET` | no | Bearer secret for `/api/jobs/*`. Without it the endpoints return `503`. |
| `RESEND_API_KEY` | no | Enables email delivery for invitations. |
| `EMAIL_FROM` | no | The `From` address for invitation emails (required with a provider). |
| `ROOT_EMAIL` | seed | Email of the first administrator. Validated when seeding. |
| `ROOT_PASSWORD` | seed* | Password for the first administrator. Required only when the account does not exist. |
| `SEED_DEMO_DATA` | no | `true` also creates a sample workspace and workflow. Never on in production by default. |
| `OUTBOUND_ALLOWED_PORTS` | no | Comma-separated allow-list of ports for outbound webhook delivery. Defaults to `80,443,8080,8443`. |

\* The seed rejects missing, weak, placeholder or repeated-character passwords
and never logs the password.

## Notes

- **`BASE_URL` must be the public URL**, not the bind address, or invitation
  links and auth callbacks will point somewhere unreachable.
- **Set `CRON_SECRET` in production.** Without it, background work never runs;
  Relay reports `503` instead of pretending otherwise.
- **`DATABASE_URL` TLS.** Prefer `sslmode=verify-full` explicitly (the `pg`
  driver currently aliases `require` to `verify-full`, but that may change).
- **Do not commit `.env`.** It is git-ignored; only `.env.example` is tracked and
  it contains placeholders, not credentials.

## Where each variable is read

| Concern | File |
| --- | --- |
| Database + auth wiring | `shared/lib/prisma.ts`, `shared/lib/auth.ts`, `prisma.config.ts` |
| Job authentication | `shared/server/job-auth.ts` |
| Email provider selection | `shared/server/email.ts` |
| Invite link origin | `features/organization/server/invitations.ts` |
| Seed safety rules | `prisma/seed-lib.ts`, `prisma/seed.ts` |
| Outbound port policy | `shared/server/ssrf.ts` |