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
- ⏱ **Serverless automation** — idempotent, cron-triggered SLA scan; no worker.
- 🛡 **Hardened** — DB-backed rate limiting, structured redacting logs, audit
  trail. See `docs/THREAT_MODEL.md`.
- 🌗 **shadcn/ui design system** — light/dark themes, responsive, accessible.

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
   (`DATABASE_URL`, `BASE_URL`, `BETTER_AUTH_SECRET`).
3. **Apply migrations & seed**
   ```bash
   npm run db:deploy
   npm run db:seed
   ```
4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, create an account (or use the seeded
   `admin@relay.com` / `rootroot`).

## 🔧 Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + integration) |
| `npm run db:migrate` | Create/apply a migration (dev) |
| `npm run db:deploy` | Apply migrations (CI/prod) |
| `npm run db:seed` | Seed the root admin + demo data |
| `npm run db:generate` | Regenerate the Prisma client |

## ⏱ Scheduled jobs (serverless)

Relay has no long-running worker. Periodic work runs as a **bounded, idempotent,
secret-protected endpoint** that any cron/scheduler can hit:

```bash
# every hour (platform scheduler, GitHub Actions cron, cron-job.org, …)
curl -X POST https://your-app/api/jobs/sla-scan \
  -H "Authorization: Bearer $CRON_SECRET"
```

`POST /api/jobs/sla-scan` scans for overdue / due-within-24h tasks and creates
notifications, then prunes expired rate-limit counters. It is:

- **idempotent per hour** (repeated triggers are no-ops) and **per task per day**
  (a task is never double-notified),
- **bounded** (at most 500 tasks per run, no unbounded loops),
- **safe to re-run** after a missed schedule,
- **observable** via the `job_run` table.

Without `CRON_SECRET` configured the endpoint returns `503` — it never pretends
to have run. See `docs/ARCHITECTURE.md` and `docs/THREAT_MODEL.md`.

## 📁 Project Structure

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). In short: `app/` (routes),
`features/<domain>/` (schemas · server services · actions · components),
`shared/components/ui/` (shadcn primitives), `prisma/` (schema, migrations, seed).

## 📚 Documentation

- [MVP audit](docs/MVP_AUDIT.md) · [Roadmap](docs/MVP_ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Testing guide](docs/TESTING.md)
- [Dependency audit](docs/DEPENDENCY_AUDIT.md)

## 🚦 Scope

**Implemented (V1 + V2):** workflow → publish/version → run → tasks → atomic pool
→ comments → activity → notifications → real dashboard → roles & tenant
isolation → invitations & multi-workspace → audit log → analytics → global search
→ CSV export → rate limiting → idempotent SLA automation → CI → tests.

**Not implemented yet (documented in `docs/V2_ROADMAP.md`):** approvals &
multi-approver modes, templates, version diff, public API & webhooks, browser E2E
(Playwright), full BPMN, external integrations (Telegram), billing.

<div align="center"> Developed with ❤️ by <b>kollakek</b> </div>
