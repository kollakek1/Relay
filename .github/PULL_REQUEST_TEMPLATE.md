# Pull request

Thanks for contributing to Relay. Please fill this in — it makes review much
faster, and CI must be green before merge.

## Summary

<!-- What does this change, and why? Link the issue it addresses: "Closes #123". -->

## Type of change

<!-- Tick the ones that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behaviour, the public API, or the database schema)
- [ ] Security fix (see SECURITY.md — do not describe exploit details in a public PR)
- [ ] Documentation only
- [ ] Refactor / internal change (no behaviour change)
- [ ] Dependency or CI change

## How was this tested?

<!-- Exact commands and the result. For UI changes, add a screenshot or a short recording. -->

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test` (unit + integration, against a dedicated test database)
- [ ] `npm run api:check` (if the API changed)
- [ ] `npm run i18n:check` (if any user-facing string changed)
- [ ] `npm run build`
- [ ] `E2E=1 npm run test:e2e` (if the change is user-facing and observable in the browser)

## Database changes

<!-- Delete this section if there are no schema changes. -->

- [ ] New migration added under `prisma/migrations/` and committed
- [ ] Every added column is nullable or has a default (so it applies to a populated database)
- [ ] `npx prisma validate` passes

## Checklist

- [ ] My change is scoped to one logical concern.
- [ ] New and existing tests pass, and I did not disable a check to get a green build.
- [ ] I added or updated tests for the behaviour I changed.
- [ ] User-facing strings go through `t()` and both `en.ts` and `ru.ts` are updated.
- [ ] No secrets, credentials, `.env` files, or personal data are included.
- [ ] `CHANGELOG.md` is updated under `Unreleased` for user-visible changes.
- [ ] Documentation (`README.md` / `docs/`) is updated if behaviour or configuration changed.
- [ ] I have read and agree to the [Code of Conduct](../CODE_OF_CONDUCT.md).
