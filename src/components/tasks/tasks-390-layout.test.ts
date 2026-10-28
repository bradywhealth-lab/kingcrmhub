import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const view = readFileSync(join(repoRoot, 'src/components/tasks/tasks-view.tsx'), 'utf8')

/**
 * Drift guard for the Tasks-view 390px layout-viewport inflation (t_24be2442).
 *
 * MECHANISM (measured in real Chromium at 390x844 is_mobile, local main-tip 7eb5f7c,
 * 2026-10-02 — same measurement shape as the prod census on t_4fa8a036):
 *
 *   window.innerWidth == documentElement.scrollWidth == 473   <- layout viewport inflated
 *   documentElement.clientWidth == 390
 *   elements wider than the viewport: 0                       <- NO single wide element
 *
 * The TasksView filter-tab strip (Today / This Week / Overdue / Completed) is a
 * `flex` row that never wraps. Measured on the broken build:
 *
 *   strip laid-out content width 448px  (sum of 4 pills at intrinsic width + gaps)
 *   strip max-content width        482px
 *   available container width      342px  (390 - 2*24 page padding - 2*4 strip padding)
 *
 * No pill may shrink below its text+icon min-content, so the strip's flex line
 * min-content is ~448px. That propagates up through the non-wrapping header row
 * into the page's block min-content, and an ICB-sized block box clamps the
 * layout viewport to that min-content: 390 -> 473. This is the same
 * min-content mechanism class as the Defect A chart (mobile-390-layout.test.ts),
 * just with the intrinsic width coming from pill text instead of aspect-ratio.
 *
 * FIX: `max-w-full flex-wrap` on the strip container — the exact pattern already
 * shipped and live-verified on the Settings TabsList (settings-view.tsx, PR #199
 * follow-ups) and measured 390/390 in the same prod sweep that caught Tasks.
 *
 * What this file can and cannot prove: a className assertion cannot prove layout.
 * It pins the mechanism's enabling condition (an unwrappable strip) so the defect
 * class cannot silently return. The binding check remains the measured
 * scrollWidth === innerWidth === 390 pass on the deployed build.
 */
describe('mobile 390px — Tasks filter tab strip cannot inflate the layout viewport', () => {
  it('the FILTER_TABS container wraps and is width-capped', () => {
    const stripLine = view
      .split('\n')
      .find((l) => l.includes('rounded-2xl') && l.includes('bg-card') && l.includes('p-1') && l.includes('flex'))
    expect(stripLine, 'the filter tab strip container must exist').toBeDefined()
    expect(
      stripLine,
      'strip needs max-w-full: without a width cap the strip cannot be constrained by its container',
    ).toContain('max-w-full')
    expect(
      stripLine,
      'strip needs flex-wrap: a no-wrap flex line has min-content ~= sum of pill widths ' +
        '(448px on a 390px device) which inflates the layout viewport to 473px',
    ).toContain('flex-wrap')
  })

  it('the header row keeps its column stack below sm (strip and controls never share one line)', () => {
    // The header is `flex flex-col gap-4 sm:flex-row ...`. Below sm the strip and
    // the view-toggle/Create-Task controls stack, so the only horizontal
    // min-content contributor is the strip itself. If this regresses to a single
    // row, min-content adds the 120px Create Task button on top of the strip.
    const headerLine = view
      .split('\n')
      .find((l) => l.includes('flex flex-col gap-4 sm:flex-row'))
    expect(headerLine, 'responsive header row must exist').toBeDefined()
  })
})
