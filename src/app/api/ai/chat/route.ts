import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withRequestOrgContext } from '@/lib/request-context'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
    return withRequestOrgContext(request, async () => {
      const body = await request.json() as {
        messages: { role: 'user' | 'assistant'; content: string }[]
        context?: string
      }

      const { messages, context } = body

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
      }

      const systemContent = context
        ? `${SYSTEM_PROMPT}\n\n--- CRM CONTEXT ---\n${context}`
        : SYSTEM_PROMPT

      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        stream: true,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
        max_tokens: 1500,
        temperature: 0.7,
      })

      const encoder = new TextEncoder()

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (err) {
            controller.error(err)
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    })
  } catch (error) {
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 })
  }
}
