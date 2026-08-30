# Security policy

WikiPulse is an example service, not a product with releases or long-term
support. Only the current state of `main` in
<https://github.com/yt-wikipulse/wikipulse> is maintained; older commits get no
fixes.

## Reporting a vulnerability

Report privately through GitHub: **Security → Advisories → Report a
vulnerability** in this repository. Do not open a public issue for a
vulnerability, and do not include real credentials or tokens in the report.

Useful in a report: what an attacker can reach, the steps that reproduce it,
and the commit you saw it on. A confirmed report is fixed in `main`.

## What is in scope

The code of this repository: the backend, the frontend, the pipeline jobs and
the deployment configuration under `deploy/`.

Out of scope: YTsaurus itself, the Wikipedia event stream, the Yandex Maps API,
and any cluster or host a fork of this project runs on. Those go to their own
maintainers.

## Notes for anyone running this code

- The YTsaurus token is read from the `YT_TOKEN` environment variable and is
  never written to the repository. A token that reached a commit or a log has
  to be revoked in the cluster, not just removed from the file.
- The deployment workflow shipped with this repository is an example: it
  publishes to whatever host the repository secrets point at. A fork either
  configures its own host and secrets or disables the workflow — see
  `deploy/README.md`.
- The backend deliberately returns Problem Details without internals: table
  paths, tokens and stack traces must not appear in an API response. A change
  that leaks them is a security bug, not a cosmetic one.
