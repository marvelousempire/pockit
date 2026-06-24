# Pockit platform — install paste

Install Pockit from canonical repo `marvelousempire/pockit` (Gitea origin).

1. Clone → read `AGENTS.md` → read `docs/product-boundary.md` + `docs/capabilities.md`
2. Study `Nephew/Understandings/Pockit/` (0001–0009) for mental models
3. Shell is in `shell/` — do **not** copy voice-pad, odysseus-pad, knowledge-hud (product IP)
4. Add **your** console as a separate product: `cassette.json` + `cassette-surfaces/*.json` + app door
5. Refresh shell after nephew changes: `make pockit-saas-export` (from nephew repo)
6. Verify: `npm test` in pockit repo (boundary check)

Operator runtime today: `cd ~/Developer/nephew && make pockit` → http://pockit.localhost/

Understanding: `Nephew/Understandings/Pockit/0009-pockit-saas-product-model.md`