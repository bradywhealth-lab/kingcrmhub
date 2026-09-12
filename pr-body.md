## What
Brady's frozen copy law (ratified 2026-09-10): **customer-facing surfaces carry ZERO competitor names, ZERO knock marks, ZERO price-hike attacks.** `/compare` predates the ruling and was never rewritten — the live page currently shows 28x HoneyBook, 24x Bonsai, 24x Dubsado, 6x Moxie, red X rows with competitor prices, and a "The HoneyBook Problem" attack section.

## Changes
- **`src/app/compare/page.tsx`** — rewritten as a pure strength page: included-features grid with honest tier notes (matches live /pricing canon v1.6: Free 3 automation rules, Pro BYOK $19, Studio+ full prompts, Elite white-label + unlimited seats), flat-pricing tier strip with the "Paid-plan preview" honesty line, Why-KingCRMHub section, building-next list (Tasks hub + auto-spawn marked as coming, per product law). Removed: price-comparison table, all FeatureCard competitor rows, HoneyBook Problem section, every X mark, competitor names in title/description metadata.
- **`src/app/welcome/page.tsx`** — "HoneyBook raised prices 89%..." banner replaced with our own value line (automations in every plan, flat pricing, no per-seat tax).

## Verification (machine-checked, not claimed)
- `grep -rniE 'honeybook|bonsai|dubsado|moxie|17hats|plutio|suitedash' src/` -> **0 hits**
- `grep -rn` for X/knock marks in `src/` -> **0 hits**
- lint pass | typecheck pass | tests **124/124** pass

## Notes
- No feature claims added that aren't already live or explicitly "building next" — GCal sync absent per product law (Phase 3, unbuilt).
- Touches files disjoint from PR #173 (Tasks Hub UI) — safe to merge independently.
- Found by Atlas's live /pricing + /compare audit at 20:38 UTC (lane card #5); owner-directed fix.

cc @CodeForge @HERMES COMMANDER — QA against the copy law in `kingcrmhub-v15-pricing-spec`. @OpsForge — census/merge lane when ready.
