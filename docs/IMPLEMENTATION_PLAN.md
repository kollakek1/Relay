# Relay — Implementation Plan (V2 hardening pass)

Ordered so that correctness and security land before cosmetics. Each item lists
concrete, checkable work. Status reflects what was actually verified — see
`docs/PRODUCTION_HARDENING.md` for the evidence.

Legend: ✅ done & verified · 🚧 in progress · ⬜ not started

---

## Phase A — Security & reliability ✅

- [x] **A1 Seed hardening** — no default/weak root credentials, password never
      logged, demo data opt-in and off in production, unsafe config refused.
- [x] **A2 Cron auth** — `Authorization: Bearer` only, timing-safe compare,
      POST-only, shared guard, failed runs release their idempotency key.
- [x] **A3 Outbox/automation reliability** — atomic `FOR UPDATE SKIP LOCKED`
      claims with leases, bounded retries with backoff + jitter, explicit states,
      dead-letter + requeue, transactional actions, batch isolation.
- [x] **A4 Webhook concurrency** — idempotent fan-out via
      `unique(endpointId, eventId)`; single-attempt delivery guarded by a lease.
- [x] **A5 CSV Formula Injection** — shared safe cell helper preserving numbers
      and dates; unit + integration tests.
- [x] **A6 Analytics correctness** — per-workflow overdue isolation;
      bottlenecks keyed by `(workflowId, stepOrder)`; divide-by-zero guarded.
- [x] **A7 SSRF** — resolve-then-check, IP classification, port policy, no
      redirects, bounded responses.
- [x] **A8 Extra review** — invitation race, tenant isolation, RBAC, API-key
      scopes, webhook replay, no secret leakage.
- [x] **A9 Regression tests** — job-auth, seed, csv, ssrf, outbox-reliability,
      security-regression (+ analytics isolation).

## Phase B — Prisma & clean Git ✅

- [x] Schema fragments, migrations, seed and `prisma.config.ts` stay tracked.
- [x] `prisma/generated/` untracked and ignored (without ignoring `prisma/`,
      `schema/` or `migrations/`).
- [x] Reproducible generation: `postinstall` + `prebuild` run `prisma generate`;
      verified by moving the generated client aside, regenerating and
      typechecking.
- [x] CI regenerates from a clean checkout, validates the schema, applies
      migrations to a throwaway database and no longer ships seed credentials.
- [x] Database workflow documented in `README.md` and `docs/ARCHITECTURE.md`.

## Phase C — i18n foundation ✅

- [x] Dependency-free, typed dictionary i18n (`shared/i18n/**`); no locale URL
      segment, so existing routes, invite links and API keys keep working.
- [x] `messages/en.ts` (source of truth) + `messages/ru.ts` typed as `Messages`,
      so a missing key is a compile error.
- [x] Locale resolution: cookie → `Accept-Language` → default; persisted.
- [x] Language switcher on the public site, in the docs/API reference and in the
      dashboard sidebar; `router.refresh()` re-renders server components.
- [x] Locale-aware date/number/percent/duration/relative formatting.
- [x] `npm run i18n:check` (parity, empties, plurals, untranslated report).

## Phase D — Localization coverage ✅ complete

- [x] Public marketing site fully localized (EN/RU).
- [x] Documentation pages and API reference fully localized, including OpenAPI
      `x-i18n` descriptions.
- [x] App chrome: sidebar navigation, account menu/logout, dashboard headings and
      empty states, authentication, task status/priority labels.
- [x] **Every dashboard surface**: workflow list/builder/version history,
      templates, task pool/tasks/filters/table, task detail (form, approvals,
      decisions, comments, activity), team/members, invitations, organization
      settings, API keys, webhooks, automations, analytics, search,
      notifications, invitations page and toasts.
- [x] Server error messages localized by `ActionResult` code in `useAction`; Zod
      schema factories localize client validation messages.
- [x] CLDR pluralization (`one`/`few`/`many`/`other`) selected with
      `Intl.PluralRules`.
- [x] SEO metadata localized; `<html lang>` follows the active locale.
- [x] 836 keys with type-enforced parity; `npm run i18n:check` in CI.
- [x] Intentionally untranslated: API scopes, webhook event names, trigger/action
      ids, condition operators, field-type values, timezone ids, HTTP codes, URLs
      and code fragments (recorded in `docs/KNOWN_LIMITATIONS.md`).

## Phase E — Public site & UX ✅

- [x] Landing page with the full section set (hero, preview, features,
      lifecycle, work, API, security, developers, quickstart, FAQ, CTA, footer).
- [x] `/features`, `/docs`, `/docs/[slug]`, `/api-reference`, `/changelog`,
      `/privacy`, `/terms`, localised 404 and a route error boundary.
- [x] Semantic HTML, keyboard-operable nav/FAQ/copy buttons, focus states,
      light/dark, responsive.
- [x] `robots.txt`, `sitemap.xml`, canonical/OG metadata, noindex for private
      areas.
- [x] Only working links/CTAs — no placeholder buttons.

## Phase F — Documentation & API Reference ✅

- [x] `docs/guides/{QUICKSTART,DEPLOYMENT,CONFIGURATION,WORKFLOWS,AUTOMATIONS,INTEGRATIONS}.md`
      plus updated ARCHITECTURE / SECURITY / THREAT_MODEL / TESTING /
      INCIDENT_RESPONSE / KNOWN_LIMITATIONS.
- [x] `docs/api/openapi.json` (OpenAPI 3.1) describing only implemented routes.
- [x] Interactive `/api-reference` with search, groups, parameter tables,
      response codes, copyable curl + JavaScript examples and a download link.
- [x] `npm run api:check` validates structure, `$ref` resolution and spec ↔
      route-file correspondence in CI.

## Phase G — Final verification ✅

- [x] Full unit + integration suite (23 files / 139 tests).
- [x] Prisma clean generation and migration apply.
- [x] Production build.
- [x] Manual RU/EN and page checks via the browser E2E (public site, docs, API
      reference, 404) plus full workflow lifecycle.
- [x] README, roadmap and limitations updated.
- [x] Final report written in `docs/PRODUCTION_HARDENING.md`.

## Phase H — Open-source launch ✅

- [x] LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, root SECURITY policy.
- [x] `.github/ISSUE_TEMPLATE/{bug_report,feature_request,config}.yml`,
      `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`.
- [x] README rewritten as the project home page (badges, TOC, features, real
      screenshots, architecture, quickstart, self-hosting, docs index, API,
      testing, contributing, security, status).
- [x] `CHANGELOG.md` (Keep a Changelog) and `docs/RELEASE.md`.
- [x] Version `0.2.0`; OpenAPI `info.version`/license aligned.
- [x] `npm run docs:check` (relative link + anchor validation) in CI.
- [x] `npm run screenshots` regenerates the README images from a real instance.
- [x] CI hardened: least privilege, concurrency, `workflow_dispatch`,
      docs-link check, failure-only artifacts, and the Playwright job runs on
      PRs and `main` (no longer permanently disabled).
- [x] Historical audit/roadmap docs annotated so they cannot mislead.
- [ ] ⬜ GitHub-side steps that require API/web access not available in this
      environment: repository description and topics, branch protection ruleset,
      and publishing the GitHub Release. Exact steps are in the final report and
      `docs/RELEASE.md`.
