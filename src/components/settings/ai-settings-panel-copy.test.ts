import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// import.meta.dirname = src/components/settings → up 3 levels to repo root
const repoRoot = join(import.meta.dirname, '..', '..', '..')

const source = readFileSync(join(repoRoot, 'src', 'components', 'settings', 'ai-settings-panel.tsx'), 'utf8')

/**
 * Strip block and line comments so assertions measure RENDERED copy, not
 * engineering notes (same discipline as ai-provider-labels.test.ts — cubic
 * P2: a positive assertion satisfied by a source comment can pass while the
 * UI shows incorrect tier copy).
 */
function renderedCopy(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

const rendered = renderedCopy(source)

// ---------------------------------------------------------------------------
// t_ae4ae1a9 (Item B) — the settings AI panel copy must describe post-#234
// reality (source: t_ae0cffe5 secondary anomaly #3).
//
// VERIFIED IN SOURCE (ai-settings-panel.tsx):
//   - the celebratory "Free tier" badge rendered ONLY for a key-less
//     openrouter selection, while a key-less GROQ selection — the actual,
//     working platform Standard tier — rendered an amber "No key — using
//     fallback" warning. The badge logic implied OpenRouter IS the free tier.
//   - the openrouter helper copy claimed "Free tier active — auto-routes to
//     best available AI model." even though a key-less openrouter preference
//     resolves to the Groq-backed Standard tier on this deployment.
//
// Both key-less selections land on the SAME included tier: the badge and copy
// must say so — and only when a Standard-tier platform fallback actually
// exists on the deployment (cubic P2: the included-tier badge must not claim
// "included" when no platform key can fund it). The dropdown "Free" badge
// (shown for any provider with a platform key) is the same dead-promise class
// — it must say "Included", matching the TIER_LABELS vocabulary.
// ---------------------------------------------------------------------------
describe('settings AI panel copy describes post-#234 reality (t_ae4ae1a9)', () => {
  it('badges BOTH key-less standard-tier providers (openrouter AND groq) as the included tier', () => {
    expect(rendered).toContain("selectedProvider === 'openrouter' || selectedProvider === 'groq'")
    // cubic P2: the included-tier claim must be gated on an actually-available
    // Standard-tier platform fallback (Groq or OpenRouter key present).
    expect(rendered).toContain(
      '(settings?.platformFallbacks?.openrouter || settings?.platformFallbacks?.groq)',
    )
    // The badge TEXT itself must render the tier claim (comment-stripped).
    expect(rendered).toMatch(/Standard — included\s*<\/Badge/)
  })

  it('no longer pairs the OpenRouter option with a free-tier promise in the helper copy', () => {
    expect(rendered, '"auto-routes to best available AI model" is the dead upstream path claim').not.toContain(
      'Free tier active — auto-routes to best available AI model.',
    )
    expect(rendered, '"for free access" promised a retired-slug free path').not.toContain('for free access')
  })

  it('the OpenRouter helper copy branches on the actual deployment fallbacks (cubic P2)', () => {
    // Groq platform key present (this deployment): key-less openrouter means
    // "no preference" and resolves to the Groq-backed Standard tier.
    expect(rendered).toContain(
      'Without your own key, this option uses the platform Standard tier — the same included tier as the Groq default. OpenRouter itself is used only when your own key is active.',
    )
    // No Groq key but a platform OpenRouter key: the resolver funds a pinned
    // zero-cost model on the platform OpenRouter key (ai-providers.ts gates
    // that branch behind !groqKey — the copy must match the resolver).
    expect(rendered).toContain(
      'Without your own key, this option runs on the platform OpenRouter key with a pinned zero-cost model — the included Standard tier on this deployment.',
    )
    // Neither standard-tier platform key: no included tier to promise.
    expect(rendered).toContain(
      'OpenRouter needs a key on this deployment — add your own at openrouter.ai/keys, or choose a provider that is included.',
    )
  })

  it('the provider dropdown badge says "Included", not "Free"', () => {
    // The dropdown rendered a "Free" badge for every provider with a platform
    // key — on this deployment that badge sat next to OpenRouter and was the
    // same promise that re-created the stale key-less preference.
    expect(rendered).not.toMatch(/Free\s*<\/Badge/)
    expect(rendered).toMatch(/Included\s*<\/Badge/)
  })
})
