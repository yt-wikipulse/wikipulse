# Contributing to WikiPulse

WikiPulse is an example of a service built on top of YTsaurus: a live map of
Wikipedia edits plus a dashboard over their history. Patches, bug reports and
forks are welcome — the project is meant to be copied and modified.

Project home: <https://github.com/yt-wikipulse/wikipulse>

## Before you start

- Read [`docs/README.md`](docs/README.md) — the documentation index.
- Read the contract of the boundary you are touching in
  [`docs/03-contracts/`](docs/03-contracts/). If code and contract disagree,
  that is a bug in the code, not in the contract.
- Run the project locally: [`docs/05-runbooks/local-setup.md`](docs/05-runbooks/local-setup.md).

Most of the documentation under `docs/` is in Russian; issues and pull requests
are accepted in Russian or English.

## Branches, commits, pull requests

Trunk-based: `main` is the only long-lived branch, everything else lives a day
or two.

- Branch name: `<type>/<issue>-<subject>`, for example `feat/14-sse-producer`.
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- The branch name is also the pull request title, and — after a squash merge —
  the commit subject in `main`. One line does all three jobs, and closed pull
  requests stay searchable by it.
- Details belong in the commit body or the pull request description, not in the
  subject.
- Rebase onto `main` before asking for review: `git pull --rebase origin main`.
- Delete the branch after the merge.

Do not create long-lived per-component branches, a `develop` branch, or
release branches. There is nothing to release from them.

## Changing a contract

A change to a document in [`docs/03-contracts/`](docs/03-contracts/) goes in its
own pull request and is merged **first**, before the implementation. Otherwise
two implementations race in the file that both sides read as the source of
truth.

## Code style

- **No comments in the code.** The reason behind a decision — the choice of a
  constant, a workaround, the limits of an approach, a deliberate
  simplification — goes into the documentation, anchored to a file and a symbol:
  [`docs/02-architecture/frontend-implementation-notes.md`](docs/02-architecture/frontend-implementation-notes.md)
  for the frontend, the corresponding architecture document for the other
  modules. Needing a comment means the documentation is missing an entry.
- Frontend styles follow
  [`docs/02-architecture/frontend-styles.md`](docs/02-architecture/frontend-styles.md);
  frontend structure follows
  [`docs/02-architecture/frontend-conventions.md`](docs/02-architecture/frontend-conventions.md).
- Field, table and endpoint names stay in the spelling of the upstream source.
- Do not add a dependency for something a few lines of code already do.

## Documentation

- Document decisions and their reasons. What was done is visible from the code;
  why it was done that way is not recoverable from anywhere else.
- Update the documentation in the same pull request as the code.
- A document that lies is worse than a missing one: if nobody maintains it,
  delete it.

## Checks before review

Run what the change actually touches, and say plainly what you did and did not
run.

```bash
cd frontend && pnpm test && pnpm lint && pnpm build
cd backend  && SPRING_PROFILES_ACTIVE=mock ./mvnw test
```

Do not claim browser or production behaviour that you have not observed in that
environment.

## Licensing of contributions

By contributing you agree that your work is published under the Apache License
2.0, the license of this repository. Do not add license headers to source
files — the repository-level [LICENSE](LICENSE) and [NOTICE](NOTICE) cover them.

If your change vendors or bundles a third-party file, add it to
[THIRD-PARTY.md](THIRD-PARTY.md) in the same pull request.
