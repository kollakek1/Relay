# Release process

How a Relay release is cut. It is written so that it can be followed by anyone
with write access, and so that the automated parts are reproducible.

## Versioning

Relay follows [Semantic Versioning](https://semver.org/). While the version is
below `1.0.0` the database schema and the public API may still change between
minor releases; such changes are listed under **Breaking changes** in
`CHANGELOG.md` with upgrade instructions.

Rules of thumb:

- `PATCH` — bug fixes and internal changes only.
- `MINOR` — new, backward-compatible functionality.
- `MAJOR` — breaking changes. Do not use `1.0.0` until the engine, the API and
  the schema are considered stable.

## Checklist

1. **Working branch.** Create `release/vX.Y.Z` from an up-to-date `main`.
2. **Version.** Set `"version"` in `package.json`, and the OpenAPI
   `info.version` in `docs/api/openapi.json` if the API contract changed.
3. **Changelog.** Move everything under `## [Unreleased]` into a new
   `## [X.Y.Z] - YYYY-MM-DD` section. Use the sections `Added`, `Changed`,
   `Fixed`, `Security`, `Breaking changes`, `Known limitations`, and
   `Upgrade / migration instructions`. Update the compare links at the bottom.
4. **Limitations.** Update `docs/KNOWN_LIMITATIONS.md` so it reflects reality —
   remove items that were fixed, add anything new that was knowingly accepted.
5. **Documentation.** Update the README badge/version claims if needed, and make
   sure `docs/guides/*` still match the code.

## Required checks

Run these locally; CI enforces them on the pull request.

```bash
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy          # against a disposable database

npm run lint
npm run typecheck
npm run api:check
npm run i18n:check
npm run docs:check
npm test
npm run build
E2E=1 npm run test:e2e             # against a migrated database + running server
```

Do not release with a failing check. Do not weaken a check to make it pass.

## Release steps

1. Commit the version, changelog and documentation updates on the release
   branch.
2. Open a pull request into `main`, let CI pass, review, and merge.
3. On the merged `main`, create an **annotated** tag:

   ```bash
   git checkout main
   git pull --ff-only
   git tag -a vX.Y.Z -m "Relay vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. Create the GitHub Release from the tag (`Releases → Draft a new release`),
   paste the changelog section for that version as the notes, and mark it as a
   **pre-release** while the project is below `1.0.0`.
5. Verify the release page: the tag points at the intended commit, the notes
   render, and links inside them resolve.

## Release notes template

```markdown
## Added
- …

## Changed
- …

## Fixed
- …

## Security
- …

## Breaking changes
- … (with what to do about it)

## Known limitations
- See docs/KNOWN_LIMITATIONS.md

## Upgrade / migration instructions
\`\`\`bash
npm ci
npx prisma migrate deploy
npm run build && npm run start
\`\`\`
```

## Artifacts

Relay is distributed as source, not as a binary artifact. A release is the git
tag, the GitHub Release notes, and the container-free instructions above. CI
does not publish anything to a registry.

## Rollback

- **Application code** — redeploy the previous tag or commit.
- **Migrations** — migrations are forward-only. If a schema change must be
  undone, restore the database backup taken before the deploy; do not hand-edit
  the database or use `prisma db push`/`migrate reset` against production.

## Post-release

- Confirm the CI run for the tagged commit is green.
- Confirm the README and the release page agree on the version.
- Announce it (release notes are the canonical announcement).
