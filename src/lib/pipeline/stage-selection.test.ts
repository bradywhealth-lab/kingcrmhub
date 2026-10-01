import { describe, expect, it } from 'vitest'
import { stageForOpen, type Stage } from './stage-selection'

const STAGES: Stage[] = [
  { id: 'stage_new', name: 'New' },
  { id: 'stage_won', name: 'Won' },
]

/**
 * S29 review regression. The original dialog preserved the previous selection
 * (`current.stageId || defaultStageId`), so after one use the clicked column was
 * ignored and the deal was filed in the wrong stage. The value must be derived from
 * the default alone.
 */
describe('stageForOpen — the clicked column always wins', () => {
  it('uses the column whose "+" was clicked', () => {
    expect(stageForOpen('stage_won', STAGES)).toBe('stage_won')
  })

  it('does not fall back to the previous selection when a column is given', () => {
    // The old behaviour would have returned the remembered 'stage_new' here.
    expect(stageForOpen('stage_won', STAGES)).not.toBe('stage_new')
  })

  it('falls back to the first stage when opened without a column', () => {
    expect(stageForOpen(undefined, STAGES)).toBe('stage_new')
  })

  it('returns empty when there are no stages, so submit stays disabled', () => {
    expect(stageForOpen(undefined, [])).toBe('')
  })

  it('is stable across repeated opens with different columns', () => {
    const first = stageForOpen('stage_new', STAGES)
    const second = stageForOpen('stage_won', STAGES)
    const third = stageForOpen('stage_new', STAGES)
    expect([first, second, third]).toEqual(['stage_new', 'stage_won', 'stage_new'])
  })
})