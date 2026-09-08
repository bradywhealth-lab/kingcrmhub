'use client'

import { Bot, Compass, LifeBuoy, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const gettingStarted = [
  'Import or add your first leads',
  'Configure your AI provider in Settings → AI',
  'Test the AI assistant with a simple prompt before relying on it',
  'Upload at least one offer document',
  'Qualify your first lead',
  'Generate an offer playbook or follow-up',
]

const featureGuides = [
  {
    title: 'How to get the most out of KingCRM',
    body: 'Use the dashboard as your operating rhythm. Start with My Day, clear urgent next actions, then work leads by highest signal and stale-deal risk.',
  },
  {
    title: 'How to use the AI assistant well',
    body: 'Give the assistant lead context, pipeline stage, and your objective. Best prompts are specific: ask for next actions, scripts, follow-ups, or objection handling.',
  },
  {
    title: 'How to win with offer playbooks',
    body: 'Upload clean offer docs first. Then use playbooks to generate qualification summaries, script ideas, objections, and next actions grounded in your source docs.',
  },
]

const troubleshooting = [
  'AI not responding? Check Settings → AI and confirm a provider is actually available.',
  'Seeing Unauthorized? Sign out and back in, or make sure your session cookie is present on this domain.',
  'Seeing an empty or failed AI response? The deployment may have a bad provider selection or missing fallback key. Switch provider in Settings → AI and test again.',
  'No AI provider configured? Add your own key or use the platform fallback if it is enabled for this deployment.',
  'Offer playbook weak? Upload better source docs before expecting grounded answers.',
]

export function HelpCenterView({ onJumpToSettingsAI }: { onJumpToSettingsAI?: () => void }) {
  return (
    <div className="min-h-screen space-y-6 bg-[#faf7ee] p-6">
      <div>
        <h1 className="text-2xl font-bold text-black">Help Center</h1>
        <p className="text-gray-500">Learn the app fast, get value fast, and know what to do next.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-[var(--ink-line)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black"><Compass className="h-5 w-5 text-[#127c66]" /> Getting started in 10 minutes</CardTitle>
            <CardDescription>Follow this order so you unlock the real value of the CRM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {gettingStarted.map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-lg border border-[var(--ink-line)] bg-[#f4f0e6] px-4 py-3">
                <span className="text-sm text-black">{index + 1}. {item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[var(--ink-line)] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-black"><Sparkles className="h-5 w-5 text-[#127c66]" /> Quick actions</CardTitle>
            <CardDescription>Use these when the workspace needs setup or the AI assistant is not helping enough.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="btn-gold w-full justify-start" onClick={() => onJumpToSettingsAI?.()}>
              <Bot className="mr-2 h-4 w-4" /> Configure AI now
            </Button>
            <div className="rounded-lg border border-[var(--ink-line)] bg-[#f4f0e6] p-4 text-sm text-gray-600">
              Best question to ask the assistant: <span className="font-medium text-black">“What are my top 3 next actions today and why?”</span>
            </div>
            <div className="rounded-lg border border-[var(--ink-line)] bg-[#f4f0e6] p-4 text-sm text-gray-600">
              Best workflow: qualify lead → open playbook → generate follow-up → log activity → revisit My Day.
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Recovery flow if AI feels broken: open Settings → AI, confirm provider, send a simple test prompt in AI Assistant, then retry your real lead-specific prompt.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[var(--ink-line)] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-black"><Bot className="h-5 w-5 text-[#127c66]" /> Feature guides</CardTitle>
          <CardDescription>Focused advice for using the product well, not generic filler.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {featureGuides.map((guide) => (
            <div key={guide.title} className="rounded-lg border border-[var(--ink-line)] bg-[#f4f0e6] p-4">
              <div className="font-medium text-black">{guide.title}</div>
              <p className="mt-2 text-sm text-gray-600">{guide.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-[var(--ink-line)] bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-black"><LifeBuoy className="h-5 w-5 text-[#127c66]" /> Troubleshooting</CardTitle>
          <CardDescription>Most common reasons the CRM feels broken or underpowered.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          {troubleshooting.map((item) => (
            <div key={item} className="rounded-lg border border-[var(--ink-line)] bg-[#f4f0e6] p-4">{item}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
