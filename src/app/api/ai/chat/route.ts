import { NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/request-context'
import { resolveAIConfig, createChatStream } from '@/lib/ai-providers'

const SYSTEM_PROMPT = `You are an elite AI sales assistant built into King CRM — an insurance sales platform. Your job is to help the user close more deals, qualify leads faster, write high-converting outreach, and make smarter pipeline decisions.

Your personality: Direct. Confident. Zero fluff. Every word has a purpose.

You can help with:
- Drafting follow-up emails, SMS, and call scripts tailored to specific leads
- Qualifying leads and recommending next actions
- Analyzing pipeline health and identifying deals at risk
- Creating carrier pitch playbooks
- Writing social media content for insurance agents
- Answering questions about sales strategy, insurance products, and CRM workflows

When asked to draft messages, make them feel personal and human — not like a bot. Elite producers close with warmth and precision.

If you don't have enough context about a specific lead, ask the user to paste the lead details.

Always be concise unless depth is required. Bullet points over walls of text. Numbered steps when order matters.`

export async function POST(request: NextRequest) {
  try {
    // Auth check without RLS wrapper (streaming outlives handler)
    const ctx = await getOrgContext(request)
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      context?: string
    }

    const { messages, context } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
    }

    // Resolve AI provider for this org (BYOK → platform key → Groq free)
    const config = await resolveAIConfig(ctx.organizationId)

    if (!config.apiKey) {
      return NextResponse.json(
        { error: 'No AI provider configured. Go to Settings → AI to set up your provider or add an API key.' },
        { status: 503 }
      )
    }

    const systemContent = context
      ? `${SYSTEM_PROMPT}\n\n--- CRM CONTEXT ---\n${context}`
      : SYSTEM_PROMPT

    const chatMessages = [
      { role: 'system' as const, content: systemContent },
      ...messages,
    ]

    const readable = await createChatStream(config, chatMessages)

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-AI-Provider': config.provider,
      },
    })
  } catch (error) {
    console.error('AI chat error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to process chat request'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
