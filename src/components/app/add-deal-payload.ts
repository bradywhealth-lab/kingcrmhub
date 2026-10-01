/**
 * Pure helpers for the "Add Deal" dialog (S29).
 *
 * Kept separate from the component so the payload contract can be unit-tested:
 * this repo has no jsdom/@testing-library, so anything inside a React component
 * cannot be exercised by a test. The component owns rendering; this module owns
 * the shape of the request.
 *
 * ## The contract it must satisfy
 * `POST /api/pipeline` validates with `createPipelineItemSchema`
 * (src/app/api/pipeline/route.ts:10-17):
 *   stageId?     string
 *   leadId?      string
 *   title        string, min 1, max 200   <- REQUIRED
 *   value?       coerce.number, nonnegative
 *   probability? coerce.number, int, 0..100
 *   expectedClose? string
 *
 * So a missing/blank title is a guaranteed 400, and a negative or non-numeric
 * value is a guaranteed 400. We validate client-side so the user gets a real
 * reason instead of a generic failure — the exact class of bug as S10, where an
 * optional field silently blocked a save with an unhelpful message.
 */

export type DealDraft = {
  title: string
  value: string
  stageId: string
}

/** Matches the API's `title: z.string().min(1).max(200)`. */
export const DEAL_TITLE_MAX = 200

/**
 * Coerce a user-entered amount into the number the API expects.
 * Returns undefined (omit the field) rather than sending NaN/negative, which the
 * schema rejects as `nonnegative`.
 */
function coerceValue(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  // Strip currency punctuation people actually type: $1,234.50
  const cleaned = trimmed.replace(/[$,\s]/g, '')
  if (cleaned === '') return undefined
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return undefined
  if (n < 0) return undefined
  return n
}

/**
 * Client-side validation with a human-readable reason.
 * Mirrors the server schema so the dialog never submits a body that must 400.
 */
export function validateDealDraft(draft: DealDraft): { ok: true } | { ok: false; reason: string } {
  const title = draft.title.trim()
  if (!title) return { ok: false, reason: 'Give the deal a name.' }
  if (title.length > DEAL_TITLE_MAX) {
    return { ok: false, reason: `Deal names are limited to ${DEAL_TITLE_MAX} characters.` }
  }
  return { ok: true }
}

/**
 * Build the exact JSON body for `POST /api/pipeline`.
 * Blank optional fields are OMITTED (not sent as empty strings), because the
 * schema types stageId/leadId as `z.string().optional()` — an empty string is a
 * valid string and would be stored as a meaningless stage id.
 */
export function buildCreateDealPayload(draft: DealDraft): {
  title: string
  value?: number
  stageId?: string
} {
  const payload: { title: string; value?: number; stageId?: string } = {
    title: draft.title.trim(),
  }
  const value = coerceValue(draft.value)
  if (value !== undefined) payload.value = value
  const stageId = draft.stageId.trim()
  if (stageId) payload.stageId = stageId
  return payload
}
