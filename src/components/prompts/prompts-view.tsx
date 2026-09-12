'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Lock, Sparkles, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import type { PromptPlan, PromptWithUnlock } from '@/lib/prompts'
import { buildApiPath } from '@/lib/api-client'

/**
 * Prompts tab — tier-gated library.
 *
 * The server derives the plan from the authenticated organization and omits
 * locked prompt bodies from its response.
 *
 * Locked prompts stay VISIBLE with the upgrade CTA rather than being hidden —
 * per Atlas spec, hiding them removes the reason to upgrade.
 */

const PACK_BY_PLAN: Record<PromptPlan, { name: string; tagline: string }> = {
  free: { name: 'Starter Six', tagline: 'Your first six client prompts — free, forever.' },
  pro: { name: 'Pro Ten', tagline: 'Negotiation, outreach, and growth scripts.' },
  studio: { name: 'Builder Six', tagline: 'Offers, positioning, launch sequences.' },
}

const PLAN_LABEL: Record<PromptPlan, string> = {
  free: 'Free',
  pro: 'Pro',
  studio: 'Studio',
}

export function PromptsView({
  onUpgrade,
  onRunInAssistant,
}: {
  onUpgrade?: () => void
  onRunInAssistant?: () => void
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [prompts, setPrompts] = useState<PromptWithUnlock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        // buildApiPath keeps the request under NEXT_PUBLIC_BASE_PATH (cubic P2).
        const response = await fetch(buildApiPath('/api/prompts'), { cache: 'no-store' })
        if (response.status === 401) { window.location.href = buildApiPath('/auth'); return }
        if (!response.ok) throw new Error('Failed to load prompts')
        const data = await response.json() as { prompts?: PromptWithUnlock[] }
        if (!cancelled) setPrompts(Array.isArray(data.prompts) ? data.prompts : [])
      } catch {
        if (!cancelled) {
          toast({
            title: 'Prompts unavailable',
            description: 'Please refresh the page to try again.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const unlockedCount = prompts.filter((p) => p.unlocked).length

  const copyPrompt = async (id: string, title: string, body: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(body)
      setCopiedId(id)
      toast({ title: 'Prompt copied', description: `"${title}" is on your clipboard.` })
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1600)
      return true
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access. Select the text and copy manually.',
        variant: 'destructive',
      })
      return false
    }
  }

  const runInAssistant = async (prompt: PromptWithUnlock) => {
    if (!prompt.body) return
    const copied = await copyPrompt(prompt.id, prompt.title, prompt.body)
    if (copied) onRunInAssistant?.()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-[var(--ink)] px-6 py-7">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--teal)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--teal)]">
            Prompt library
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--paper)]">
          Copy-ready prompts for your clients
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-soft)]">
          {loading
            ? 'Loading the prompts available on your current plan…'
            : `${unlockedCount} of ${prompts.length} unlocked on your current plan. Copy one, paste it into the AI Assistant, and fill in the brackets.`}
        </p>
      </div>

      {(['free', 'pro', 'studio'] as PromptPlan[]).map((tier) => {
        const tierPrompts = prompts.filter((p) => p.plan === tier)
        if (tierPrompts.length === 0) return null
        const tierUnlocked = tierPrompts[0].unlocked
        const pack = PACK_BY_PLAN[tier]

        return (
          <section key={tier} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-base font-semibold text-[var(--ink)]">{pack.name}</h3>
              <Badge
                variant="outline"
                className={
                  tierUnlocked
                    ? 'border-[var(--teal-deep)] text-[var(--teal-deep)]'
                    : 'border-[rgba(31,42,54,0.2)] text-[rgba(31,42,54,0.55)]'
                }
              >
                {tierUnlocked ? `${PLAN_LABEL[tier]} — unlocked` : `${PLAN_LABEL[tier]} tier`}
              </Badge>
              <span className="text-xs text-[rgba(31,42,54,0.55)]">{pack.tagline}</span>
              {!tierUnlocked && (
                <Button
                  size="sm"
                  className="ml-auto bg-[var(--teal)] text-[var(--ink)] hover:opacity-90"
                  onClick={onUpgrade}
                >
                  {tier === 'pro' ? 'Unlock with Pro' : 'Unlock with Studio'}
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {tierPrompts.map((p) => (
                <Card
                  key={p.id}
                  className={
                    p.unlocked
                      ? 'border-[rgba(31,42,54,0.1)] bg-white'
                      : 'border-[rgba(31,42,54,0.08)] bg-[rgba(31,42,54,0.03)]'
                  }
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--ink)]">{p.title}</p>
                        <p className="mt-0.5 text-xs text-[rgba(31,42,54,0.5)]">{p.category}</p>
                      </div>
                      {!p.unlocked && (
                        <Lock className="h-4 w-4 shrink-0 text-[rgba(31,42,54,0.35)]" aria-label="Locked on your plan" />
                      )}
                    </div>

                    {p.unlocked && p.body ? (
                      <>
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--paper)] p-3 font-mono text-[11px] leading-5 text-[var(--ink)]">
                          {p.body}
                        </pre>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[rgba(31,42,54,0.15)] text-[var(--ink)]"
                            onClick={() => void copyPrompt(p.id, p.title, p.body)}
                          >
                            {copiedId === p.id ? (
                              <Check className="mr-1.5 h-3.5 w-3.5 text-[var(--teal-deep)]" />
                            ) : (
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {copiedId === p.id ? 'Copied' : 'Copy prompt'}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-[var(--teal)] text-[var(--ink)] hover:opacity-90"
                            onClick={() => void runInAssistant(p)}
                          >
                            Run in AI Assistant
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="rounded-xl bg-[rgba(31,42,54,0.04)] p-3 text-xs leading-5 text-[rgba(31,42,54,0.5)]">
                          Available on {PLAN_LABEL[tier]}. Unlock to copy and run this prompt.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[var(--teal-deep)] text-[var(--teal-deep)]"
                          onClick={onUpgrade}
                        >
                          {tier === 'pro' ? 'Unlock with Pro' : 'Unlock with Studio'}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
