import type { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import { db } from '@/lib/db'

export type AIProvider = 'groq' | 'openai' | 'anthropic' | 'openrouter'

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
 * 3. Platform OpenRouter key (OPENROUTER_API_KEY) — free tier with auto-routing
 * 4. Platform Groq key (GROQ_API_KEY) as fallback
 * 5. Hard fallback: no provider
 */
export async function resolveAIConfig(organizationId: string): Promise<AIConfig> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  const settings = normalizeSettings(org?.settings ?? null)
  const provider = (['groq', 'openai', 'anthropic', 'openrouter'].includes(settings.aiProvider as string)
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

  // If org chose openrouter but no key, check platform env
  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      model: model || 'openrouter/free',
      apiKey: process.env.OPENROUTER_API_KEY,
      label: 'OpenRouter (platform)',
    }
  }

  // Free tier: OpenRouter (platform key) -> Groq (platform key) -> OpenAI (platform key) -> no provider
  // When falling back to a different provider than stored, force default model
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: openrouterKey,
      label: 'OpenRouter Free (auto-routing)',
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim()
  if (groqKey) {
    const resolvedModel = (provider === 'groq' && model) ? model : 'llama-3.3-70b-versatile'
    return {
      provider: 'groq',
      model: resolvedModel,
      apiKey: groqKey,
      label: 'Groq Llama 3.3 (free)',
    }
  }

  // Last resort: check for any platform key
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  if (openaiKey) {
    const resolvedModel = (provider === 'openai' && model) ? model : 'gpt-4o'
    return {
      provider: 'openai',
      model: resolvedModel,
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

export function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'groq': return 'llama-3.3-70b-versatile'
    case 'openai': return 'gpt-4o'
    case 'anthropic': return 'claude-sonnet-4-20250514'
    case 'openrouter': return 'openrouter/free'
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
    return createAnthropicStream(config, messages, encoder)
  }

  if (config.provider === 'openrouter') {
    return createOpenRouterStream(config, messages, encoder)
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
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://api.anthropic.com/v1/',
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'x-api-key': config.apiKey,
    },
  })

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

async function createOpenRouterStream(
  config: AIConfig,
  messages: ChatMessage[],
  encoder: TextEncoder,
): Promise<ReadableStream<Uint8Array>> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.APP_BASE_URL || 'https://kingcrmhub.net',
      'X-Title': 'King CRM Hub',
    },
  })

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
        const msg = err instanceof Error ? err.message : 'OpenRouter stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })
}
