# Pockit platform — install guide

## Clone

```bash
git clone ssh://git@10.1.0.5:2424/marvelousempire/pockit.git ~/Developer/pockit
```

## Study order

1. `AGENTS.md`
2. `docs/product-boundary.md`
3. `docs/capabilities.md`
4. `Nephew/Understandings/Pockit/` (in nephew repo) — numbered mental models 0001–0009

## Run (operator / dev)

Platform shell is served via nephew stack:

```bash
cd ~/Developer/nephew && make pockit
open http://pockit.localhost/
```

## Refresh shell from nephew

```bash
cd ~/Developer/nephew && make pockit-saas-export
```

## Customer SaaS (future)

v1 ships **source + schemas + demo**. Runnable minimal tower-api in pockit repo is a follow-up (Plan 0457 wave 2).