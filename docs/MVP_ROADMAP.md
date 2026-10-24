# Relay — MVP Roadmap

_Owner: engineering · Status tracking: checkboxes updated as stages land._

## Goal

Ship a stable, secure, testable MVP covering the full happy path:

**register → organization → workflow draft → publish (versioned) → run instance →
tasks generated → claim from pool (atomic) → complete → comments/activity →
notifications → real dashboard.**

## Non-goals (must not block the MVP)

Full BPMN graphs, visual branching, distributed job queues, microservices,
external integrations (Telegram), enterprise billing, advanced analytics,
AI process generation.

## Guiding rules

- Build on the existing architecture; no rewrite.
- Every mutation is authorized **on the server**; never trust the client.
- Every list/detail screen reuses shadcn/ui and real data.
- No new UI library; add shadcn components the project way.
- Each stage ends with checks (`tsc`, `eslint`, tests, build where relevant)
  and its own conventional commit.

## Stages

### Stage A — Audit & roadmap ✔
- Inspect git state, architecture, deps, UI, DB. ✅
- Deliver `docs/MVP_AUDIT.md`, `docs/MVP_ROADMAP.md`, `docs/ARCHITECTURE.md`. ✅

### Stage B — Dependencies & build
- Update Next/React/Better-Auth/Prisma/Tailwind/zod/tooling to latest stable.
- Resolve breaking changes (Better Auth 1.7, `@hookform/resolvers` 6, etc.).
- Deliver `docs/DEPENDENCY_AUDIT.md`.
- Checks: `tsc`, `eslint`, `prisma generate`, production build.

### Stage C — DB & foundation
- Add models: `Organization`, `Membership`, `Workflow`, `WorkflowVersion`,
  `WorkflowStep`, `ProcessInstance`, `Task`, `TaskActivity`, `Comment`,
  `Notification`.
- Indexes, FKs, cascade rules, enums (`OrgRole`, `WorkflowStatus`, `TaskStatus`,
  `Priority`, `NotificationType`, `ActivityType`).
- Prisma dev singleton; migration applied to the test database.
- Deliver core server helpers (`getSession`, `requireUser`, `requireOrg`,
  `requireRole`, org-scoped repository pattern).
- Checks: migration applied, seed works, `tsc`.

### Stage D — Auth & organizations
- Registration flow; org creation on first login; membership roles
  `OWNER`/`ADMIN`/`MEMBER`.
- Server authorization helpers + zod input schemas.
- `BETTER_AUTH_SECRET` required & documented; `.env.example`.
- Tests: registration/login, tenant isolation, role checks, foreign-entity access.
- Commit: `feat(auth): enforce organization and role permissions`.

### Stage E — Workflow engine
- Workflow CRUD (draft), step editing, reorder.
- Publish → immutable `WorkflowVersion` snapshot with validation.
- Edit-after-publish protection for active instances.
- Run instance → create tasks per step.
- Commit: `feat(workflows): implement workflow publishing and versioning`.

### Stage F — Tasks & Task Pool
- Task lifecycle (`PENDING → CLAIMED → IN_PROGRESS → DONE` + `CANCELLED`),
  assignment, due dates, transitions validated server-side.
- Task Pool with **atomic claim** via conditional `updateMany` guard.
- Search/sort/filter; task detail with process + history.
- Tests: state machine, concurrent claim (race), foreign access.
- Commit: `feat(tasks): implement task lifecycle and atomic task pool`.

### Stage G — Activity, comments & notifications
- `Comment` create/list; `TaskActivity` appended on status/assignee changes.
- In-app `Notification` with unread count, tenant-scoped.
- Commit(s): `feat(activity): ...`, `feat(notifications): ...`.

### Stage H — Dashboard & search
- Real KPIs (my tasks, pending pool, completed today, active instances,
  overdue, recent events) via org-scoped aggregations.
- Empty/loading/error states.
- Commit: `feat(dashboard): display real workflow and task data`.

### Stage I — UI / shadcn/ui
- Consistent tokens/spacing/typography; responsive + keyboard accessible.
- Remove mock data and dead handlers; wire every button.
- Commit: `style(ui): align application with shadcn/ui`.

### Stage J — Tests & documentation
- Full check suite; fix regressions.
- Update `README.md`, `.env.example`, all `docs/*`.
- Commit(s): `test: cover critical MVP scenarios`, `docs: update ...`.

## Definition of Done (MVP)

- [ ] Audit + roadmap committed.
- [ ] Dependencies on latest stable; lockfile current; breaking changes fixed.
- [ ] Happy path works end-to-end.
- [ ] Publish + versioning correct; active instances protected.
- [ ] Task Pool atomic under concurrency (tested).
- [ ] Roles + org isolation enforced server-side (tested).
- [ ] Comments, activity, notifications use real data.
- [ ] Dashboard/search/filters use real data.
- [ ] New & changed UI follows shadcn/ui.
- [ ] No known critical runtime vulnerabilities.
- [ ] Critical scenarios covered by tests.
- [ ] `tsc`, `eslint`, tests, production build verified.
- [ ] Docs match code; no secrets committed.
- [ ] One commit per completed stage.
