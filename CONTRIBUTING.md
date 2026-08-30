# Contributing to WikiPulse

WikiPulse is an example of a service built on top of YTsaurus: a live map of
Wikipedia edits plus a dashboard over their history. Patches, bug reports and
forks are welcome — the project is meant to be copied and modified.

Project home: <https://github.com/yt-wikipulse/wikipulse>

## Before you start

- Read [`docs/README.md`](docs/README.md) — the documentation index.
- Read the contract of the boundary you are touching in
  [`docs/contracts/`](docs/contracts/). If code and contract disagree, that is
  a bug in the code.
- Run the project locally:
  [`docs/runbooks/local-setup.md`](docs/runbooks/local-setup.md).

Documentation under `docs/` is in Russian; issues and pull requests are
accepted in Russian or English.

## Code style

- Comments are written in Russian and only as doc comments: TSDoc in the
  frontend, Javadoc in the backend, docstrings in the pipeline. Line comments
  (`//`, `#`) are not used.
- Field, table and endpoint names stay in the spelling of the upstream source.
- Do not add a dependency for something a few lines of code already do.
- Update the documentation in the same pull request as the code.

## Checks before review

```bash
cd frontend && pnpm test && pnpm lint && pnpm build
cd backend  && SPRING_PROFILES_ACTIVE=mock ./mvnw test
```

## Licensing of contributions

By contributing you agree that your work is published under the Apache License
2.0, the license of this repository. Do not add license headers to source
files — the repository-level [LICENSE](LICENSE) and [NOTICE](NOTICE) cover them.

If your change vendors or bundles a third-party file, add it to
[THIRD-PARTY.md](THIRD-PARTY.md) in the same pull request.
