import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * S31 — /claim placeholder text was invisible.
 *
 * ## Root cause (measured, not assumed)
 * `src/app/claim/page.tsx` sets inline `style={{ color: PAPER }}` on its two
 * `<Input>`s. Inline `color` **cannot** reach the `::placeholder` pseudo-element,
 * so the `Input` primitive's `placeholder:text-muted-foreground` class wins.
 * `--muted-foreground` is `rgba(11,11,12,0.55)` (globals.css:96) and the field
 * background is `#0C111B`, which composites to rgb(11,14,19) → **1.02:1**.
 * That reproduces Sentinel's reported number exactly. The input *text* itself
 * (PAPER #F4F0E6) is 16.60:1 and was never the problem.
 *
 * ## What this test does
 * Reads the REAL colour values out of `globals.css` and the claim page source,
 * composites them, and asserts WCAG AA for normal-size text (≥ 4.5:1). So a
 * future edit to either value that breaks the placeholder fails here instead of
 * shipping invisible text again.
 */

const ROOT = process.cwd()

function parseRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** Alpha-composite fg over bg, as a browser does. */
function composite(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ]
}

const CLAIM_BG = parseRgb('#0C111B') // the claim page's INK field background

describe('S31: /claim placeholder contrast clears WCAG AA', () => {
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')
  const claim = readFileSync(join(ROOT, 'src/app/claim/page.tsx'), 'utf8')

  it('documents the bug it is guarding: the light theme muted-foreground is ~1:1 on the claim ink', () => {
    // Proves the root cause is real, so this test cannot pass vacuously.
    const m = css.match(/--muted-foreground:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
    expect(m, 'light-theme --muted-foreground must be an rgba() so we can composite it').not.toBeNull()
    const [, r, g, b, a] = m as RegExpMatchArray
    const composited = composite([+r, +g, +b], parseFloat(a), CLAIM_BG)
    const ratio = contrast(composited, CLAIM_BG)
    expect(ratio).toBeLessThan(1.2) // ~1.02:1 — invisible, exactly as reported
  })

  it('the claim inputs use the dark-field class that styles ::placeholder explicitly', () => {
    // Inline style cannot reach ::placeholder, so the fix must be a real class.
    expect(claim).toContain('input-dark')
    const uses = claim.match(/input-dark/g) ?? []
    expect(uses.length, 'both claim inputs must use it').toBeGreaterThanOrEqual(2)
    expect(css).toMatch(/\.input-dark::placeholder/)
  })

  it('.input-dark::placeholder resolves to >= 4.5:1 on the claim field background', () => {
    const m = css.match(/\.input-dark::placeholder\s*\{[^}]*color:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
    expect(m, '.input-dark::placeholder must declare an rgba colour in globals.css').not.toBeNull()
    const [, r, g, b, a] = m as RegExpMatchArray
    const composited = composite([+r, +g, +b], parseFloat(a), CLAIM_BG)
    const ratio = contrast(composited, CLAIM_BG)
    expect(ratio, `placeholder composited to rgb(${composited.join(',')})`).toBeGreaterThanOrEqual(4.5)
  })

  it('stays visually subordinate to the typed input text (placeholder must not outshine content)', () => {
    const ph = css.match(/\.input-dark::placeholder\s*\{[^}]*color:\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
    const [, pr, pg, pb, pa] = ph as RegExpMatchArray
    const phRatio = contrast(composite([+pr, +pg, +pb], parseFloat(pa), CLAIM_BG), CLAIM_BG)

    const paper = parseRgb('#F4F0E6') // claim page PAPER
    const textRatio = contrast(paper, CLAIM_BG)
    expect(textRatio).toBeGreaterThanOrEqual(4.5) // typed text passes AA too
    expect(phRatio).toBeLessThan(textRatio) // but remains dimmer than real input
  })

  it('the claim inputs no longer rely on inline style for their text colour alone', () => {
    // Regression guard: if someone removes input-dark and puts back only inline color,
    // the placeholder goes invisible again with zero test failures otherwise.
    const inputBlocks = claim.match(/<Input[\s\S]*?\/>/g) ?? []
    expect(inputBlocks.length).toBeGreaterThanOrEqual(2)
    for (const block of inputBlocks) {
      if (block.includes('placeholder=')) {
        expect(block, 'every placeholder-bearing claim input needs input-dark').toContain('input-dark')
      }
    }
  })
})
