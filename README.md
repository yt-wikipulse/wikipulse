*[Русская версия](README.ru.md)*

# WikiPulse

A live map of the world where a place lights up while the Wikipedia article
about it is being edited, next to a dashboard with analytics over the history
of those edits. Both halves are fed by the same pipeline, and the pipeline runs
entirely on **YTsaurus + SPYT**: no Kafka, no separate warehouse for the marts,
no second storage system anywhere in the picture.

https://github.com/user-attachments/assets/ae7f853a-2940-4482-8193-c351c03d13f1

The point of this repository is the shape of the service, not the map. It is a
worked example of what an application on YTsaurus looks like end to end —
queues with consumers and auto-trim, a dictionary looked up from a streaming
job, a static history table, batch marts recomputed on a schedule, and a REST
API that serves a browser client from all of it. Every piece is small enough to
read in one sitting.

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

The first quick-start step below runs without a cluster and without a maps key.

## Quick start

### 1. The whole product, with no cluster at all

The backend has a `mock` profile that replays real edits from fixtures in
`backend/src/main/resources/fixtures/`; the H3 cells attached to them are
synthetic. Start it:

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
RPC. Details of the profile: [`docs/runbooks/local-setup.md`](docs/runbooks/local-setup.md).

Add `YMAPS_API_KEY=<key>` to the backend command to get real map tiles instead
of the error screen; how to obtain that key and why it needs an HTTP Referer
restriction is in [`frontend/README.md`](frontend/README.md).

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

`upload-artifacts` is not optional: without `bigdata.zip` and `h3.zip` in
`{BASE}/lib`, every SPYT job fails on the cluster with
`ModuleNotFoundError: bigdata`. The coordinate dictionary, the streaming job,
the archiver, the marts and the scheduler are all in
[`bigdata/README.md`](bigdata/README.md), in the order they have to be run.

With the tables filled, the backend needs no profile — `yt` is the default:

```bash
cd backend
YT_PROXY=$YT_PROXY YT_TOKEN=$YT_TOKEN YT_BASE_PATH=$YT_BASE_PATH \
  YMAPS_API_KEY=<key> ./mvnw spring-boot:run
```

The backend reaches YTsaurus over RPC on port 9013, which home networks usually
block; from a cloud VM it works. The Python parts use the HTTP proxy and work
from anywhere.

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
`extra_hosts`, security headers, disk space, known traps — is in
[`deploy/README.md`](deploy/README.md).

## Configuration

Everything the service takes from the outside arrives in environment variables;
there are no cluster addresses, tokens or Cypress paths in the source. The full
table — which variable is required, what the defaults are, who reads what — is
[`docs/runbooks/configuration.md`](docs/runbooks/configuration.md), and
[`deploy/.env.example`](deploy/.env.example) is a filled-in template of it.

A fork changes two things: the cluster it talks to (`YT_PROXY`, `YT_TOKEN`) and
the root it writes under (`YT_BASE_PATH`).

The deployment workflow in `.github/workflows/deploy.yml` copies the sources to
a server and runs compose there. **It stays dormant in a fork:** while the
`DEPLOY_HOST` repository variable is unset the job does not run, so the example
never tries to publish itself onto somebody else's machine. Configure your own
host through repository variables and secrets, or delete the file.

## Documentation

Written in Russian; issues and pull requests are accepted in Russian or English.

- [`docs/README.md`](docs/README.md) — index of everything below.
- [`docs/contracts/`](docs/contracts/) — the boundaries: YT table schemas and
  the REST API. If the code disagrees with these, the code is wrong.
- [`docs/runbooks/local-setup.md`](docs/runbooks/local-setup.md) — the long
  form of the first quick-start step.
- [`setup/spyt-env.md`](setup/spyt-env.md) — pointing a machine at a YTsaurus
  cluster and running SPYT jobs from it.

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Source files carry no
license headers; the repository-level files cover them.

Components that this project redistributes rather than merely depends on are
listed in [THIRD-PARTY.md](THIRD-PARTY.md), with the license texts that are not
Apache-2.0 in [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt). Ordinary
Maven, pnpm and pip dependencies are declared in `backend/pom.xml`,
`frontend/package.json` and `bigdata/pyproject.toml`.

How to contribute: [CONTRIBUTING.md](CONTRIBUTING.md).
How to report a vulnerability: [SECURITY.md](SECURITY.md).
