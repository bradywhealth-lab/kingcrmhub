/**
 * AI provider error classification.
 *
 * Maps raw SDK/provider errors to typed, user-safe messages. NEVER include
 * raw SDK text, keys, or provider secrets in any returned message — those
 * strings are rendered directly in the assistant banner/toast.
 */

export const AI_KEY_REJECTED_MESSAGE =
  'Your AI provider key was rejected. Open Settings → AI to fix or remove it (falling back to free tier removes it).'

export const AI_GENERIC_MESSAGE = 'AI provider request failed. Please try again.'

export type AIErrorKind = 'ai_key_rejected' | 'generic'

export function classifyAIError(err: unknown): { kind: AIErrorKind; message: string } {
  if (err instanceof Error) {
    const text = `${err.name} ${err.message}`
    const low = text.toLowerCase()
    if (
      /401|authentication_error|missing authentication|invalid api key|incorrect api key|api key invalid|authentication failed|unauthorized/i.test(low) ||
      /(no api key|missing credentials?|api key).*(provided|found|configured)/i.test(low)
    ) {
      return { kind: 'ai_key_rejected', message: AI_KEY_REJECTED_MESSAGE }
    }
  }
  return { kind: 'generic', message: AI_GENERIC_MESSAGE }
}
