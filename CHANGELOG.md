# Pockit core changelog (boilerplate)

Synced from `nephew/changelogs/pockit.md` on export. Version: **v1.90.26**.

## 

## [1.90.26] — Wednesday, June 24, 2026 · *Expect smart technology Redis STM auto-heal (RL-SMART-001)*

### Added
- **1.90.26.a** Expect **RL-SMART-001** — smart technology law: required infra self-heals at boot + on use; unified agent law + `make ensure-redis-stm`.
- **1.90.26.b** Expect **voice semantic cache auto-heal** — Redis tunnel/stack restored automatically when down (no operator paste blocks).

> **Verify:** `make ensure-redis-stm` · `curl -s :8088/api/v1/voice/health | jq .semantic_cache` · `node scripts/smoke-voice-latency.mjs`
