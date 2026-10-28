import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routeSrc = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'settings', 'ai', 'route.ts'), 'utf8')

// ---------------------------------------------------------------------------
// t_ae4ae1a9 (Item B) — settings AI-provider copy must describe post-#234
// reality.
//
// VERIFIED IN SOURCE + LIVE: the settings UI labels the OpenRouter option
// "OpenRouter (Free)" (PROVIDER_LABELS, route.ts:35). Post-#234
// (24f48eb) a key-less openrouter preference resolves to the Groq-backed
// platform Standard tier — ai-providers.ts gates the openrouter platform
// branch behind !GROQ_API_KEY, and prod holds a platform Groq key. The "(Free)"
// suffix describes a dead upstream path: OpenRouter retired the pinned free
// slug (qwen/qwen3.8-27b:free, the 404 behind the 2026-10-27 assistant
// outage), and re-saving the option stored exactly the stale shape the
// October migration had cleaned (audit row 23:10:43Z, provider=openrouter,
// keyChanged=false — selected because the label promised "Free").
//
// The dropdown label must carry no tier promise: post-#234 the tier the user
// actually gets key-less is the platform Standard tier regardless of the
// openrouter/groq choice. Vendor-only labels (Atlas Gate v1.4) stay.
// ---------------------------------------------------------------------------
describe('settings AI-provider dropdown labels (t_ae4ae1a9)', () => {
  it('no longer labels OpenRouter "(Free)" — the tier promise post-#234 is false', () => {
    expect(routeSrc, '"(Free)" must be gone from the OpenRouter label').not.toContain("'OpenRouter (Free)'")
    expect(routeSrc, 'plain vendor label, same convention as the other three').toContain(
      'openrouter: \'OpenRouter\',',
    )
  })

  it('keeps the vendor-only Atlas Gate convention for the other providers (no model names)', () => {
    expect(routeSrc).toContain('groq: \'Groq\',')
    expect(routeSrc).toContain('openai: \'OpenAI\',')
    expect(routeSrc).toContain('anthropic: \'Anthropic\',')
  })

  it('still labels a key-less openrouter preference with the platform Standard tier (what the user actually gets)', () => {
    // getProviderLabel: openrouter and groq both resolve to the included
    // Standard tier — that mapping is the truthful tier statement and must
    // survive the label fix.
    expect(routeSrc).toContain(
      "if (provider === 'openrouter' || provider === 'groq') return TIER_LABELS.standard",
    )
  })
})
