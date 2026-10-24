# Relay — MVP Audit

> **Historical document.** This is the audit that kicked off the MVP build.
> It describes the repository at an early commit and is kept for context.
> For the current state see [CHANGELOG.md](../CHANGELOG.md),
> [docs/KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) and [README.md](../README.md).


_Date: 2026-10-24 · Branch: `main` · Baseline commit: `bf8e978`_

## 1. Executive summary

Relay is an early-stage open-source workflow engine ("BPM for modern teams").
At the time of this audit the repository is a **Next.js 16 + React 19 + Prisma 7 +
Better Auth 1.4 + Tailwind v4 + shadcn/ui** application whose only implemented
vertical slice is **single-user authentication plus a static dashboard shell**.

The public README markets features (Workflow Builder, RBAC, Task Pool, Telegram
notifications) that **do not exist in code yet**. The MVP work is therefore to
build those features on top of the existing, sound foundation rather than to
rewrite the project.

## 2. Current architecture

```
app/
  (main)/                     marketing shell (Header + landing page)
  dashboard/auth/             login page (redirects if session exists)
  dashboard/(protected)/      session-guarded dashboard shell + sidebar
    page.tsx                  dashboard — HARD-CODED mock data
    settings/page.tsx         read-only profile
  api/auth/[...all]/          Better Auth handler
features/
  auth/                       useAuth hook, zod login schema, zustand stores
  permission/                 role/permission catalogue (CLIENT-ONLY, not enforced)
  user/                       userRepository, useUserStore
shared/
  components/ui/              shadcn/ui primitives (15 components)
  components/...              auth card, dashboard sidebar, header
  lib/                        auth.ts, auth-client.ts, prisma.ts, utils.ts
prisma/
  schema/{base,auth,user}     Session, Account, Verification, User, Role enum
  seed.ts                     creates a root ADMIN account
```

### Stack (as found)

| Area | Package | Version |
| --- | --- | --- |
| Framework | next | 16.1.6 |
| UI runtime | react / react-dom | 19.2.3 |
| ORM | @prisma/client + @prisma/adapter-pg | 7.4.1 |
| Auth | better-auth | 1.4.18 |
| Styling | tailwindcss | 4.x |
| Validation | zod | 4.3.6 |
| State | zustand | 5.0.11 |
| Forms | react-hook-form + @hookform/resolvers | 7.71.1 / 5.2.2 |
| Language | typescript | 5.x |
| Lint | eslint + eslint-config-next | 9 / 16.1.6 |

## 3. Findings

### 3.1 Correctness / functional gaps
1. **Dashboard uses fake data.** `StatsCard`/task/activity arrays are hard-coded
   literals with a `// TODO: Заменить на реальные данные` comment.
2. **"Log Out" does nothing.** The sidebar `DropdownMenuItem` has no handler.
3. **No registration UI.** Only `signIn.email` is wired; `auth.api.signUpEmail`
   exists but is reachable only via the seed script.
4. **No tenant / organization model.** All users share one global namespace;
   there is no workspace isolation at all.
5. **Only 3 roles** (`ADMIN`/`MANAGER`/`USER`) and **no server-side enforcement** —
   `usePermission` runs entirely in the browser. Any server code path would be
   open to any authenticated user.
6. **`loginSchema` is not translated** (Russian messages) while the rest of the
   app is English.
7. **Missing routes** referenced by the sidebar (`/dashboard/processes`,
   `/dashboard/tasks`, `/dashboard/documents`, `/dashboard/team`) — dead links.
8. **No workflow, task, task-pool, comment, activity or notification domain.**

### 3.2 Architecture / code quality
- `userRepository` uses raw `prisma.user.*` with no tenant scope; exposes
  `findAll/create/delete` that are unused and unsafe to expose as-is.
- Business logic and data access are not separated (no server actions /
  service layer). `features/*` mixes client stores with repository code.
- `useAuth` performs a client-only session bootstrap; protected pages rely on
  the server layout session check (good) but there is no reusable server helper.
- Prisma client is instantiated once but **not guarded against dev hot-reload**
  (`globalThis` singleton pattern missing).
- `next-env.d.ts`, `.env`, `.husky` are git-ignored (fine); no `.env.example`.
- `@types/node` is `^20` while the runtime and lockfile use Node 24.

### 3.3 Security
- **No server-side authorization anywhere.** Every future mutation must add it.
- `BETTER_AUTH_SECRET` is not documented/required — Better Auth will derive a
  weak secret in production.
- `auth-client`/`auth` read `process.env.BASE_URL!` (non-null asserted); a
  missing value yields a runtime crash instead of a clear error.
- No input validation on the server (no zod schemas outside auth login).
- No rate-limiting / idempotency on mutations (relevant for Task Pool claims).
- 42 `npm audit` findings (1 low / 10 moderate / 28 high / 3 critical), mostly in
  transitive dev tooling and the current Next/Better-Auth versions.

### 3.4 Tooling / testing
- **No test infrastructure at all** (no test runner, no tests).
- No `typecheck`/`test` scripts; no CI.
- `docs/` does not exist.

## 4. What is already good (keep)
- Clean App Router structure, strict TypeScript, no `any` leaks.
- shadcn/ui is set up correctly (`components.json`, CSS variables, dark theme,
  new-york style, all base primitives present).
- Better Auth is wired correctly through the Prisma adapter with the
  `prisma-client` generator + `@prisma/adapter-pg` (Prisma 7 native engine-less).
- Server-guarded route group `(protected)` already redirects unauthenticated
  users — the right place to add org/role context.
- `tsc --noEmit` and `eslint` pass on the baseline.

## 5. Technical debt register

| ID | Item | Severity | Planned stage |
| --- | --- | --- | --- |
| TD-01 | Dependencies outdated, 3 critical advisories | High | B |
| TD-02 | No tenant model / org isolation | Critical | C |
| TD-03 | No server authorization helpers | Critical | D |
| TD-04 | No workflow/publish/versioning | High | E |
| TD-05 | No task lifecycle / atomic claim | High | F |
| TD-06 | No comments/activity/notifications | Medium | G |
| TD-07 | Dashboard mock data | Medium | H |
| TD-08 | UI inconsistencies, dead buttons, dead links | Medium | I |
| TD-09 | No tests | High | J |
| TD-10 | No docs / `.env.example` | Medium | A/J |
| TD-11 | Missing Prisma dev singleton | Low | C |
| TD-12 | Missing `BETTER_AUTH_SECRET` requirement | High | D |

## 6. MVP scope decision

The MVP delivers one complete, secure, vertical slice:

> register → create an organization → build a linear workflow → publish it →
> run an instance → claim/complete generated tasks → comment/see history →
> receive notifications → see real KPIs on the dashboard.

Full BPMN, branching graphs, background job infrastructure, Telegram, billing,
AI generation and analytics are explicitly **out of scope**.

See `MVP_ROADMAP.md` for the staged plan and `DEPENDENCY_AUDIT.md`,
`SECURITY.md`, `TESTING.md`, `ARCHITECTURE.md` for the delivered detail.
