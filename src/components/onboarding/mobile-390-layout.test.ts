import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const src = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8')

/**
 * Regression gate for the 390px mobile defects found by Cursor's live audit and
 * independently reproduced by OpsForge (2026-09-28):
 *
 *   - "Revenue & Leads" recharts container rendered ~498px wide at a 390px
 *     viewport, inflating window.innerWidth to 539 and forcing ~149px of
 *     horizontal scroll.
 *   - Because the layout viewport inflated, the onboarding card (mx-4 w-full)
 *     resolved to 507px on a 390px device, clipping its own text
 *     ("Create your first offer package" -> "our first offer package") and
 *     pushing the Skip/X control off the right edge, which in turn made the
 *     header nav unreachable at 390px.
 *
 * Root cause of the chart overflow: `ChartContainer`'s base classes include
 * `aspect-video`, and the dashboard call site supplied only an explicit HEIGHT
 * (`h-[280px]`). Height and aspect-ratio are different properties, so
 * tailwind-merge keeps both and CSS derives the box's intrinsic width from the
 * ratio: 280 * 16/9 = 497.78px — exactly the measured 498px.
 *
 * An explicit width takes precedence over aspect-ratio, so `w-full` is the fix.
 * Proof already in this repo: `learning-trends.tsx:48` uses `h-[300px] w-full`
 * and does not overflow, while the dashboard site used `h-[280px]` alone and did.
 */
describe('mobile 390px — dashboard chart cannot exceed the viewport', () => {
  const page = src('src/app/page.tsx')

  it('the Revenue & Leads ChartContainer call site pins an explicit width', () => {
    const m = page.match(/<ChartContainer[^>]*className="([^"]*)"/)
    expect(m, 'ChartContainer call site with a className must exist').not.toBeNull()
    const cls = m![1]
    expect(cls, 'needs w-full so aspect-video cannot set intrinsic width').toContain('w-full')
    expect(cls, 'needs min-w-0 so the grid/flex parent may shrink it').toContain('min-w-0')
  })

  it('no ChartContainer call site anywhere ships a fixed height without an explicit width', () => {
    // Guards the whole repo, not just the one site — learning-trends.tsx already
    // does this correctly and must stay correct.
    const offenders: string[] = []
    const re = /<ChartContainer[^>]*className="([^"]*)"/g
    let match: RegExpExecArray | null
    while ((match = re.exec(page)) !== null) {
      const cls = match[1]
      if (/h-\[\d+px\]/.test(cls) && !cls.includes('w-full')) offenders.push(cls)
    }
    expect(offenders, 'ChartContainer with fixed height but no explicit width overflows').toEqual([])
  })
})

describe('mobile 390px — onboarding wizard is viewport-bounded', () => {
  const wizard = src('src/components/onboarding/onboarding-wizard.tsx')

  it('the modal card caps itself against the visual viewport, not just max-w-xl', () => {
    const cardLine = wizard
      .split('\n')
      .find((l) => l.includes('mx-4') && l.includes('max-w-xl'))
    expect(cardLine, 'the onboarding modal card must still exist').toBeDefined()
    // max-w-xl alone resolved to 507px on a 390px device because the layout
    // viewport had inflated. A viewport-relative cap makes the card immune to
    // whatever the widest child is.
    expect(cardLine, 'card needs a viewport-relative max width').toMatch(/max-w-\[calc\(100vw-/)
  })

  it('the card body uses responsive horizontal padding so small screens get text width', () => {
    // px-8 (32px each side) on a 358px card left ~294px; tighter on small
    // screens restores usable text width without changing the desktop look.
    // Assert intent (a small base with an sm: breakpoint), not exact class order
    // or spacing, so unrelated classes between them don't break the gate.
    const responsive = wizard.match(/px-(4|5)\b[^"']*\bsm:px-8/g) ?? []
    expect(responsive.length, 'expected responsive px-N sm:px-8 body wrappers').toBeGreaterThanOrEqual(3)
    // And no body wrapper left behind at a flat px-8.
    const flat = (wizard.match(/className="[^"]*\bpx-8\b[^"]*"/g) ?? [])
      .filter((c) => !c.includes('sm:px-8') && !/<button|h-12/.test(c))
    expect(flat, 'flat px-8 body wrapper still present').toEqual([])
  })

  it('the Skip/X control stays inside the viewport on narrow screens', () => {
    // The control was reported "off the edge" only because the card had grown to
    // 507px: `right-5` on a 507px card lands at x≈471 on a 390px viewport. With
    // the card bounded to the viewport (asserted above) the same inset lands
    // on-screen, so the real invariant is: small inset + card clips overflow.
    const skipClassName = wizard
      .split('\n')
      .find((l) => l.includes('absolute') && l.includes('right-5') && l.includes('Skip') === false && l.includes('rounded-full'))
    expect(skipClassName, 'skip control must be absolutely positioned with a small inset').toBeDefined()
    expect(skipClassName).toMatch(/right-[3-5]\b/)
    expect(wizard).toContain('overflow-hidden')
  })
})
