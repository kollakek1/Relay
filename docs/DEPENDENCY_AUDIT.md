# Relay — Dependency Audit & Upgrade Report

_Date: 2026-10-24 · Package manager: **npm** (lockfile v3) · Node: **24.14.1**_

## 1. Summary

| Metric | Before | After |
| --- | --- | --- |
| `npm audit` total | **42** | **6** |
| critical | **3** | **0** |
| high | 28 | 4 |
| moderate | 10 | 1 |
| low | 1 | 1 |

The three critical advisories were in `better-auth@1.4.18` (OAuth/account-takeover
class) and `next@16.1.6` (RSC/Server-Action/cache-poisoning class). Both were
resolved by upgrading to the latest stable releases. The 6 remaining findings are
transitive **dev-only** dependencies (`@babel/core`, `@humanfs/node`,
`brace-expansion`, `fast-uri`, `flatted`, `picomatch`) pulled in by lint/build
tooling; none ship to the runtime bundle. `npm audit fix` is not applied because
it would force breaking major upgrades of those tools for no runtime benefit —
see §5.

## 2. Version changes

### Runtime dependencies

| Package | Before | After |
| --- | --- | --- |
| next | 16.1.6 | **16.4.3** |
| react / react-dom | 19.2.3 | **19.3.1** |
| @next/env | ^16.1.6 | ^16.4.3 |
| better-auth | 1.4.18 | **1.7.12** |
| @prisma/client | 7.4.1 | **7.10.1** |
| @prisma/adapter-pg | 7.4.1 | **7.10.1** |
| zod | 4.3.6 | **4.6.7** |
| lucide-react | 0.563.0 | **1.61.0** |
| radix-ui | 1.4.3 | **1.8.1** |
| react-hook-form | 7.71.1 | **7.91.0** |
| @hookform/resolvers | 5.2.2 | **5.9.2** |
| sonner | 2.0.7 | **2.0.8** |
| tailwind-merge | 3.4.0 | **3.7.0** |
| zustand | 5.0.11 | **5.0.16** |
| clsx / cva / next-themes / pg | unchanged | unchanged |

### Dev dependencies

| Package | Before | After |
| --- | --- | --- |
| prisma | 7.4.1 | **7.10.1** |
| tailwindcss / @tailwindcss/postcss | 4.x | **4.3.3** |
| typescript | 5.x | **5.9.3** |
| eslint | ^9 | **9.39.5** |
| eslint-config-next | 16.1.6 | **16.4.3** |
| @types/node | ^20 | **^24.19.2** (matches Node 24 runtime) |
| @types/react / @types/react-dom | ^19 | **^19.3.0** |
| lint-staged | 16.2.7 | **17.6.0** |
| prettier | 3.8.1 | **3.9.10** |
| prettier-plugin-tailwindcss | 0.7.2 | **0.8.1** |
| shadcn (CLI) | 3.8.4 | **4.22.1** |
| tw-animate-css | 1.4.0 | 1.4.0 |
| **vitest** | — | **5.0.5** (added) |
| **tsx** | — | **4.x** (added, for the Prisma seed) |

## 3. Decisions & rationale

- **Prisma stays on the 7.x line (7.10.1).** The `latest` dist-tag currently
  points at `8.0.0-rc.*`, a **prerelease**. The project relies on the Prisma 7
  `prisma-client` generator + `@prisma/adapter-pg` driver adapter; staying on the
  7.x line is the latest *stable, compatible* choice.
- **`@hookform/resolvers` pinned to 5.9.2, not 6.x.** v6 adds an optional `effect@^4`
  peer that conflicts with Prisma's `effect@^3` in the same tree (`npm` ERESOLVE).
  5.9.2 is the latest 5.x and fully supports zod v4 (the `zodResolver` API used
  here is unchanged).
- **TypeScript stays on 5.9.3** rather than the new 7.x native compiler, because
  the `typescript-eslint` toolchain used by `eslint-config-next` is validated
  against the 5.x line.
- **ESLint stays on 9.39.5** (latest 9.x maintenance) to match the peer range of
  `eslint-config-next@16.4.3`.
- **No `--force` / `--legacy-peer-deps` was used.** The one conflict
  (`@hookform/resolvers` v6) was resolved by choosing a compatible version.

## 4. Breaking changes handled

1. **lucide-react 0.x → 1.0 removed brand icons.** `GithubIcon` no longer exists;
   `shared/components/props/Header.tsx` now uses `CodeIcon`. (Brand glyphs were
   dropped upstream.)
2. **`eslint-config-next@16.4.3` enforces `react-hooks/set-state-in-effect`.**
   `shared/hooks/useMobile.ts` was rewritten with `useSyncExternalStore` instead
   of `setState` inside an effect — the idiomatic media-query subscription.
3. **Better Auth 1.4 → 1.7.** No source changes were required for the email/password
   + Prisma adapter usage, but `BETTER_AUTH_SECRET` is now treated as a required
   configuration value (added to `.env.example` and documented).
4. **Prisma 7.4 → 7.10.** Generator output regenerated; `@prisma/client` and
   `@prisma/adapter-pg` kept in lockstep. No code changes required.
5. **shadcn CLI 3 → 4** (tooling only; existing components in `shared/components/ui`
   remain compatible with the current Tailwind v4 tokens).

## 5. Remaining findings (accepted)

All six remaining advisories are transitive **build/lint-time** dependencies:

| Package | Severity | Path | Mitigation |
| --- | --- | --- | --- |
| brace-expansion | high | glob/minimatch chain (eslint/tooling) | dev-only, not shipped |
| fast-uri | high | ajv chain (eslint/tooling) | dev-only, not shipped |
| flatted | high | eslint flat-config parser | dev-only, not shipped |
| picomatch | high | micromatch chain (tooling) | dev-only, not shipped |
| @humanfs/node | moderate | eslint file walker | dev-only, not shipped |
| @babel/core | low | eslint parser | dev-only, not shipped |

They are tracked and will clear as the lint toolchain moves forward; forcing an
upgrade now would break `eslint-config-next` compatibility.

## 6. Verification performed after the upgrade

| Check | Command | Result |
| --- | --- | --- |
| Type check | `npx tsc --noEmit` | ✅ pass |
| Lint | `npm run lint` | ✅ pass (0 problems) |
| Prisma validate | `npx prisma validate` | ✅ schema valid |
| Prisma generate | `npx prisma generate` | ✅ client 7.10.1 |
| Migration | `npx prisma migrate deploy` | ✅ `20261024120000_init` applied |
| Seed | `npx prisma db seed` | ✅ root account + demo workspace |
| Production build | `npm run build` | ✅ Next 16.4.3, 7 routes |
| Audit | `npm audit` | 6 dev-only findings, 0 critical |
