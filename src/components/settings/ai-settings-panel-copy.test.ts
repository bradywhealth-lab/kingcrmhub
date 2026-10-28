import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const panelSrc = readFileSync(
  join(process.cwd(), 'src', 'components', 'settings', 'ai-settings-panel.tsx'),
  'utf8',
)

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
// must say so.
// ---------------------------------------------------------------------------
describe('settings AI panel copy describes post-#234 reality (t_ae4ae1a9)', () => {
  it('badges BOTH key-less standard-tier providers (openrouter AND groq) as the included tier', () => {
    expect(panelSrc).toContain("selectedProvider === 'openrouter' || selectedProvider === 'groq'")
  })

  it('no longer pairs the OpenRouter option with a free-tier promise in the helper copy', () => {
    expect(panelSrc, '"auto-routes to best available AI model" is the dead upstream path claim').not.toContain(
      'Free tier active — auto-routes to best available AI model.',
    )
    expect(panelSrc, '"for free access" promised a retired-slug free path').not.toContain('for free access')
  })

  it('the OpenRouter helper copy states the platform-Standard-tier resolution', () => {
    expect(panelSrc).toContain('platform Standard tier')
  })
})
