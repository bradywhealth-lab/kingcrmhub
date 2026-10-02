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
  /** Set when the org's saved BYOK key was rejected/skipped and we fell back to the platform free tier. */
  byokFailure?: string
  /** True when this config uses the org's own saved key (so a runtime auth rejection can retry on the free tier). */
  byokKey?: boolean
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/**
 * Placeholder/junk keys that can be saved through the Settings UI but will
 * never authenticate. Treating these as "no key" lets the platform free tier
 * resolve instead of letting a bogus BYOK key shadow it (production 2026-09-19:
 * every chat 401'd with "Missing Authentication header" because a placeholder
 * BYOK key existed and the free fallback was skipped).
 */
const BYOK_INVALID_PATTERNS: RegExp[] = [
  /^sk-placeholder$/i,
  /^placeholder$/i,
  /^your[_-]?key$/i,
  /^xxx+$/i,
  /^test(ing)?$/i,
  /^api[_-]?key$/i,
  /^(sk|key)-?$/i,
  /^null$/i,
  /^undefined$/i,
]

function isInvalidByokKey(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed) return true
  if (trimmed.length < 8) return true
  if (BYOK_INVALID_PATTERNS.some((p) => p.test(trimmed.replace(/\s+/g, '')))) return true
  return false
}

function normalizeSettings(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function isAuthClassError(err: unknown): boolean {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined
  if (typeof status === 'number' && (status === 401 || status === 403)) return true
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return /401|403|invalid api|api key|auth|permission|missing .*header|denied|forbidden|unauthorized/i.test(msg)
}

function isOutageClassError(err: unknown): boolean {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined
  if (typeof status === 'number' && status >= 500) return true
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  return /5\d\d|overloaded|unavailable|timeout|temporarily/i.test(msg)
}

/**
 * Client-safe error messages. Raw SDK text (e.g. "401 Missing Authentication
 * header") must NEVER reach the user — it is confusing and exposes provider
 * internals with no actionable info.
 */
export function friendlyProviderError(provider: AIProvider, err: unknown): string {
  if (isAuthClassError(err)) {
    // Stream errors surface the runtime provider failure. When a BYOK key
    // 401s we retry with the platform free tier at createChatStream, so an
    // auth error here means the ACTIVE (platform) key failed — never claim
    // the org's saved key is the problem; send the generic actionable message.
    return 'Your AI provider key is invalid or expired — open Settings → AI to fix it.'
  }
  if (isOutageClassError(err)) {
    return 'AI provider temporarily unavailable. Please try again in a moment.'
  }
  return 'AI provider error. Please try again. If it persists, check your provider settings in Settings → AI.'
}

/**
 * Resolve the AI config for an organization.
 * Priority:
 * 1. Org-level BYOK key + chosen provider (ONLY when the key is plausibly real —
 *    placeholder/empty/junk keys do not shadow the free tier)
 * 2. Platform env key for the org's chosen provider
 * 3. OpenRouter free tier (auto-routing)
 * 4. Groq free tier
 * 5. Last-resort platform keys
 * 6. No provider
 */
function byokFailureNotice(rejected: boolean): string {
  return rejected
    ? 'Your saved AI provider key was rejected by the provider — using the platform AI service instead. Open Settings → AI to fix it.'
    : 'Your saved AI provider key is invalid or missing — using the platform AI service instead. Open Settings → AI to fix it.'
}

export async function resolveAIConfig(
  organizationId: string,
  opts?: { skipByokKey?: boolean },
): Promise<AIConfig> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  })

  const settings = normalizeSettings(org?.settings ?? null)
  const provider = (['groq', 'openai', 'anthropic', 'openrouter'].includes(settings.aiProvider as string)
    ? settings.aiProvider
    : null) as AIProvider | null
  const storedKey = typeof settings.aiApiKey === 'string' ? settings.aiApiKey : null
  const orgKey = storedKey && !isInvalidByokKey(storedKey) ? storedKey.trim() : null
  const model = typeof settings.aiModel === 'string' && settings.aiModel
    ? settings.aiModel
    : null

  const byokFailure = storedKey && (opts?.skipByokKey || !orgKey)
    ? byokFailureNotice(Boolean(opts?.skipByokKey))
    : undefined

  // If org has a plausible BYOK key, use their chosen provider
  if (!opts?.skipByokKey && orgKey && provider) {
    return {
      provider,
      model: model || getDefaultModel(provider),
      apiKey: orgKey,
      label: `${provider} (BYOK)`,
      byokKey: true,
    }
  }

  // Platform-key availability (read once, used by the preference branches
  // and the free tier below). Order note: Groq gates the openrouter preference
  // branch precisely because the free tier treats Groq as the first resort.
  const groqKey = process.env.GROQ_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()

  // If org chose openai but no key, check platform env
  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      model: model || 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY,
      label: 'OpenAI (platform)',
      byokFailure,
    }
  }

  // If org chose anthropic but no key, check platform env
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      model: model || 'claude-sonnet-4-20250514',
      apiKey: process.env.ANTHROPIC_API_KEY,
      label: 'Anthropic (platform)',
      byokFailure,
    }
  }

  // If org chose openrouter but no key, check platform env — ONLY when no
  // platform Groq key exists. The free tier's Groq route is measured working
  // where OpenRouter's zero-cost catalog 429s intermittently (2026-10-02 prod
  // outage: a key-less org stored {aiProvider:'openrouter', aiApiKey:null} and
  // this branch pinned it to OpenRouter ahead of Groq; 1-in-9 requests 500'd).
  // A stored provider preference with no usable BYOK key means "no preference".
  // The platform (default) key must NEVER fund a paid model: force the free
  // router unless the org explicitly picked a specific zero-cost `:free` model.
  if (provider === 'openrouter' && !groqKey && process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      model: isFreeOpenRouterModel(model) ? (model as string) : OPENROUTER_FREE_MODEL,
      apiKey: process.env.OPENROUTER_API_KEY,
      label: 'OpenRouter Free (platform)',
      byokFailure,
    }
  }

  // Free tier: Groq (pinned models) -> OpenRouter (pinned :free) -> OpenAI -> none.
  //
  // Groq is checked FIRST because it is the only free route measured returning
  // real answers. Prod holds both GROQ_API_KEY and OPENROUTER_API_KEY, and the
  // previous order tested OpenRouter first — so OpenRouter's auto-router always
  // won and the working Groq key was unreachable. That ordering, not just the
  // model id, is why free-tier replies were nonsense.
  // When falling back to a provider other than the stored one, force its default model.
  if (groqKey) {
    // A stored org model is only honoured on the PLATFORM key when it is one of
    // the pinned free models. Orgs that chose Groq before this deploy still have
    // the previous Groq default persisted in settings.aiModel (it was the old
    // getDefaultModel('groq') result), and the provider now rejects that id — so
    // replaying a stored slug here would keep those accounts failing (codex P1).
    // The literal retired slug is deliberately not written here: this file is
    // asserted to contain zero occurrences of it, so it cannot be re-added by
    // copy-paste. Arbitrary org-chosen models remain honoured in the BYOK branch
    // above, where the org's own key funds them.
    const resolvedModel =
      provider === 'groq' && model && (GROQ_FREE_MODELS as readonly string[]).includes(model)
        ? model
        : GROQ_FREE_MODELS[0]
    return {
      provider: 'groq',
      model: resolvedModel,
      apiKey: groqKey,
      label: 'Groq (free, pinned model)',
      byokFailure,
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim()
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      model: OPENROUTER_FREE_MODEL,
      apiKey: openrouterKey,
      label: 'OpenRouter (free, pinned model)',
      byokFailure,
    }
  }

  // Last resort: check for any platform key
  if (openaiKey) {
    const resolvedModel = (provider === 'openai' && model) ? model : 'gpt-4o'
    return {
      provider: 'openai',
      model: resolvedModel,
      apiKey: openaiKey,
      label: 'OpenAI (platform fallback)',
      byokFailure,
    }
  }

  // No keys available at all
  return {
    provider: 'groq',
    model: GROQ_FREE_MODELS[0],
    apiKey: '',
    label: 'No AI provider configured',
  }
}

export function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'groq': return GROQ_FREE_MODELS[0]
    case 'openai': return 'gpt-4o'
    case 'anthropic': return 'claude-sonnet-4-20250514'
    // A pinned `:free` slug, never the catch-all auto-router (see
    // isFreeOpenRouterModel) so the platform key stays zero-cost AND answers.
    case 'openrouter': return OPENROUTER_FREE_MODEL
  }
}

/**
 * Pinned $0 Groq models, best-first.
 *
 * These are the only free routes measured returning real sentence answers on the
 * platform key (OpsForge, 2026-09-28): gpt-oss-120b 376ms, gpt-oss-20b 313ms,
 * qwen3.8-27b 278ms. Pinned rather than auto-routed so a sales prompt can never
 * land on a coding model or a content-safety classifier.
 */
export const GROQ_FREE_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
] as const

/**
 * Pinned $0 OpenRouter slug, used only when no Groq key exists.
 *
 * OpenRouter's zero-cost catalog was measured unreliable (429 provider
 * rate-limit or "unavailable for free, use the paid slug"), which is why it
 * sits behind Groq rather than in front of it.
 */
export const OPENROUTER_FREE_MODEL = 'qwen/qwen3.8-27b:free'

/**
 * True when an OpenRouter model id is guaranteed zero-cost: an explicit
 * `:free` catalog slug only. Used to keep the platform (default) OpenRouter key
 * from ever funding a paid model.
 *
 * OpenRouter's catch-all free ROUTER is deliberately excluded. It only ever
 * selects zero-cost models, but it selects *arbitrary* ones per request, and
 * that was measured returning reasoning-only replies from a coding model
 * (`content: null`) and from a content-safety classifier — i.e. zero-cost but
 * not an answer. Cost-safety and answer-quality are different guarantees, and
 * a router satisfies only the first. Excluding it here also coerces any org
 * whose stored model predates the pin.
 */
export function isFreeOpenRouterModel(model: string | null | undefined): boolean {
  if (!model) return false
  // Only an explicit `:free` catalog slug is guaranteed zero-cost. The
  // catch-all auto-router is deliberately NOT accepted: it selects arbitrary
  // models per request, which produced reasoning-only and safety-classifier
  // replies instead of answers. Rejecting it here also coerces any org whose
  // stored model predates this change.
  return model.endsWith(':free')
}

/** Remaining pinned Groq models after `current`, for platform-key failover. */
function groqFailoverCandidates(current: string): string[] {
  const idx = (GROQ_FREE_MODELS as readonly string[]).indexOf(current)
  if (idx < 0) return [...GROQ_FREE_MODELS]
  return [...GROQ_FREE_MODELS.slice(idx + 1)]
}

/**
 * Create a streaming chat completion using the resolved AI config.
 * Returns a ReadableStream of SSE events.
 */
export async function createChatStream(
  config: AIConfig,
  messages: ChatMessage[],
  opts?: { organizationId?: string },
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()

  const attempt = async (cfg: AIConfig): Promise<ReadableStream<Uint8Array>> => {
    if (cfg.provider === 'groq') {
      return createGroqStream(cfg, messages, encoder)
    }
    if (cfg.provider === 'openai') {
      return createOpenAIStream(cfg, messages, encoder)
    }
    if (cfg.provider === 'anthropic') {
      return createAnthropicStream(cfg, messages, encoder)
    }
    if (cfg.provider === 'openrouter') {
      return createOpenRouterStream(cfg, messages, encoder)
    }
    throw new Error(`Unsupported provider: ${cfg.provider}`)
  }

  try {
    return await attempt(config)
  } catch (err) {
    // Platform Groq key: walk the remaining pinned models before giving up.
    // The pinned list is best-first CANDIDATES — selecting only index 0 meant a
    // model-specific 429/access error failed the whole free-tier request even
    // though alternatives were listed (codex P2 + cubic P2). Deliberately NOT
    // applied to BYOK keys: the org chose that model and funds it themselves.
    if (config.provider === 'groq' && !config.byokKey) {
      for (const nextModel of groqFailoverCandidates(config.model)) {
        try {
          return await attempt({ ...config, model: nextModel })
        } catch {
          continue
        }
      }
    }
    // Platform OpenRouter key: OpenRouter's zero-cost catalog 429s
    // intermittently ('…temporarily rate-limited upstream'), which surfaced as
    // user-visible HTTP 500 (t_c1c40620). Mirror the Groq failover: fall over
    // ONCE to the platform Groq key with its DEFAULT model — never the stored
    // slug of the provider that just failed. Deliberately NOT applied to BYOK
    // keys: the org chose that provider and funds it themselves.
    if (config.provider === 'openrouter' && !config.byokKey) {
      const groqFailoverKey = process.env.GROQ_API_KEY?.trim()
      if (groqFailoverKey) {
        try {
          return await attempt({
            ...config,
            provider: 'groq',
            model: getDefaultModel('groq'),
            apiKey: groqFailoverKey,
            label: 'Groq (free, failover from OpenRouter)',
          })
        } catch {
          // fall through: original error is the honest failure
        }
      }
    }
    // When the org's BYOK key is structurally valid but rejected at request
    // time (expired/revoked), retry once with the platform free tier so a bad
    // BYOK key cannot shadow the free default (P1).
    if (config.byokKey && isAuthClassError(err) && opts?.organizationId) {
      const fallback = await resolveAIConfig(opts.organizationId, { skipByokKey: true })
      if (fallback.apiKey) {
        return await attempt(fallback)
      }
    }
    throw err
  }
}

/** Prefix a BYOK-fallback notice onto a stream (SSE event the client renders as a banner). */
function withByokNotice(
  stream: ReadableStream<Uint8Array>,
  config: AIConfig,
  encoder: TextEncoder,
): ReadableStream<Uint8Array> {
  if (!config.byokFailure) return stream
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ notice: config.byokFailure })}\n\n`))
      const reader = stream.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
        }
        controller.close()
      } catch (err) {
        try { controller.error(err) } catch { /* no-op */ }
      } finally {
        reader.releaseLock()
      }
    },
  })
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

  const base = new ReadableStream({
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
        const msg = friendlyProviderError('groq', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
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

  const base = new ReadableStream({
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
        const msg = friendlyProviderError('openai', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
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

  const base = new ReadableStream({
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
        const msg = friendlyProviderError('anthropic', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
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

  const base = new ReadableStream({
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
        const msg = friendlyProviderError('openrouter', err)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return withByokNotice(base, config, encoder)
}
