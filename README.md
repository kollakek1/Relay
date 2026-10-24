<div align="center">
    <img src="https://raw.githubusercontent.com/kollakek1/Relay/refs/heads/main/public/banner.png">
<br />

<h1>⚡ RELAY</h1>

<p>
    <b>The open-source workflow engine for modern teams.</b>
</p>

<p>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
</p>
</div>

---

## 🚀 Overview

**Relay** is a workflow engine that moves work through strictly defined
pipelines. You design a workflow, publish a versioned definition, run process
instances and let tasks flow through a shared pool — with tenant isolation and
role-based access enforced on the server.

## ✨ Features (MVP)

- 🏗 **Workflow builder** — draft, edit, reorder and validate linear workflows.
- 🔀 **Conditions & forms** — per-step form fields (validated server-side) and
  run conditions that skip steps based on values collected by earlier steps.
- ✅ **Approvals** — approval steps with explicit **any/all** decision modes,
  approve / request-changes / reject, a decision log, and notifications.
- 🚀 **Publishing & versioning** — publishing freezes an immutable version;
  running instances never change when you edit the draft.
- ▶️ **Process instances** — start a workflow and generate a task per step,
  released sequentially.
- 📦 **Task pool** — claim unassigned tasks with an **atomic** claim (no two
  people ever get the same task).
- 🔐 **Organizations & roles** — `OWNER` / `ADMIN` / `MEMBER`, enforced
  server-side on every mutation; strict tenant isolation.
- ✉️ **Invitations & multiple workspaces** — invite by email (hashed, single-use,
  expiring links), switch between workspaces, transfer ownership, admin audit log.
- 💬 **Comments & activity** — discussion plus an append-only history of status
  and assignment changes.
- 🔔 **In-app notifications** — assignment, comment, completion, invitation and
  SLA (overdue / due-soon) events with an unread count.
- 📊 **Dashboard & analytics** — real KPIs, process throughput, cycle time and
  step bottlenecks.
- 🔎 **Global search & CSV export** — tenant- and permission-scoped.
- 🧩 **Templates & version diff** — start from ready-made processes, compare
  published versions and restore a draft from any version.
- 🔌 **Public API & webhooks** — scoped hashed API keys against `/api/v1`, and
  HMAC-signed webhooks delivered through a transactional outbox with retries.
- ⏱ **Serverless automation** — idempotent, cron-triggered SLA scan and outbox
  drain; no worker.
- 🛡 **Hardened** — DB-backed rate limiting, structured redacting logs, audit
  trail, SSRF-guarded outbound requests, safe CSV exports.
- 🌗 **shadcn/ui design system** — light/dark themes, responsive, accessible.
- 🌍 **English & Русский** — the interface, docs and API reference are bilingual,
  with a remembered language preference.
- 📖 **Documentation & API reference** — guides under `/docs`, an interactive
  `/api-reference` and a machine-readable OpenAPI 3.1 spec validated in CI.

## 🛠 Tech Stack

- **Framework:** Next.js 16 (App Router, Server Actions)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)
- **Auth:** Better Auth 1.7 (email + password)
- **UI:** Tailwind CSS v4 + shadcn/ui + Lucide
- **Validation:** Zod 4 · **Tests:** Vitest 5

## 🏁 Quick Start

1. **Clone & install**
   ```bash
   git clone https://github.com/kollakek1/relay.git
   cd relay
   npm install
   ```
2. **Configure the environment** — copy `.env.example` to `.env` and fill it in
   (`DATABASE_URL`, `BASE_URL`, `BETTER_AUTH_SECRET`). Set `ROOT_EMAIL` and a
   strong `ROOT_PASSWORD` only for the first seed run.
3. **Generate the Prisma client, apply migrations & seed**
   ```bash
   npm run db:generate   # also runs automatically on `npm install`
   npm run db:deploy
   npm run db:seed
   ```
   The seed refuses missing/weak/placeholder passwords and never prints the
   password. Demo content is opt-in via `SEED_DEMO_DATA=true`.
4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 and sign in with the administrator you seeded (or
   create a new account).

## 🔧 Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + integration) |
| `npm run test:e2e` | Playwright browser smoke test (needs `E2E=1`, a DB and a running server) |
| `npm run db:migrate` | Create/apply a migration (dev) |
| `npm run db:deploy` | Apply migrations (CI/prod) |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:status` | Show migration state |
| `npm run db:seed` | Seed the first administrator (+ optional demo data) |
| `npm run db:generate` | Regenerate the Prisma client (also on `npm install`) |
| `npm run api:check` | Validate the OpenAPI 3.1 spec |
| `npm run i18n:check` | Verify RU/EN translation completeness |

## ⏱ Scheduled jobs (serverless)

Relay has no long-running worker. Periodic work runs as a **bounded, idempotent,
secret-protected endpoint** that any cron/scheduler can hit:

```bash
# every hour (platform scheduler, GitHub Actions cron, cron-job.org, …)
curl -X POST https://your-app/api/jobs/sla-scan \
  -H "Authorization: Bearer $CRON_SECRET"

# every minute — webhook fan-out, deliveries and automation retries
curl -X POST https://your-app/api/jobs/drain \
  -H "Authorization: Bearer $CRON_SECRET"
```

`POST /api/jobs/sla-scan` scans for overdue / due-within-24h tasks and creates
notifications, then prunes expired rate-limit counters.
`POST /api/jobs/drain` fans out new outbox events to webhook endpoints, retries
due deliveries and re-runs failed automation rules. Both are:

- **secret-protected** — `Authorization: Bearer <CRON_SECRET>` only. The secret
  is never accepted from the query string, and is compared in constant time.
- **idempotent** (bounded windows; a task is never double-notified),
- **crash-safe** — outbox rows and deliveries are claimed with a lease using
  `SELECT … FOR UPDATE SKIP LOCKED`, so parallel or interrupted runs never
  double-process work; exhausted rows are dead-lettered and can be requeued.
- **bounded** (fixed batch sizes, no unbounded loops),
- **observable** via the `job_run` table and the admin diagnostics.

Without `CRON_SECRET` configured the endpoints return `503` — they never pretend
to have run. Only `POST` is wired up (`GET` returns 405). See
`docs/ARCHITECTURE.md` and `docs/THREAT_MODEL.md`.

## 📁 Project Structure

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In short: `app/` (routes),
`features/<domain>/` (schemas · server services · actions · components),
`shared/components/ui/` (shadcn primitives), `prisma/` (schema, migrations, seed).

## 📚 Documentation

- [Production hardening](docs/PRODUCTION_HARDENING.md) · [Implementation plan](docs/IMPLEMENTATION_PLAN.md) · [Known limitations](docs/KNOWN_LIMITATIONS.md)
- [Architecture](docs/ARCHITECTURE.md) · [Security model](docs/SECURITY.md) · [Threat model](docs/THREAT_MODEL.md)
- [Testing guide](docs/TESTING.md) · [Incident response](docs/INCIDENT_RESPONSE.md) · [Dependency audit](docs/DEPENDENCY_AUDIT.md)
- [MVP audit](docs/MVP_AUDIT.md) · [Roadmap](docs/MVP_ROADMAP.md) · [V2 roadmap](docs/V2_ROADMAP.md)
- Guides: [quickstart](docs/guides/QUICKSTART.md) · [deployment](docs/guides/DEPLOYMENT.md) · [configuration](docs/guides/CONFIGURATION.md) · [workflows](docs/guides/WORKFLOWS.md) · [automations](docs/guides/AUTOMATIONS.md) · [integrations](docs/guides/INTEGRATIONS.md)
- API: [OpenAPI 3.1](docs/api/openapi.json) · interactive reference at `/api-reference` · download at `/api/openapi`
- Interface & docs: English and Русский (switch in the header / sidebar)

## 🚦 Scope

**Implemented (V1 + V2):** workflow → publish/version → run → tasks → atomic pool
→ comments → activity → notifications → real dashboard → roles & tenant
isolation → invitations & multi-workspace → audit log → analytics → global search
→ CSV export → rate limiting → reliability-hardened outbox & automation retries
→ public API & signed webhooks → English/Russian interface → docs & API
reference → Playwright smoke test (opt-in) → CI.

**Not implemented yet (documented in [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md)):**
full BPMN (parallel branches/gateways), attachments (no storage), external chat
integrations, billing, AI provider, and translation of the deeper dashboard
feature panels (the chrome, auth and the whole public site/docs are bilingual).

<div align="center"> Developed with ❤️ by <b>kollakek</b> </div>
