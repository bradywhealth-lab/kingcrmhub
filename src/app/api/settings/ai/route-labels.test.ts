import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

// Mock db — the GET path reads org.settings only, never writes.
vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock request context — models an authenticated user so the handler runs
// past auth and the label/tier path under test is reached (upload-route test
// pattern).
vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(async (_request, handler) =>
    handler({ userId: 'test-user', organizationId: 'org-label-fixture' }),
  ),
}))

// Mock rate limit — not the subject of these tests (GET path only).
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

const { db } = await import('@/lib/db')

/**
 * Exercise the REAL GET handler against a fixture org and return the parsed
 * response — cubic P2: source-scan assertions can be satisfied by stale or
 * unused source strings; the settings UI consumes this response shape, so the
 * labels/tiers the UI renders must be pinned on the wire, not in the file.
 */
async function getSettings(orgSettings: Record<string, unknown> | null) {
  vi.mocked(db.organization.findUnique).mockResolvedValueOnce({ settings: orgSettings } as never)
  const request = new Request('http://localhost:3000/api/settings/ai') as never
  const response = await GET(request)
  return { response, data: (await response.json()) as Record<string, unknown> & {
    availableProviders: { id: string; label: string; requiresKey: boolean }[]
    platformFallbacks: Record<string, boolean>
  } }
}

// ---------------------------------------------------------------------------
// t_ae4ae1a9 (Item B) — settings AI-provider copy must describe post-#234
// reality.
//
// VERIFIED IN SOURCE + LIVE: the settings UI labeled the OpenRouter option
// "OpenRouter (Free)" (PROVIDER_LABELS, route.ts:35). Post-#234 (24f48eb) a
// key-less openrouter preference resolves to the Groq-backed platform
// Standard tier — ai-providers.ts gates the openrouter platform branch
// behind !GROQ_API_KEY, and prod holds a platform Groq key. The "(Free)"
// suffix described a dead upstream path: OpenRouter retired the pinned free
// slug (the 404 behind the 2026-10-27 assistant outage), and re-saving the
// option stored exactly the stale shape the October migration had cleaned
// (audit row 23:10:43Z, provider=openrouter, keyChanged=false — selected
// because the label promised "Free").
//
// The dropdown label must carry no tier promise: post-#234 the tier the user
// actually gets key-less is the platform Standard tier regardless of the
// openrouter/groq choice. Vendor-only labels (Atlas Gate v1.4) stay.
// ---------------------------------------------------------------------------
describe('settings AI-provider dropdown labels via the GET response (t_ae4ae1a9)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('no longer labels OpenRouter "(Free)" — vendor-only, same convention as the other three', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gq-platform-key-fixture')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const { response, data } = await getSettings({ aiProvider: 'openrouter' })

    expect(response.status).toBe(200)
    expect(data.availableProviders.map((p) => p.label)).toEqual([
      'OpenRouter',
      'Groq',
      'OpenAI',
      'Anthropic',
    ])
    expect(
      data.availableProviders.some((p) => p.label.includes('(Free)')),
      'no availableProviders label may carry a tier promise',
    ).toBe(false)
  })

  it('labels a key-less openrouter preference with the platform Standard tier (what the user actually gets)', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gq-platform-key-fixture')
    const { data } = await getSettings({ aiProvider: 'openrouter' })

    expect(data.provider).toBe('openrouter')
    expect(data.hasKey).toBe(false)
    expect(data.providerLabel).toBe('Standard — included')
  })

  it('labels a key-less groq preference identically — both resolve to the same included tier', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gq-platform-key-fixture')
    const { data } = await getSettings({ aiProvider: 'groq' })

    expect(data.provider).toBe('groq')
    expect(data.hasKey).toBe(false)
    expect(data.providerLabel).toBe('Standard — included')
  })

  it('reports platform fallbacks so the UI can gate the included-tier badge on deployment reality', async () => {
    vi.stubEnv('GROQ_API_KEY', 'gq-platform-key-fixture')
    vi.stubEnv('OPENROUTER_API_KEY', '')
    vi.stubEnv('OPENAI_API_KEY', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const { data } = await getSettings({ aiProvider: 'groq' })

    expect(data.platformFallbacks).toEqual({
      openrouter: false,
      groq: true,
      openai: false,
      anthropic: false,
    })
    // requiresKey is derived from the same fallback map the panel uses to
    // decide whether the dropdown badge may claim an included tier.
    const openrouter = data.availableProviders.find((p) => p.id === 'openrouter')
    const groq = data.availableProviders.find((p) => p.id === 'groq')
    expect(openrouter?.requiresKey).toBe(true)
    expect(groq?.requiresKey).toBe(false)
  })
})
