import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildDealForm, stageForOpen, type Stage } from './stage-selection'

const STAGES: Stage[] = [
  { id: 'stage_new', name: 'New' },
  { id: 'stage_won', name: 'Won' },
]

/**
 * S29. The board could not create a deal at all; the CTA opened the LEAD dialog.
 *
 * ## The regression these tests exist for
 * The first cut preserved the previous selection (`current.stageId || defaultStageId`),
 * so after one use the clicked column was ignored: "Add deal to Won" reopened still
 * scoped to "New" and filed the deal in the wrong column, silently. The fix is that
 * the form is *derived* on every open, never carried forward.
 *
 * ## Honest limitation
 * This project has no jsdom, so there is no component test that opens the dialog
 * twice and reads the rendered Select. The derivation is therefore extracted into
 * pure functions (`stageForOpen`, `buildDealForm`) that a test can drive directly,
 * plus a source guard that the dialog actually calls them on open and does NOT
 * reintroduce the `current.stageId` carry-over. That combination is the strongest
 * check available here; it is not equivalent to rendering the component.
 */
describe('stageForOpen', () => {
  it('uses the column whose "+" was clicked', () => {
    expect(stageForOpen('stage_won', STAGES)).toBe('stage_won')
  })

  it('ignores a default that is not among the loaded stages', () => {
    // A stale column id would otherwise leave the Select blank while still POSTing
    // that id, which the backend rejects with 404 "Stage not found".
    expect(stageForOpen('stage_deleted', STAGES)).toBe('stage_new')
  })

  it('falls back to the first stage when opened without a column', () => {
    expect(stageForOpen(undefined, STAGES)).toBe('stage_new')
  })

  it('returns empty when there are no stages, so submit stays disabled', () => {
    expect(stageForOpen(undefined, [])).toBe('')
  })
})

describe('buildDealForm — every open re-scopes, nothing is carried forward', () => {
  it('scopes the form to the clicked column', () => {
    expect(buildDealForm('stage_won', STAGES).stageId).toBe('stage_won')
  })

  it('gives each open its own column, never the previous one', () => {
    // The old bug's signature: the second open would have returned 'stage_new'.
    const first = buildDealForm('stage_new', STAGES)
    const second = buildDealForm('stage_won', STAGES)
    expect([first.stageId, second.stageId]).toEqual(['stage_new', 'stage_won'])
  })

  it('is unaffected by a prior open, in any order', () => {
    buildDealForm('stage_won', STAGES)
    expect(buildDealForm('stage_new', STAGES).stageId).toBe('stage_new')
    buildDealForm('stage_new', STAGES)
    expect(buildDealForm('stage_won', STAGES).stageId).toBe('stage_won')
  })

  it('starts with the text fields cleared', () => {
    expect(buildDealForm('stage_won', STAGES)).toMatchObject({
      title: '',
      value: '',
      expectedClose: '',
    })
  })
})

describe('dialog wiring — the derivation is actually used', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/app/add-deal-dialog.tsx'), 'utf8')

  it('resets the form from buildDealForm when it opens', () => {
    expect(source).toMatch(/if \(!open\) return[\s\S]{0,400}setForm\(buildDealForm\(/)
  })

  it('does not carry a previous selection into the next open', () => {
    // The exact P1 signature. Reintroducing the bug requires reading the prior state,
    // so forbidding that read is a real guard, not a string coincidence.
    expect(source, 'the dialog must not preserve a previous stageId').not.toMatch(/current\.stageId/)
  })

  it('resolves the stage through stageForOpen', () => {
    expect(source).toContain('stageForOpen(defaultStageId, next)')
  })

  it('cannot be submitted without a resolved stage', () => {
    // cubic P2: a non-empty stage list from a previous visit kept the button enabled
    // while the stage was still unresolved, so a quick submit omitted stageId and
    // placed the deal in the first stage.
    expect(source).toMatch(/disabled=\{saving \|\| loadingStages \|\| !form\.stageId\}/)
    expect(source).toMatch(/if \(!form\.stageId\) \{/)
  })
})