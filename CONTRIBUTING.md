# Contributing to Relay

Thanks for taking the time to contribute. This document explains how to get a
change merged with as little friction as possible.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — open an issue using the bug report template with a
  reproduction and your environment.
- **Request a feature** — open an issue with the feature template; explain the
  problem before the solution.
- **Improve the docs** — README, `docs/`, or the in-app guides under
  `app/(main)/docs` and `shared/i18n/content.ts`.
- **Send a pull request** — see below.
- **Report a vulnerability privately** — see [SECURITY.md](SECURITY.md). Never
  open a public issue for a security problem.

## Development setup

Requirements: Node.js 20+, PostgreSQL 14+.

```bash
git clone https://github.com/kollakek1/Relay
cd Relay
npm install                # runs `prisma generate` via postinstall

cp .env.example .env       # set DATABASE_URL and BETTER_AUTH_SECRET
npm run db:deploy          # apply migrations
ROOT_EMAIL=you@example.com ROOT_PASSWORD='a-strong-unique-password' npm run db:seed
npm run dev                # http://localhost:3000
```

The generated Prisma client is **not** committed. Never commit
`prisma/generated/`.

## Checks you must run before opening a PR

```bash
npm run db:validate   # Prisma schema is valid
npm run lint
npm run typecheck
npm run api:check     # OpenAPI spec matches the implemented routes
npm run i18n:check    # RU/EN key parity
npm test              # unit + integration (needs DATABASE_URL)
npm run build
```

`npm test` and `npm run test:e2e` need a real PostgreSQL database. Point them at
a **dedicated test database**, never at data you care about — the integration
tests create and delete their own rows.

Optional browser smoke test (starts the dev server and drives a full workflow):

```bash
E2E=1 npm run test:e2e
```

## Project conventions

- **Layering** — `app/` (routes) → `features/<domain>/{schemas,server,actions,components}`.
  Only `features/<domain>/server` talks to Prisma, and every query is scoped by
  `organizationId`.
- **Types** — TypeScript is strict. Do not weaken it (no `any` escapes, no
  `@ts-ignore`) to make a check pass.
- **Validation** — every server action validates its input with Zod.
- **Server actions** — resolve the context server-side (`requireContext` /
  `requireRole`), call a service, and return an `ActionResult`. Never trust ids
  or roles from the client.
- **Migrations** — change `prisma/schema/*.prisma`, then create a migration
  (`npm run db:migrate`) and commit the SQL. All added columns must be nullable
  or defaulted so the migration applies to a populated database.
- **i18n** — every user-facing string goes through `t()`. `en.ts` is the source
  of truth; `ru.ts` is typed as `Messages`, so a missing key fails typecheck.
  Run `npm run i18n:check`. Do not translate technical identifiers, HTTP codes
  or API field names. Server actions return an `ActionResult` whose `code` is
  translated in `useAction`, so never surface a raw server message to the user.
  Client forms with a `zodResolver` should build their schema from the localized
  factory (`createXSchema(t)` inside `useMemo(() => …, [t])`) so validation
  messages are translated too.
- **Security** — never log secrets, never accept secrets from a URL, keep
  outbound requests behind the SSRF guard, and add a regression test for any
  security fix.
- **Tests** — add a test for any behaviour change. Prefer exercising the service
  layer with an explicit `Context` (see `tests/helpers/db.ts`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) style, matching
the existing history:

```
fix(security): reject cron secrets from the query string
feat(webhooks): add a delivery requeue action
docs(api): describe the claim endpoint's conflict response
```

Keep commits focused. Update `CHANGELOG.md` under `Unreleased` for user-visible
changes.

## Pull requests

- One logical change per PR; keep the diff reviewable.
- Fill in the pull request template (summary, type of change, how it was tested,
  checklist).
- Make sure CI is green. Do not disable a check to get a green build — fix the
  cause.
- Link the issue the PR addresses.
- Screenshots or a short recording help a lot for UI changes.
- Be patient and kind in review.

## Project scope

Relay aims to be a focused workflow engine. Please keep that in mind: new
dependencies, new subsystems, or broad refactors need a clear justification in
the PR description, and may be declined if they are not needed to fix a real
problem covered by the roadmap. Breaking changes to the public API
(`/api/v1`) or the database schema need an explicit migration plan.

## License

By contributing, you agree that your contributions are licensed under the
project's [GNU Affero General Public License v3](LICENSE). Because the AGPL is a
network-copyleft license, running a modified Relay as a network service obliges
you to offer the corresponding source to its users.
