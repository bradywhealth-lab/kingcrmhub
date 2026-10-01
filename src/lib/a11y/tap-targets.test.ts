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
 * ## What this pins
 * - `/welcome`: 12 nav/footer links at exactly 20px (5 header, 7 footer)
 * - `/auth`: "Forgot password?" and both "Back" controls at 20px
 *
 * ## Two review rounds hardened this guard (both findings real)
 * - P2: it only asserted the FIRST match, so the reset-mode "Back" button passed
 *   anyway → every tag is now enumerated.
 * - P3: `isExempt` matched raw substrings, so `h-5` (20px), `max-h-8` and
 *   `h-full` were blessed as "tall enough" → exemption is now token-aware and
 *   only accepts padding or an explicit height >= 24px (`h-6`).
 *
 * ## Honest limitation
 * Source assertions only — no jsdom here. They prove the markup carries the floor;
 * a browser `getBoundingClientRect` pass on the deployed build is the real proof.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/** Every `<name …>` tag, scanned brace/quote-aware (arrow fns contain `>`). */
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

const spacing = (token: string, prefix: string): number | null => {
  const m = token.match(new RegExp(`^${prefix}-(\\d+(?:\\.\\d+)?)$`))
  return m ? Number(m[1]) : null
}

/**
 * A control is exempt only when its own box is guaranteed >= 24px.
 * Tailwind unit = 4px, so padding `py-2` (8px each side) already clears it, and an
 * explicit `h-6` (24px) or taller does. `max-h-*` sets no floor and `h-full`
 * depends on the parent, so neither counts.
 */
export const isExempt = (tag: string): boolean => {
  const tokens = tag
    .replace(/className=/g, ' ')
    .replace(/[{}'"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const padded = tokens.some((t) => {
    const py = spacing(t, 'py')
    const p = spacing(t, 'p')
    return (py !== null && py >= 2) || (p !== null && p >= 2)
  })
  const tall = tokens.some((t) => {
    const h = spacing(t, 'h')
    return h !== null && h >= 6
  })

  return padded || tall
}

describe('tap targets (S20)', () => {
  it('exempts only controls that are genuinely >= 24px (guard is not vacuous)', () => {
    expect(isExempt('<a className="px-6 py-3.5">')).toBe(true)
    expect(isExempt('<button className="h-6">')).toBe(true)
    expect(isExempt('<button className="h-11 w-full">')).toBe(true)
    // The traps cubic flagged — none of these guarantee 24px.
    expect(isExempt('<a className="h-5">')).toBe(false)
    expect(isExempt('<a className="max-h-8">')).toBe(false)
    expect(isExempt('<a className="h-full">')).toBe(false)
    expect(isExempt('<a className="h-4 w-4">')).toBe(false)
  })

  it('every /welcome Link and anchor is either padded or floored at 24px', () => {
    const src = read('src/app/welcome/page.tsx')
    const inline = [...scanTags(src, 'Link'), ...scanTags(src, 'a')].filter((t) => !isExempt(t))

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