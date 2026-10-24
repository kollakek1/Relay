# Changelog

All notable changes to Relay are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
While the version is below `1.0.0`, the database schema and the public API may
still change between minor releases; every such change is called out under
**Breaking changes** with upgrade instructions.

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-10-24

The first public release of Relay. Everything below describes the state of the
project at this tag; there was no earlier tagged release.

### Added

- **Workflow engine** — create linear workflows, add steps, mark a step as a
  task or an approval, attach form fields and skip conditions, then publish an
  immutable version. Instances always run against the version they started with.
- **Approvals** — `ANY` (first decision wins) and `ALL` (every eligible approver
  decides) modes, with approve / request-changes / reject outcomes and a decision
  log.
- **Task pool** — unassigned tasks are claimed with a single atomic update, so
  two people can never hold the same task.
- **Organizations and roles** — `OWNER > ADMIN > MEMBER`, invitations with
  hashed single-use expiring tokens, multiple workspaces, ownership transfer and
  an admin audit log.
- **Collaboration** — comments, watchers, tags, task dependencies, task
  reopening, and an append-only activity trail.
- **Notifications** — in-app notifications for assignment, comments, approvals,
  invitations and SLA reminders, with an unread count.
- **Automation rules** — react to domain events with `notify_role`, `add_tag`,
  `set_priority` or `create_task`.
- **Transactional outbox and webhooks** — HMAC-SHA256 signed deliveries with a
  timestamp, retries with exponential backoff and jitter, a dead-letter state, and
  a requeue path.
- **Public API v1** — scoped, hashed API keys against `/api/v1` for workflows,
  instances and tasks, with pagination, uniform errors and per-key rate limits.
- **Analytics** — throughput, completion and overdue rates, cycle time, and step
  bottlenecks isolated per workflow.
- **Search and CSV export** — tenant-scoped global search and bounded CSV export
  that neutralises spreadsheet formula injection.
- **English and Russian interface** — a typed dictionary i18n system with a
  remembered language preference, plus bilingual documentation and API reference.
- **Public site and documentation** — a marketing landing page, a docs centre
  under `/docs`, an interactive `/api-reference`, and an OpenAPI 3.1 document
  served at `/api/openapi` and validated in CI.
- **Open-source governance** — MIT license, contributing guide, code of conduct,
  security policy, issue and pull request templates.
- **Automated checks** — lint, strict types, Prisma validation and migrations on
  a throwaway database, unit and integration tests, OpenAPI validation,
  translation-completeness checks, a production build, and a Playwright browser
  smoke test, all in CI.

### Changed

- The Prisma client is generated from `prisma/schema` and is no longer committed;
  `npm install` and `npm run build` generate it automatically.
- Cron endpoints (`/api/jobs/*`) accept the secret only as
  `Authorization: Bearer …`, and only via `POST`.
- CSV exports are produced through a shared, injection-safe helper.
- Analytics metrics are scoped per workflow rather than across the workspace.

### Fixed

- An outbox event is no longer marked processed before its webhook fan-out and
  automation dispatch have succeeded.
- Concurrent job runs can no longer process the same event or delivery twice,
  and an interrupted run is recovered when its lease expires.
- Delivery and automation failures are retried with backoff and, once exhausted,
  dead-lettered and visible instead of silently lost.
- Per-workflow overdue rates no longer leak across workflows that share step
  numbers, and step bottlenecks are keyed by workflow and step.
- Invitation acceptance is atomic and single-use.

### Security

- **Seed** — no default credentials; the seed refuses missing, short or
  placeholder passwords, never prints the password, and creates demo data only
  when explicitly opted in outside production.
- **Cron authentication** — secrets are never accepted from a query string, are
  compared in constant time, and state-changing jobs are `POST`-only.
- **SSRF** — outbound webhook and automation requests validate the scheme,
  reject embedded credentials and non-allow-listed ports, block loopback,
  private, link-local, multicast and cloud-metadata addresses (including
  IPv4-mapped, NAT64 and 6to4 forms), re-check every address returned by DNS,
  never follow redirects, and bound the response size and time.
- **CSV formula injection** — cells starting with `=`, `+`, `-` or `@` (including
  after leading whitespace or control characters) are neutralised while real
  numbers and dates are preserved.
- **API keys** — stored only as SHA-256 hashes, scoped, revocable, and acting
  with the current role of the account that created them.
- **Dependencies** — see the advisory notes in `docs/DEPENDENCY_AUDIT.md`.

### Breaking changes

This is the first release, so there is no upgrade path from a previous version.
Two behaviour changes are worth calling out for anyone who ran an early
checkout from `main`:

- **Cron calls must use the `Authorization` header.** `?secret=…` is rejected.
  Update your scheduler to `curl -X POST … -H "Authorization: Bearer $CRON_SECRET"`.
- **The seed requires an explicit password.** `ROOT_PASSWORD` must now be
  supplied (and be reasonably strong) the first time the administrator account is
  created. The previously printed default password no longer exists.

### Known limitations

See [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) for the full,
current list. The most important ones at this release:

- Outbound delivery is **at-least-once**; receivers must deduplicate on the
  `x-relay-delivery` header. Exactly-once is not claimed.
- The SSRF guard uses resolve-then-check; a residual DNS-rebinding TOCTOU window
  remains (documented).
- Rate limiting uses fixed windows, not a sliding window.
- Email verification is disabled.
- Workflow execution is linear: there are no parallel branches, joins or BPMN
  gateways.
- Some deeper dashboard panels remain English-only (tracked in the limitations
  document).

### Upgrade / migration instructions

This is the first release; start from the quickstart in
[`docs/guides/QUICKSTART.md`](docs/guides/QUICKSTART.md). In short:

```bash
npm ci
npx prisma migrate deploy     # applies every migration, including this release's
ROOT_EMAIL=you@example.com ROOT_PASSWORD='a-strong-unique-password' npm run db:seed
npm run build && npm run start
```

Set `CRON_SECRET` and schedule both job endpoints (see
[`docs/guides/DEPLOYMENT.md`](docs/guides/DEPLOYMENT.md)).

[Unreleased]: https://github.com/kollakek1/Relay/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/kollakek1/Relay/releases/tag/v0.2.0
