import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * No-model-names law (Atlas Gate v1.1 ⚠️ + v1.3 BANNED additions).
 *
 * Customer-facing surfaces must never name a model, a model slug, or a
 * provider vendor. This gate reads the SHIPPED bytes of the two render paths
 * and strips comments, so it measures rendered copy only — engineering notes
 * are exempt, user-visible strings are not.
 *
 * Scope note: the AI settings panel is where a user pastes their OWN key.
 * Whether vendor *identity* may appear there as BYOK plumbing is an open
 * product question routed to Atlas; this gate currently bans only model names
 * and raw model slugs, which are leaks with no product value on any reading.
 */

// import.meta.dirname = src/components/settings → up 3 levels to repo root
const repoRoot = join(import.meta.dirname, '..', '..', '..')

const SURFACES = [
  'src/components/settings/ai-settings-panel.tsx',
  'src/app/api/settings/ai/route.ts',
] as const

/** Model names + raw slugs. Banned on every reading of the law. */
const MODEL_TOKENS = [
  'llama', 'gpt-4o', 'gpt-4', 'claude', 'claude-sonnet',
  'llama-3.3-70b-versatile', 'claude-sonnet-4-20250514',
]

function renderedCopy(relPath: string): string {
  const source = readFileSync(join(repoRoot, relPath), 'utf8')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

describe('no-model-names law on AI settings render paths', () => {
  it.each(SURFACES)('%s contains no model name in rendered copy', (relPath) => {
    const rendered = renderedCopy(relPath).toLowerCase()
    const hits = MODEL_TOKENS.filter(token => rendered.includes(token))
    expect(hits, `model names leaked in ${relPath}: ${hits.join(', ')}`).toEqual([])
  })

  it('does not render the raw model slug to the settings UI', () => {
    const panel = renderedCopy('src/components/settings/ai-settings-panel.tsx')
    // `Model: {settings?.model}` printed llama-3.3-70b-versatile verbatim.
    expect(panel).not.toContain('Model: {settings?.model}')
    expect(panel).not.toMatch(/settings\?\.model/)
  })

  it('uses Atlas customer-safe tier labels instead of vendor/model labels', () => {
    const route = renderedCopy('src/app/api/settings/ai/route.ts')
    expect(route).toContain('Standard — included')
    expect(route).toContain('Advanced — bring your own key')
  })

  it('does not echo provider or model identity in the streaming response header', () => {
    const chatRoute = renderedCopy('src/app/api/ai/chat/route.ts')
    // X-AI-Provider exposed the vendor name to any client devtools/network tab.
    expect(chatRoute).not.toContain('X-AI-Provider')
  })
})
