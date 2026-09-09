import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  PROMPT_LIBRARY,
  PROMPT_PACKS,
  PROMPT_PLAN_ORDER,
  isPromptUnlockedForPlan,
  promptsForPlan,
} from '@/lib/prompts'

/**
 * PROVENANCE OF THESE ASSERTIONS
 * - All 22 titles, categories, tags and the three pack fixtures are Atlas
 *   Gate v1.3 VERBATIM — ratified, and the merge gate contract.
 * - Prompt BODIES are CodeForge drafts pending Brady's ratification, so they
 *   are asserted structurally (present, non-trivial, no banned tokens) rather
 *   than as approved copy.
 */

// Atlas Gate v1.3 §Prompt ladder — exact id → title/category/tags contract.
const ATLAS_V13: Record<string, { title: string; category: string; tags: string[] }> = {
  'starter-follow-up-nudge': { title: 'Follow-up nudge', category: 'follow-up', tags: ['follow-up', 'nudge', 'client'] },
  'starter-proposal-opener': { title: 'Proposal opener', category: 'proposals', tags: ['proposal', 'opener', 'scope'] },
  'starter-scope-creep-reply': { title: 'Scope-creep reply', category: 'proposals', tags: ['scope', 'boundary', 'reply'] },
  'starter-invoice-chase': { title: 'Invoice chase', category: 'payments', tags: ['invoice', 'payment', 'chase'] },
  'starter-discovery-call-prep': { title: 'Discovery-call prep', category: 'discovery', tags: ['discovery', 'call', 'questions'] },
  'starter-testimonial-ask': { title: 'Testimonial ask', category: 'social-proof', tags: ['testimonial', 'ask', 'proof'] },
  'pro-objection-handler': { title: 'Objection diffuser', category: 'negotiation', tags: ['objection', 'negotiation', 'pricing'] },
  'pro-re-engagement-winback': { title: 'Re-engagement winback', category: 'follow-up', tags: ['winback', 're-engagement', 'dormant'] },
  'pro-case-study-writeup': { title: 'Case-study writeup', category: 'social-proof', tags: ['case-study', 'proof', 'portfolio'] },
  'pro-onboarding-kickoff': { title: 'Onboarding kickoff', category: 'follow-up', tags: ['onboarding', 'kickoff', 'expectations'] },
  'pro-rate-increase-notice': { title: 'Rate-increase notice', category: 'payments', tags: ['rates', 'pricing', 'notice'] },
  'pro-deposit-terms-script': { title: 'Deposit + terms script', category: 'payments', tags: ['deposit', 'terms', 'contract'] },
  'pro-referral-request': { title: 'Referral request', category: 'outreach', tags: ['referral', 'request', 'growth'] },
  'pro-linkedin-outreach-dm': { title: 'LinkedIn outreach DM', category: 'outreach', tags: ['linkedin', 'dm', 'outreach'] },
  'pro-cold-email-replies': { title: 'Cold email that gets replies', category: 'outreach', tags: ['cold-email', 'email', 'replies'] },
  'pro-content-calendar': { title: 'Content calendar generator', category: 'content', tags: ['content', 'calendar', 'planning'] },
  'studio-offer-ladder': { title: 'Offer ladder builder', category: 'offers', tags: ['offer', 'ladder', 'pricing'] },
  'studio-niche-positioning': { title: 'Niche positioning statement', category: 'positioning', tags: ['positioning', 'niche', 'statement'] },
  'studio-framework-naming': { title: 'Signature framework naming', category: 'positioning', tags: ['framework', 'naming', 'brand'] },
  'studio-lead-magnet-outline': { title: 'Lead magnet outline', category: 'marketing', tags: ['lead-magnet', 'marketing', 'outline'] },
  'studio-launch-sequence': { title: 'Launch sequence (5 emails)', category: 'marketing', tags: ['launch', 'email', 'sequence'] },
  'studio-authority-post-series': { title: 'Authority post series', category: 'content', tags: ['authority', 'posts', 'series'] },
}

const BANNED = [
  '#557df5', '#3a5fd9', '#2563eb', '#0284c7', '#0ea5e9', '#7c3aed',
  '#16a34a', '#15803d',
  'close deals', 'money-back', 'money back', 'guarantee', 'refund',
  'llm', 'llama', 'gpt', 'claude', 'openai', 'anthropic', 'groq',
  'byok', 'bring your own',
  'insurance', 'carrier', 'broker', 'underwriting', 'policy number',
]

const repoRoot = join(import.meta.dirname, '..', '..')

/**
 * Strip comments so the banned-token gate measures RENDERED copy, not
 * engineering notes. A doc comment saying "legacy insurance-era rows" is not
 * user-visible; a prompt body saying it would be.
 */
function renderedCopyOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1') // line comments (not inside strings)
}

describe('prompt library', () => {
  it('contains exactly the 22 specified prompts', () => {
    expect(PROMPT_LIBRARY).toHaveLength(22)
  })

  it('has unique ids, valid plans, and complete fields on every prompt', () => {
    const ids = new Set<string>()
    for (const p of PROMPT_LIBRARY) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false)
      ids.add(p.id)
      expect(PROMPT_PLAN_ORDER).toContain(p.plan)
      expect(p.title.trim().length).toBeGreaterThan(0)
      expect(p.body.trim().length).toBeGreaterThan(20)
      expect(p.category.trim().length).toBeGreaterThan(0)
      expect(p.tags.length).toBeGreaterThan(0)
    }
  })

  it('carries the exact Starter Six titles in Atlas spec order', () => {
    const freeTitles = PROMPT_LIBRARY.filter(p => p.plan === 'free').map(p => p.title)
    expect(freeTitles).toEqual([
      'Follow-up nudge',
      'Proposal opener',
      'Scope-creep reply',
      'Invoice chase',
      'Discovery-call prep',
      'Testimonial ask',
    ])
  })

  it('matches Atlas Gate v1.3 verbatim for all 22 title/category/tags contracts', () => {
    const byId = new Map(PROMPT_LIBRARY.map(p => [p.id, p]))

    // Exact set equality — no extra prompts, none missing.
    expect([...byId.keys()].sort()).toEqual(Object.keys(ATLAS_V13).sort())

    for (const [id, spec] of Object.entries(ATLAS_V13)) {
      const actual = byId.get(id)
      expect(actual, `missing prompt ${id}`).toBeDefined()
      expect(actual?.title, `title mismatch on ${id}`).toBe(spec.title)
      expect(actual?.category, `category mismatch on ${id}`).toBe(spec.category)
      expect(actual?.tags, `tags mismatch on ${id}`).toEqual(spec.tags)
    }
  })

  it('holds 6 / 10 / 6 prompts across free / pro / studio', () => {
    expect(PROMPT_LIBRARY.filter(p => p.plan === 'free')).toHaveLength(6)
    expect(PROMPT_LIBRARY.filter(p => p.plan === 'pro')).toHaveLength(10)
    expect(PROMPT_LIBRARY.filter(p => p.plan === 'studio')).toHaveLength(6)
  })

  it('gates by tier: a plan unlocks its own tier plus everything below', () => {
    expect(isPromptUnlockedForPlan('free', 'free')).toBe(true)
    expect(isPromptUnlockedForPlan('free', 'pro')).toBe(false)
    expect(isPromptUnlockedForPlan('free', 'studio')).toBe(false)

    expect(isPromptUnlockedForPlan('pro', 'free')).toBe(true)
    expect(isPromptUnlockedForPlan('pro', 'pro')).toBe(true)
    expect(isPromptUnlockedForPlan('pro', 'studio')).toBe(false)

    expect(isPromptUnlockedForPlan('studio', 'free')).toBe(true)
    expect(isPromptUnlockedForPlan('studio', 'pro')).toBe(true)
    expect(isPromptUnlockedForPlan('studio', 'studio')).toBe(true)
  })

  it('fails closed on unknown or legacy plan values instead of over-unlocking', () => {
    // Legacy insurance-era rows may carry starter/enterprise. Those must NOT
    // silently grant paid tiers.
    expect(isPromptUnlockedForPlan('enterprise', 'pro')).toBe(false)
    expect(isPromptUnlockedForPlan('starter', 'studio')).toBe(false)
    expect(isPromptUnlockedForPlan('', 'pro')).toBe(false)
    expect(isPromptUnlockedForPlan(null, 'pro')).toBe(false)
    expect(isPromptUnlockedForPlan(undefined, 'pro')).toBe(false)
    expect(promptsForPlan('enterprise').filter(p => p.unlocked)).toHaveLength(6)
  })

  it('unlocks 6 / 16 / 22 prompts per tier while always listing all 22', () => {
    expect(promptsForPlan('free').filter(p => p.unlocked)).toHaveLength(6)
    expect(promptsForPlan('pro').filter(p => p.unlocked)).toHaveLength(16)
    expect(promptsForPlan('studio').filter(p => p.unlocked)).toHaveLength(22)
    // locked prompts stay listed so the upgrade CTA has something to point at
    expect(promptsForPlan('free')).toHaveLength(22)
  })

  it('omits bodies for prompts the plan does not unlock', () => {
    const freePrompts = promptsForPlan('free')

    expect(freePrompts.filter(p => p.body)).toHaveLength(6)
    expect(
      freePrompts
        .filter(p => !p.unlocked)
        .every(p => !Object.hasOwn(p, 'body')),
    ).toBe(true)
  })

  it('ships one pack per tier, each pointing at a real tier', () => {
    expect(PROMPT_PACKS).toHaveLength(3)
    for (const pack of PROMPT_PACKS) {
      expect(PROMPT_PLAN_ORDER).toContain(pack.plan)
      expect(PROMPT_LIBRARY.some(p => p.plan === pack.plan)).toBe(true)
      expect(pack.name.trim().length).toBeGreaterThan(0)
      expect(pack.cta.trim().length).toBeGreaterThan(0)
    }
  })

  it('contains no banned token in rendered copy of the shipped module', () => {
    const source = readFileSync(join(repoRoot, 'src', 'lib', 'prompts.ts'), 'utf8')
    const rendered = renderedCopyOnly(source).toLowerCase()
    const hits = BANNED.filter(token => rendered.includes(token.toLowerCase()))
    expect(hits, `banned tokens in rendered copy of src/lib/prompts.ts: ${hits.join(', ')}`).toEqual([])
  })

  it('never mentions a model or provider name in any prompt body', () => {
    const modelWords = ['llm', 'llama', 'gpt', 'claude', 'openai', 'anthropic', 'groq', 'byok']
    for (const p of PROMPT_LIBRARY) {
      const haystack = `${p.title} ${p.body} ${p.category} ${p.tags.join(' ')}`.toLowerCase()
      for (const w of modelWords) {
        expect(haystack.includes(w), `prompt ${p.id} leaks "${w}"`).toBe(false)
      }
    }
  })

  it('makes no guarantee, refund, or income promise in any prompt body', () => {
    const lawWords = ['guarantee', 'guaranteed', 'refund', 'money-back', 'money back', 'close deals']
    for (const p of PROMPT_LIBRARY) {
      const haystack = `${p.title} ${p.body}`.toLowerCase()
      for (const w of lawWords) {
        expect(haystack.includes(w), `prompt ${p.id} violates no-guarantee law via "${w}"`).toBe(false)
      }
    }
  })
})
