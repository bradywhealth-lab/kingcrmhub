import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S20 follow-up — inline text links must clear WCAG 2.2 SC 2.5.8 (24x24 CSS px).
 *
 * ## What #223/#225 already fixed (merged, live — NOT re-done here)
 * #223 raised the /claim, /terms and /privacy links to `min-h-[24px]`; Atlas and
 * OpsForge both re-measured them at 24.0px on the deployed build.
 *
 * ## What this pins (Atlas measured live on `afe3b4f`, then cubic caught 2 more)
 * - `/welcome`: 12 nav/footer links at exactly 20px (5 header, 7 footer)
 * - `/auth`: "Forgot password?" **and both "Back" controls** at 20px
 *
 * ## Why the scanner, not a single match
 * An earlier version of this test only asserted the FIRST `switchMode('forgot')`
 * match, so the reset-mode "Back" button slipped through and the test passed
 * anyway (cubic P2, confidence 9). Every tag is now enumerated.
 *
 * Rule: a control with no vertical padding of its own (no `py-N`, no `h-N`) is an
 * inline tap target and must declare the 24px floor. Padded CTAs are already >24px
 * and are exempt. Tags are scanned brace/quote-aware because `onClick={() => …}`
 * contains a `>` that naive regexes truncate on.
 *
 * ## Honest limitation
 * Source assertions only — no jsdom here. They prove the markup carries the floor;
 * a browser `getBoundingClientRect` pass on the deployed build is the real proof.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/** Every `<name …>` tag with brace/quote-aware scanning (arrow fns contain `>`). */
function scanTags(src: string, name: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(new RegExp(`<${name}\\b`, 'g'))) {
    let i = m.index
    let depth = 0
    let quote: string | null = null
    while (i < src.length) {
      const c = src[i]
      if (quote) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '{') {
        depth++
      } else if (c === '}') {
        depth--
      } else if (c === '>' && depth === 0) {
        out.push(src.slice(m.index, i + 1))
        break
      }
      i++
    }
  }
  return out
}

/** A control is exempt when its own box already exceeds 24px via padding/height. */
const isExempt = (tag: string) => /py-\d/.test(tag) || /h-\d|h-full/.test(tag)

describe('tap targets (S20)', () => {
  it('every /welcome Link and anchor is either padded or floored at 24px', () => {
    const inline = [...scanTags(read('src/app/welcome/page.tsx'), 'Link'), ...scanTags(read('src/app/welcome/page.tsx'), 'a')].filter(
      (t) => !isExempt(t),
    )

    expect(inline.length).toBeGreaterThanOrEqual(12) // 5 header + 7 footer
    for (const tag of inline) expect(tag).toContain('min-h-[24px]')
  })

  it('every unpadded /auth button is floored at 24px', () => {
    const inline = scanTags(read('src/app/auth/page.tsx'), 'button').filter((t) => !isExempt(t))

    // "Forgot password?" + "Back to sign in" + "Back"
    expect(inline.length).toBeGreaterThanOrEqual(3)
    for (const tag of inline) expect(tag).toContain('min-h-[24px]')
  })
})