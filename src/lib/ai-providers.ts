import type { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import { db } from '@/lib/db'

export type AIProvider = 'groq' | 'openai' | 'anthropic'

type AIConfig = {
  provider: AIProvider
  model: string
  apiKey: string
  label: string
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function normalizeSettings(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * Resolve the AI config for an organization.
 * Priority:
 * 1. Org-level BYOK key + chosen provider
 * 2. Platform env key (OPENAI_API_KEY) if provider is openai
 * 3. Platform Groq key (GROQ_API_KEY) as free fallback
 * 4. Hard fallback: Groq free tier
 */
export async function resolveAIConfig(organizationId: string): Promise<AIConfig> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  const settings = normalizeSettings(org?.settings ?? null)
  const provider = (['groq', 'openai', 'anthropic'].includes(settings.aiProvider as string)
    ? settings.aiProvider
    : null) as AIProvider | null
  const orgKey = typeof settings.aiApiKey === 'string' && settings.aiApiKey.length > 0
    ? settings.aiApiKey
    : null
  const model = typeof settings.aiModel === 'string' && settings.aiModel
    ? settings.aiModel
    : null

  // If org has a BYOK key, use their chosen provider
  if (orgKey && provider) {
    return {
      provider,
      model: model || getDefaultModel(provider),
      apiKey: orgKey,
      label: `${provider} (BYOK)`,
    }
  }

  // If org chose openai but no key, check platform env
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: model || 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      label: 'OpenAI (platform)',
    }
  }

  // If org chose anthropic but no key, check platform env
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      model: model || 'claude-sonnet-4-20250514',
      apiKey: process.env.ANTHROPIC_API_KEY,
      label: 'Anthropic (platform)',
    }
  }

  // Free tier: Groq (platform key) → OpenAI (platform key) → no provider
  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    return {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      apiKey: groqKey,
      label: 'Groq Llama 3.3 (free)',
    }
  }

  // Last resort: check for any platform key
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    return {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: openaiKey,
      label: 'OpenAI (platform fallback)',
    }
  }

  // No keys available at all
  return {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    apiKey: '',
    label: 'No AI provider configured',
  }
}

function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'groq': return 'llama-3.3-70b-versatile'
    case 'openai': return 'gpt-4o'
    case 'anthropic': return 'claude-sonnet-4-20250514'
  }
}

/**
 * Create a streaming chat completion using the resolved AI config.
 * Returns a ReadableStream of SSE events.
 */
export async function createChatStream(
  config: AIConfig,
  messages: ChatMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()

  if (config.provider === 'groq') {
    return createGroqStream(config, messages, encoder)
  }

  if (config.provider === 'openai') {
    return createOpenAIStream(config, messages, encoder)
  }

  if (config.provider === 'anthropic') {
    // Anthropic uses OpenAI-compatible endpoint via their SDK
    // For simplicity, use the OpenAI SDK with Anthropic's base URL
    return createAnthropicStream(config, messages, encoder)
  }

  throw new Error(`Unsupported provider: ${config.provider}`)
}

async function createGroqStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const groq = new Groq({ apiKey: config.apiKey })

  const stream = await groq.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Groq stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })
}

async function createOpenAIStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const openai = new OpenAI({ apiKey: config.apiKey })

  const stream = await openai.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'OpenAI stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })
}

async function createAnthropicStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  // Use OpenAI SDK with Anthropic's OpenAI-compatible endpoint
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://api.anthropic.com/v1/',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'x-api-key': config.apiKey,
    },
  })

  // Anthropic expects system as a separate param, but via messages API it works
  const stream = await client.chat.completions.create({
    model: config.model,
    stream: true,
    messages,
    max_tokens: 1500,
    temperature: 0.7,
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Anthropic stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })
}
