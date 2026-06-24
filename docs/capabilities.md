# Pockit platform capabilities

## Console frame (dress apps)

Publish `cassette-surfaces/<id>.json`:

- `left_nav[]` · `nav_sections[]` · `bottom_nav[]`
- `encompass_mode`: `hud_iframe` | native pad
- `speakers_door`: full app URL

Weave: `PockitWeave.buildCassetteWeaveFromManifest()`.  
Doctrine: nephew `0006-pockit-universal-console-frame.md`.

## Cassettes & players

- **Player** = console host (e.g. `demo-player`)
- **Cassette** = tape/card in right rail
- Catalog shape: `sample-data/pockit-catalog.json`

## Rails & zones

```text
suite-bar ─────────────────────────────
player rail │ center canvas │ cassette rail
            │ footer / HUD  │
```

Zones: `data-pockit-zone` · layout: `schemas/pockit-shell-layout.json`.

## Accessories

- Accessory desk (drag/drop accessory tiles)
- Configurations center (meta-console)
- Prompt library hook (optional)

## Help & intent (embedded)

- **Help Command Center** — `pockit-help-console.js` + topics JSON
- **Changelog** — footer version + changelog modal
- **Declaration of intent** — panel + badges + Mac chrome

## Responsive (watch → 85″ TV)

Engine: `pockit-viewport.js` → `body[data-pockit-viewport]`.

| Tier | Typical device |
|------|----------------|
| phone* | iPhone portrait/landscape |
| tablet* | iPad |
| laptop/desktop | Mac browsers |
| display/tv | Large TV, 85″ |

Device Lab: Settings → Devices (46 presets).