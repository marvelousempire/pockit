# Operator runtime (Phase 1 bridge)

Live Pockit **operator fleet** (catalog, cassettes, doors, Mac apps) still boots from **nephew**:

```
~/Developer/nephew/containers/nephew-ct/family-hub/
```

This repo ships:

| Piece | Role |
|-------|------|
| `shell/` | SaaS platform export (no fleet IP) |
| `bin/pockit` | Sibling CLI — `pockit up` delegates to nephew |
| `operator-bridge.json` | Pointer to nephew checkout + phase metadata |

## Commands

```bash
./bin/pockit version
./bin/pockit up
./bin/pockit open
```

Nephew discovers this repo via `src/sibling-bridge.js` when `~/Developer/pockit/bin/pockit` exists.

## Phase 2 (planned)

Move `family-hub/` here; announce port; gateway reads `~/.nephew/run/announce/pockit.json` from pockit process.

Refresh: `cd ~/Developer/nephew && node scripts/publish-pockit-runtime-phase1.mjs`
