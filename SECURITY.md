# Security policy

## Supported versions

Relay is pre-1.0. Security fixes land on `main` and in the most recent release.
There are no long-term support branches yet.

| Version | Supported |
| --- | --- |
| Latest release (`0.2.x`) | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's
[private vulnerability reporting](https://github.com/kollakek1/Relay/security/advisories/new)
(Security → Advisories → Report a vulnerability). If you cannot use that, open a
minimal issue that only asks for a private channel — do not include exploit
details, secrets, or personal data in it.

Please include:

- What the issue is and the impact you believe it has.
- The affected version or commit.
- Reproduction steps or a proof of concept.
- Any mitigation you have already identified.

## What to expect

This is a community project maintained by volunteers, so these are targets, not
guarantees:

- **Acknowledgement** within 7 days.
- **Assessment and a plan** within 30 days for confirmed issues.
- Credit in the release notes if you want it.

Please give us a reasonable window to release a fix before any public
disclosure. We will coordinate the disclosure timeline with you.

## Scope

In scope:

- Authentication, session and authorization flaws.
- Cross-tenant (organization) data disclosure or modification.
- Injection, SSRF, XSS, CSRF, open redirect, unsafe deserialization.
- Secret exposure (API keys, webhook signing secrets, `CRON_SECRET`).
- Integrity or reliability flaws that can lose or duplicate work.

Out of scope:

- Reports about the *deployment* you or someone else runs (databases, reverse
  proxies, hosting).
- Missing security headers that have no concrete impact, or issues that require
  an already-compromised host/browser.
- Automated scanner output without a demonstrated, reproducible impact.
- Social engineering, physical access, or denial of service by traffic volume.

## Hardening reference

The controls that exist today, the residual risks, and the threats explicitly
out of scope are documented in
[`docs/SECURITY.md`](docs/SECURITY.md) and
[`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md). Known limitations are listed in
[`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md) — please check those
before reporting something already documented as a known trade-off.

## Deployment responsibilities

Relay is self-hosted. Whoever runs an instance is responsible for: keeping
`BETTER_AUTH_SECRET` and `CRON_SECRET` strong and secret, using TLS with a
verified certificate, applying database migrations, restricting database access,
and upgrading the application. Do not run production with the example
configuration.
