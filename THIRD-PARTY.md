# Third-party components

WikiPulse itself is licensed under Apache-2.0 (see [LICENSE](LICENSE)).
Listed below is everything this project redistributes rather than merely
depends on: files carried in the repository, files baked into its build output,
and files it uploads to a cluster. Full license texts that are not Apache-2.0
are collected in [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt).

Ordinary dependencies resolved by Maven, pnpm and pip are not listed here: they
are declared in `backend/pom.xml`, `frontend/package.json` and
`bigdata/pyproject.toml`, and each of them carries its own license through its
package manager.

## h3-py — shipped to the cluster as `h3.zip`

- Upstream: <https://github.com/uber/h3-py>.
- License: Apache-2.0, the same text as [LICENSE](LICENSE); the upstream copy
  travels inside the archive as `h3-*.dist-info/licenses/LICENSE`.
- Not committed to this repository. SPYT executors run a fixed Python and
  install nothing on demand, so the compiled extension has to travel with the
  job (`--files`). `bigdata/src/bigdata/scripts/upload_artifacts.py` downloads
  the wheel built for the executors' Python and architecture, packs it, and
  uploads it into the cluster next to the job scripts.
- It is listed here because running this pipeline redistributes h3-py to the
  cluster; whoever runs it inherits the Apache-2.0 notice obligation.

## Manrope — bundled into the frontend build

- Upstream: <https://github.com/sharanda/manrope>, consumed through the npm
  package `@fontsource-variable/manrope`.
- License: SIL Open Font License 1.1, full text in
  [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt).
- The font files end up in `frontend/dist`, so the OFL text has to be published
  next to them: keep a copy of `THIRD-PARTY-LICENSES.txt` in `frontend/public/`,
  which Vite copies into `dist/` verbatim.
- OFL-1.1 forbids selling the font on its own and requires that any modified
  version be renamed. Neither applies as long as the font is used unmodified.

## Yandex Maps style export — `frontend/src/components/LiveMap/mapCustomization.json`

- The file is a map style exported from the Yandex Maps customization tool and
  is data for the Yandex Maps JavaScript API, not independent source code.
- It is usable only together with the Yandex Maps API and is therefore governed
  by the Yandex Maps API terms of use, not by the Apache-2.0 license of this
  repository: <https://yandex.ru/legal/maps_api/>.
- A fork that does not want that dependency replaces the map component: the
  backend contract returns H3 indices, so nothing but the map adapter is tied
  to a particular map provider.
