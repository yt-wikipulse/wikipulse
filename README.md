*[Русская версия](README.ru.md)*

# WikiPulse

A live map of the world where a place lights up while the Wikipedia article
about it is being edited, next to a dashboard with analytics over the history
of those edits. Both halves are fed by the same pipeline, and the pipeline runs
entirely on **YTsaurus + SPYT**: no Kafka, no separate warehouse for the marts,
no second storage system anywhere in the picture.

The point of this repository is the shape of the service, not the map. It is a
worked example of what an application on YTsaurus looks like end to end —
queues with consumers and auto-trim, a dictionary looked up from a streaming
job, a static history table, batch marts recomputed on a schedule, and a REST
API that serves a browser client from all of it. Every piece is small enough to
read in one sitting, and every non-obvious decision is written down with the
reason it was made.

Concretely, that is four moving parts: a plain Python producer that tails the
Wikimedia event stream into a queue, a SPYT structured-streaming job that joins
each edit with a coordinate dictionary and assigns it an H3 cell, a pair of
batch steps that archive the queue and rebuild the dashboard marts, and a
Spring Boot service that keeps a 30-minute window of the enriched queue in
memory and folds it into hexagons at whatever resolution the current map zoom
needs. The client is a React SPA with two routes.

It is also an honest snapshot rather than a polished product. The SPYT jobs are
deliberately naive — a `lookup_rows` per batch, not a broadcast join — because
rewriting them without a cluster to verify on would put unverified Spark code
into an example that people are expected to copy. The known gaps are named in
the module documents instead of being hidden: `bigdata/implementation-notes.md`
records, among others, that `dict/coords` has to be converted to a dynamic
table by hand and that `q_enriched` is not actually trimmed yet.

## How it works

```text
  Wikimedia SSE (recentchange)
        │
        │  ingestor            plain Python, runs anywhere
        ▼
  {BASE}/q_raw                 YTsaurus queue
        │
        │  spyt_enrich         SPYT streaming job on the cluster:
        │                      lookup in {BASE}/dict/coords, H3 r9 cell per edit
        ▼
  {BASE}/q_enriched            YTsaurus queue
        │
        ├───────────────────────────────────────────────┐
        │  archiver                                     │  poller inside the backend
        ▼                                               ▼
  {BASE}/history/t_history                        30-minute window in memory
        │                                               │
        │  spyt_marts          SPYT batch job           │  r9 cells folded up
        ▼                                               ▼  to the zoom's resolution
  {BASE}/marts/trends                             GET /api/v1/hexagons/active
  {BASE}/marts/top_articles                              │
  {BASE}/marts/top_geo                                   ▼
        │                                            live map
        │  GET /api/v1/dashboard
        ▼
    dashboard
```

`{BASE}` is `YT_BASE_PATH`, `//home/wikipulse` by default. Every path in the
project is derived from it — there are no cluster paths written into the source.
The two batch steps on the left are driven by `scheduler`, which runs `archiver`
and then `spyt_marts` every five minutes.

## Repository layout

```text
.
├── frontend/   React client: the live map and the dashboard
├── backend/    REST API, Java / Spring Boot / Maven
├── bigdata/    pipeline: producer, SPYT jobs, table bootstrap, artifact upload
├── deploy/     containers, Caddy, deployment configuration
├── docs/       architecture, contracts, runbooks
└── setup/      how to point a machine at YTsaurus and SPYT
```

## Requirements

| What | Version | Needed for |
|---|---|---|
| JDK | 17 | `backend` — `java.version` in `backend/pom.xml` |
| Node.js | `^20.19` or `>=22.12` | `frontend` — required by Vite 8 |
| pnpm | pinned by `packageManager` | `frontend`; corepack installs it |
| Python | `>=3.12` | `bigdata` — `requires-python` in `pyproject.toml` |
| Docker with the compose plugin | — | `deploy` |
| A YTsaurus cluster with SPYT | — | everything except the mock profile |
| A Yandex Maps JavaScript API key | — | for the map to render at all |

Nothing else is needed to see the product: the first step below runs without a
cluster and without a maps key.

## Quick start

### 1. The whole product, with no cluster at all

The backend has a `mock` profile that serves real data from fixtures. Start it:

```bash
cd backend
SPRING_PROFILES_ACTIVE=mock ./mvnw spring-boot:run
```

and the client in a second terminal:

```bash
cd frontend
pnpm install
pnpm dev
```

Then open <http://localhost:5173/map>. The dev server proxies `/api` to
`http://localhost:8080`, so the backend has to be up first.

`YT_PROXY` and `YT_TOKEN` are not needed here: the beans that read them are
`@Profile("yt")`, so their placeholders are never resolved. `SPRING_PROFILES_ACTIVE`
*is* needed — the default profile is `yt`, and that one talks to a cluster over
RPC.

What you get is not invented data. The live map replays 730 real Wikipedia
edits and the dashboard serves three real marts, all captured from the public
API of the team's own deployment on 30 August 2026 and committed to
`backend/src/main/resources/fixtures/`. On startup the whole sample is shifted
so that its last edit lands on *now*, which makes the snapshot's window line up
with the map's own 30-minute window — the map is full immediately instead of
filling up over half an hour. After that one edit is replayed every two seconds.

One thing in the mock is synthetic, and it is worth knowing before you read
anything into the map: the fixture has no coordinates, because the coordinate
dictionary is not reachable through the public API. `MockPoller` assigns each
edit a cell by hashing its wiki over the real `h3_parent` values from the
dashboard fixture. The edit is real and the cell is real; the link between them
is not.

Add `YMAPS_API_KEY=<key>` to the backend command to get the actual map tiles
instead of the error screen — see [Yandex Maps API key](#yandex-maps-api-key).

### 2. Against a real YTsaurus cluster

```bash
export YT_PROXY=https://<proxy-host>
export YT_TOKEN=<token>
export YT_BASE_PATH=//home/wikipulse

cd bigdata
pip install -e .

init-tables        # directories, queues, consumers, auto-trim, history, marts
upload-artifacts   # build and upload bigdata.zip, h3.zip and the job scripts
ingestor           # Wikimedia SSE → q_raw
```

`upload-artifacts` is not optional and not a one-time convenience: without
`bigdata.zip` and `h3.zip` in `{BASE}/lib`, every SPYT job fails on the cluster
with `ModuleNotFoundError: bigdata`. The coordinate dictionary, the streaming
job, the archiver, the marts and the scheduler are all in
[`bigdata/README.md`](bigdata/README.md), in the order they have to be run.

With the tables filled, the backend needs no profile — `yt` is the default:

```bash
cd backend
YT_PROXY=$YT_PROXY YT_TOKEN=$YT_TOKEN YT_BASE_PATH=$YT_BASE_PATH \
  YMAPS_API_KEY=<key> ./mvnw spring-boot:run
```

The backend reaches YTsaurus over RPC on port 9013, which home networks
usually block; from a cloud VM it works. The Python parts use the HTTP proxy
and work from anywhere.

### 3. Everything in containers

```bash
cd deploy
cp .env.example .env     # fill in YT_PROXY, YT_TOKEN, DOMAIN, ACME_EMAIL
docker compose up -d --build
```

Four containers: the backend, the ingestor, the scheduler and Caddy. The SPYT
jobs live on the cluster and are not part of compose, so `upload-artifacts` has
to have been run against that cluster before the scheduler can compute
anything. Caddy serves exactly the host named in `DOMAIN` and gets a
certificate for it automatically; `DOMAIN=http://localhost` turns HTTPS off for
a local look. Everything else — TLS with a file certificate, per-host
`extra_hosts`, security headers, disk space, the traps already hit — is in
[`deploy/README.md`](deploy/README.md).

## Configuration

Everything the service takes from the outside arrives in environment variables;
there are no cluster addresses, tokens or Cypress paths in the source. The full
table — which variable is required, what the defaults are, who reads what — is
the *Переменные* section of [`deploy/README.md`](deploy/README.md), and
[`deploy/.env.example`](deploy/.env.example) is a filled-in template of it.

A fork changes two things: the cluster it talks to (`YT_PROXY`, `YT_TOKEN`) and
the root it writes under (`YT_BASE_PATH`).

The deployment workflow in `.github/workflows/deploy.yml` copies the sources to
a server and runs compose there. **It stays dormant in a fork:** while the
`DEPLOY_HOST` repository variable is unset the job does not run, so the example
never tries to publish itself onto somebody else's machine. Configure your own
host through repository variables and secrets, or delete the file.

## Yandex Maps API key

The map is the one external dependency that cannot be worked around: the Yandex
Maps JavaScript API 3.0 does not render without a key. Two properties of that
key surprise people, and both cost an afternoon when they are discovered by
debugging:

- **The HTTP Referer restriction is mandatory.** A key with no Referer set does
  not work anywhere, and the failure comes from inside the API as an
  uninformative error. The field takes a host and nothing else — no scheme, no
  `/*` suffix — and it does not accept a bare IP address, so a domain is
  required; `localhost` is fine for local development.
- **The free tier allows 100 map loads per day**, and every page load spends
  one. Reloading the page while developing is enough to exhaust it.

The key is not a secret: the frontend receives it at runtime from
`GET /api/v1/config` and it is visible in the browser. The Referer restriction
is the only thing protecting it. The backend reads it from `YMAPS_API_KEY`;
if it is unset, the API returns an empty string, the map shows a "could not
load" screen with a retry button, and the rest of the page keeps working.

Details, including which key type to request:
[`frontend/README.md`](frontend/README.md).

## Documentation

- [`docs/README.md`](docs/README.md) — index of everything below.
- [`docs/03-contracts/`](docs/03-contracts/) — the boundaries: YT table schemas
  and the REST API. If the code disagrees with these, the code is wrong.
- [`docs/05-runbooks/local-setup.md`](docs/05-runbooks/local-setup.md) — the
  long form of the first quick-start step.
- [`setup/spyt-env.md`](setup/spyt-env.md) — pointing a machine at a YTsaurus
  cluster and running a first SPYT job.
- `bigdata/implementation-notes.md` and
  [`docs/02-architecture/frontend-implementation-notes.md`](docs/02-architecture/frontend-implementation-notes.md)
  — why the code is written the way it is. This project keeps no comments in
  the source; the reasons live in these documents, anchored to a file and a
  symbol.

The documentation under `docs/` is written in Russian and has **not** been
translated. Translating it is separate work that has not been done. This README
is the only document maintained in both languages; issues and pull requests are
accepted in either.

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Source files carry no
license headers; the repository-level files cover them.

Components that this project redistributes rather than merely depends on — the
h3-py wheel uploaded to the cluster, the Manrope font bundled into the frontend
build, the Yandex Maps style export — are listed in
[THIRD-PARTY.md](THIRD-PARTY.md), with the license texts that are not
Apache-2.0 in [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt). Ordinary
Maven, pnpm and pip dependencies are not listed there; they are declared in
`backend/pom.xml`, `frontend/package.json` and `bigdata/pyproject.toml`.

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).
How to report a vulnerability: [SECURITY.md](SECURITY.md).
