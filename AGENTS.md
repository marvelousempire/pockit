# Pockit platform — AI build law

**Read this file first.** This repo is the **Pockit core boilerplate** — the latest frame only. Not your consoles, not your cassettes, not the Family Office fleet.

**Version track:** Pockit core lives here. Each console and each cassette versions in its **own repo**. See `docs/three-track-versioning.md`.

## What this repo contains

| Path | Purpose |
|------|---------|
| `shell/` | Vanilla JS Pockit player (exported from nephew, product pads stripped) |
| `sample-data/` | Demo player + console + 3 cassettes — copy shape for yours |
| `schemas/` | `cassette-surface`, catalog, shell-layout, device viewports |
| `docs/` | Product boundary, capabilities, responsive tiers |
| `scripts/check-boundary.mjs` | Fails if product IP leaked into shell/ |

## What you build separately (products)

Each **console** or **cassette** is its own repo or package:

```
your-app/
  cassette.json              # registry entry
  cassette-surfaces/foo.json   # encompass manifest (rails + iframe door)
  src/                         # React app or HTML door
```

Pockit reads manifests at runtime — **never fork `shell/pockit.js` per product.**

## Capabilities to implement (checklist)

- [ ] **Player rail** — consoles list (`pockit-catalog.json` → players)
- [ ] **Cassette rail** — hosted cassettes per player
- [ ] **Center canvas** — encompass iframe (`pockit_hud=1`) or native pad module
- [ ] **Suite bar** — Family Office brand / app carousel
- [ ] **Zones** — `data-pockit-zone` slots ([docs/capabilities.md](docs/capabilities.md))
- [ ] **Viewport tiers** — `body[data-pockit-viewport]` watch→tv
- [ ] **Help console UI** — `pockit-help-console.js` + your topics JSON
- [ ] **Intent** — declaration panel + intention badge
- [ ] **Changelog footer** — version pill law
- [ ] **Accessory desk** — optional drag/drop accessories
- [ ] **Staple Search** — optional (`staple-search` repo)

## Add a new console (agent steps)

1. Copy `sample-data/cassette-surfaces/demo-console.json` → `your-console.json`
2. Set `speakers_door`, `left_nav`, `nav_sections`, `encompass_mode`
3. Add player entry in **your** catalog (not in pockit repo if customer-specific)
4. Register cassette in **your** `cassette.json`
5. App strips chrome on `?pockit_hud=1` — see `pockit-console-dress` agent paste in nephew
6. Verify: `make encompass-audit CHECK=your-id` (in nephew) or manual rail click → iframe navigates

## Responsive law

46 device presets in `schemas/pockit-device-viewports.json`. Tiers:

`watch` · `phoneCompact` · `phoneLarge` · `tabletCompact` · `tabletLarge` · `laptop` · `desktop` · `display` · `tv` (85″+)

Phone: thumb dock + Controls sheet — **never** desktop rails on narrow widths.

## Operator runtime (Family Office)

Full stack still boots from **nephew** today:

```bash
cd ~/Developer/nephew && make pockit
# http://pockit.localhost/
```

After **core** shell changes in nephew (operator):

```bash
cd ~/Developer/nephew && make pockit-saas-publish   # export + test + push Gitea
make pockit-saas-drift                            # must pass before "done"
```

Local export only: `make pockit-saas-export`

## Verify done

```bash
npm test   # boundary check — no product pads in shell/
```

Mental model: `nephew/Nephew/Understandings/Pockit/0009-pockit-saas-product-model.md`