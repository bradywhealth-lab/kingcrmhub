export type Stage = { id: string; name: string }

/**
 * Which stage a deal-creating form should start in when it opens.
 *
 * Derived from the default ALONE — never from a previous selection. The first cut
 * of the S29 dialog preserved the prior value (`current.stageId || defaultStageId`),
 * so after one use the clicked column was ignored: "Add deal to Won" reopened still
 * scoped to "New" and filed the deal in the wrong column. Keeping this a pure
 * function makes that regression directly testable without a DOM.
 */
export function stageForOpen(defaultStageId: string | undefined, stages: Stage[]): string {
  // Only honour a default that actually exists in the loaded stages: a stale or
  // unavailable column id would otherwise leave the Select blank while still POSTing
  // that id, which the backend rejects with 404 "Stage not found".
  if (defaultStageId && stages.some((stage) => stage.id === defaultStageId)) return defaultStageId
  return stages[0]?.id || ''
}

export type DealForm = {
  title: string
  value: string
  stageId: string
  expectedClose: string
}

/**
 * The form a deal dialog must start from every time it opens. Deliberately derives
 * from nothing but its arguments: the S29 regression was the dialog carrying a
 * previous visit's stage into the next open, and a function with no access to prior
 * state cannot reproduce that bug.
 */
export function buildDealForm(defaultStageId?: string, stages: Stage[] = []): DealForm {
  return { title: '', value: '', stageId: stageForOpen(defaultStageId, stages), expectedClose: '' }
}