import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

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

  /**
   * MECHANISM (measured in real Chromium at 390px, not reasoned from spec):
   *
   * The chart's intrinsic width comes from ChartContainer's `aspect-video`
   * (chart.tsx:56) combined with the call site's explicit `h-[280px]`:
   * 280 * 16/9 = 497.77px. That becomes the min-content width of its ancestor
   * Card, and because the Card is a GRID ITEM its default `min-width:auto`
   * prevents the `1fr` track from shrinking below ~522px — which inflates the
   * layout viewport itself (window.innerWidth measured 539 on a 390 device).
   *
   * DIVISION OF LABOUR (cubic P3 clarification): width alone cannot prevent
   * the overflow — that is the GRID ITEM's job via `min-w-0`, because the track
   * must be allowed to shrink below the chart's min-content width. `w-full` /
   * `min-w-0` ON THE CHART are the FILL side: they make the chart occupy its
   * (now-shrinkable) track instead of collapsing. Under the plain-1fr harness
   * both were measured at 497.77px with and without — width classes on the chart
   * alone left the track unable to shrink. An earlier revision of this test
   * asserted exactly those chart classes as THE fix and therefore PASSED on code
   * that still overflowed by 174px — a green test guarding a non-fix. It was
   * replaced by one that pins the element whose job the fix actually is.
   *
   * The fix is `min-w-0` on the GRID ITEM. Measured fix matrix at 390px:
   *   chart min-w-0 only        -> 497.77px, scrollWidth 564  (STILL OVERFLOWS)
   *   Card min-w-0 + chart full -> 308px,    scrollWidth 390  (FIXED)
   *   Card+chart min-w-0        -> 308px,    scrollWidth 390  (FIXED)
   *   aspect-auto on chart      -> 308px,    scrollWidth 390  (FIXED)
   * Variant "Card min-w-0" was chosen: one class, one line, keeps the 16:9 ratio,
   * and does not touch the shared chart.tsx component every chart depends on.
   */
  it('the charts-row grid item (Card) carries min-w-0 so its track can shrink', () => {
    const cardLine = page
      .split('\n')
      .find((l) => l.includes('lg:col-span-2') && l.includes('<Card'))
    expect(cardLine, 'the Revenue & Leads Card grid item must exist').toBeDefined()
    expect(
      cardLine,
      'grid item needs min-w-0: without it min-width:auto keeps the 1fr track at the ' +
        "chart's 497.77px min-content width and inflates the layout viewport",
    ).toContain('min-w-0')
  })

  it('every ChartContainer call site in src keeps an explicit width', () => {
    // Secondary hygiene only. NOTE: this assertion is NOT sufficient to prevent
    // the overflow on its own — see the mechanism comment above. It is kept
    // because an explicit width is still required for the chart to fill its
    // (now shrinkable) track instead of collapsing.
    const root = join(repoRoot, 'src')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry.name)) files.push(full)
      }
    }
    walk(root)

    const offenders: string[] = []
    let scanned = 0
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      if (!text.includes('<ChartContainer')) continue
      const re = /<ChartContainer[^>]*className="([^"]*)"/g
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        scanned++
        const cls = m[1]
        // cubic P2: fixed-height utilities come in more forms than arbitrary px
        // brackets — h-72 (=18rem=288px; 288*16/9=512px overflows identically),
        // h-96, sm:h-96, and h-[Npx]/h-[Nrem]. Miss any of them and this
        // repo-wide guard stays green while the documented overflow returns.
        if (/(?:h-\[\d+(?:px|rem|em)?\]|\bh-\d+\b)/.test(cls) && !cls.includes('w-full')) {
          offenders.push(`${file.replace(root + sep, '')}: ${cls}`)
        }
      }
    }
    expect(scanned, 'guard must scan real ChartContainer call sites').toBeGreaterThanOrEqual(2)
    expect(offenders, 'fixed-height ChartContainer without explicit width').toEqual([])
  })

  // NOTE — what this file can and cannot prove (cubic P3):
  // A className assertion cannot prove layout, and no in-repo test can verify the
  // measured-evidence file (a LOCAL plan-folder artifact that does not exist on
  // CI runners — an existsSync assertion here would fail the GitHub build).
  // The binding acceptance check is scrollWidth === innerWidth at a 390px
  // viewport against PRODUCTION, run post-deploy. Recorded so nobody mistakes a
  // green suite for a verified render — which is exactly the mistake an earlier
  // revision of this file made twice.
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
    // 100% not 100vw: the card's parent is `fixed inset-0`, so percentages
    // resolve against the visual viewport, while 100vw also includes a classic
    // vertical scrollbar's width and would clip the card + mx-4 on desktop
    // windows narrower than the sm breakpoint (cubic P3).
    expect(cardLine, 'card needs a viewport-relative max width').toMatch(/max-w-\[calc\(100%-/)
    expect(cardLine, '100vw reintroduces scrollbar clipping').not.toContain('100vw')
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
