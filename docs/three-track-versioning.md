# Three version tracks

| Track | This repo? | Versions via |
|-------|------------|--------------|
| **Pockit core** | **Yes** — you are here | `pockit-surface.json` → `EXPORT_META.json` → `CHANGELOG.md` |
| **Console** | No — your console repo | App + `cassette-surfaces/<id>.json` |
| **Cassette** | No — your cassette repo | `cassette.json` + product changelog |

`sample-data/` in this repo is **demo shape only** (`demo-*` ids) — not fleet version truth.

Operator sync: `make pockit-saas-publish` from nephew after core edits.

Mental model: `nephew/Nephew/Understandings/Pockit/0010-pockit-core-console-cassette-tracks.md`