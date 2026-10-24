# Relay — Quickstart

Get from a fresh clone to a running workflow instance. Every command matches
this repository's `package.json` and Prisma configuration.

The same content is available in both languages in the app at `/docs/quickstart`.

## Prerequisites

- **Node.js** 20 or newer (CI runs Node 24).
- **PostgreSQL** 14 or newer, reachable from the machine running Relay.
- Nothing else is mandatory: email, cron and outbound webhooks are optional.

## 1. Install

```bash
git clone https://github.com/kollakek1/Relay
cd Relay
npm install
```

`npm install` also runs `prisma generate` (via the `postinstall` script). The
generated Prisma client is not committed to the repository — it is rebuilt from
`prisma/schema`.

## 2. Configure the environment

```bash
cp .env.example .env
```

Set at least:

- `DATABASE_URL` — the PostgreSQL connection string.
- `BETTER_AUTH_SECRET` — generate with `openssl rand -base64 32`.
- `BASE_URL` — the public origin, e.g. `http://localhost:3000`.

See [CONFIGURATION.md](./CONFIGURATION.md) for the full list.

## 3. Migrate and create the first administrator

```bash
npm run db:deploy   # apply migrations
ROOT_EMAIL=you@example.com ROOT_PASSWORD='a-strong-unique-password' npm run db:seed
```

The seed:

- refuses a missing, short (< 12 chars) or placeholder password,
- never prints the password,
- only creates a demo workspace when `SEED_DEMO_DATA=true` (and never in
  production by default),
- is idempotent: re-running it against an existing administrator changes nothing.

## 4. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in with the administrator you seeded, or
create a new account.

## 5. Create and run your first workflow

1. Open **Workflows** and create a workflow.
2. Add steps (mark a step as an approval if it needs a decision).
3. **Publish** — this freezes version 1.
4. Open **Runs** and start an instance.
5. Claim the generated task from the **Task pool** and complete it.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `DATABASE_URL environment variable is not set` | `.env` is missing or not loaded. Copy `.env.example`. |
| Cannot reach the database | Check host, port, credentials and the TLS mode in `DATABASE_URL`. |
| Seed aborted about `ROOT_PASSWORD` | Provide a strong, unique password (≥ 12 characters). |
| Type errors after `git pull` | `npm run db:generate`. |
| `prisma generate` cannot find the schema | Run it from the repository root; the schema lives in `prisma/schema`. |

## Next steps

- [Workflows](./WORKFLOWS.md) — design, publish and run.
- [Automations](./AUTOMATIONS.md) — rules and background jobs.
- [Deployment](./DEPLOYMENT.md) — production, cron, backups.
- [Integrations](./INTEGRATIONS.md) — API keys and webhooks.