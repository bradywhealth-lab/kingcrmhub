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
  return defaultStageId || stages[0]?.id || ''
}