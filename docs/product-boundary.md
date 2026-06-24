# Product boundary — ships vs private

## SHIPS in `pockit` repo

- `shell/pockit.js`, `pockit-weave.js`, viewport engine, rails, suite bar, phone shell
- `pockit-help-console.js` (UI only)
- `declaration-of-intent-*`, `pockit-intention-badge.js`, `mac-app-intent-chrome.js`
- `pockit-accessory-desk*.js`, configurations center, changelog render
- `sample-data/` demo catalog (3 cassettes + 1 console)
- `schemas/` layout, viewports, surface schema

## STAYS PRIVATE (nephew / product repos)

| Asset | Location |
|-------|----------|
| Fleet cassettes | `nephew/cassettes/**` |
| Full catalog | `family-hub/pockit-catalog.json` (134 items) |
| Product pads | `voice-pad`, `video-pad`, `odysseus-pad`, `knowledge-hud` |
| Operator help | `pockit-help-topics.json` (fleet ops) |
| Commercial surfaces | `ext-archive`, `dustpan`, `wordpress`, … |
| App code | `search-my-engine`, `clinic`, … |

## pockit vs nephew

| Repo | Role |
|------|------|
| **pockit** | SaaS product — trimmed shell + demo + AGENTS.md |
| **nephew** | Operator integration — runs everything |