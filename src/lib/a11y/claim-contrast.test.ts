import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * S31 regression guard — the /claim placeholder contrast fix.
 *
 * ## Owned by PR #223 (merged, live). This file only GUARDS it.
 * #223 fixed the invisible placeholder two ways:
 *   1. claim/page.tsx — `placeholder:text-[rgba(244,240,230,0.62)]` on both inputs
 *   2. globals.css    — light-theme `--muted-foreground` 0.55 -> 0.62
 *
 * I am deliberately NOT shipping a competing `.input-dark` class. Duplicating a
 * merged fix on a conflicting branch is how two agents overwrite each other.
 * What main lacks is a *guard*: nothing fails if someone edits either colour and
 * drops the placeholder below WCAG AA again.
 *
 * ## The bug, reproduced by measurement
 * The claim fields sit on #0C111B and set their colour with an inline
 * `style={{ color: PAPER }}`. Inline `color` CANNOT reach the `::placeholder`
 * pseudo-element, so the placeholder fell back to the light theme's
 * `--muted-foreground: rgba(11,11,12,0.55)`, which composites to rgb(11,14,19)
 * on #0C111B = **1.02:1**. That reproduces the reported number exactly.
 */

const ROOT = process.cwd()

/**
 * Parse a 3- or 6-digit hex colour.
 *
 * 4-digit (#RGBA) and 8-digit (#RRGGBBAA) forms are REJECTED rather than
 * mis-parsed. An earlier version silently dropped the alpha and shifted the
 * digit groups, producing a wrong contrast number instead of a failure — a
 * wrong ratio is worse than an exception, because it looks like evidence.
 */
function parseRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  if (s.length !== 3 && s.length !== 6) {
    throw new Error(`parseRgb: expected 3 or 6 hex digits, got ${s.length} in "${h}"`)
  }
  if (!/^[0-9a-fA-F]+$/.test(s)) {
    throw new Error(`parseRgb: "${h}" is not hex`)
  }
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
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

function composite(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  // Validate rather than clamp. CSS clamps alpha to [0,1] and channels to
  // [0,255] at render time — so an out-of-range source value would silently
  // render DIFFERENTLY from what this function computed, and a guard could pass
  // a colour that actually fails AA (or vice versa). A broken value must fail
  // the suite, not be quietly repaired here.
  if (![0, 1].every((bound) => alpha >= Math.min(bound, 0) && alpha <= Math.max(bound, 1))) {
    throw new Error(`composite: alpha ${alpha} outside [0, 1]`)
  }
  for (const v of fg) {
    if (!Number.isFinite(v) || v < 0 || v > 255) {
      throw new Error(`composite: channel ${v} outside [0, 255]`)
    }
  }
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ]
}

const CLAIM_BG = parseRgb('#0C111B')

describe('S31 guard: /claim placeholder clears WCAG AA', () => {
  const claim = readFileSync(join(ROOT, 'src/app/claim/page.tsx'), 'utf8')

  it('both claim inputs declare an explicit placeholder colour', () => {
    // Without this, the field inherits the light theme's dark grey on a dark
    // background — the original 1.02:1 bug.
    const inputs = claim.match(/<Input[\s\S]*?\/>/g) ?? []
    const withPlaceholder = inputs.filter((b) => b.includes('placeholder='))
    expect(withPlaceholder.length, 'claim has two fields').toBeGreaterThanOrEqual(2)
    for (const b of withPlaceholder) {
      expect(b, 'every claim input must set an explicit placeholder colour').toMatch(/placeholder:text-\[rgba\(/)
    }
  })

  /**
   * EVERY placeholder colour in the file, not just the first.
   *
   * `.match()` without /g returns only the first hit, so the contrast and
   * subordination assertions were only ever evaluated for the EMAIL input. A
   * future edit lowering the license-key input's alpha — still in rgba() form,
   * so the "declares an explicit colour" test would pass — would slip straight
   * through. Review finding.
   */
  const placeholderColours = (): Array<[number, number, number, number]> =>
    [...claim.matchAll(/placeholder:text-\[rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)\]/g)].map((m) => {
      const a = parseFloat(m[4])
      if (!Number.isFinite(a) || a < 0 || a > 1) {
        throw new Error(`claim placeholder alpha ${m[4]} outside [0, 1]`)
      }
      return [+m[1], +m[2], +m[3], a] as [number, number, number, number]
    })

  it('EVERY claim placeholder colour is >= 4.5:1 on the field background', () => {
    const colours = placeholderColours()
    expect(colours.length, 'claim has two fields, both with placeholders').toBeGreaterThanOrEqual(2)
    for (const [r, g, b, a] of colours) {
      const composited = composite([r, g, b], a, CLAIM_BG)
      const ratio = contrast(composited, CLAIM_BG)
      expect(
        ratio,
        `rgba(${r},${g},${b},${a}) composites to rgb(${composited.join(',')}) on #0C111B`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('EVERY claim placeholder stays subordinate to the typed input text', () => {
    const colours = placeholderColours()
    const textRatio = contrast(parseRgb('#F4F0E6'), CLAIM_BG) // claim page PAPER
    expect(textRatio, 'typed text must itself clear AA').toBeGreaterThanOrEqual(4.5)
    for (const [r, g, b, a] of colours) {
      const phRatio = contrast(composite([r, g, b], a, CLAIM_BG), CLAIM_BG)
      expect(phRatio, 'placeholder must remain dimmer than real input').toBeLessThan(textRatio)
    }
  })

  it('documents the bug it guards: the old light-theme muted grey was ~1:1 here', () => {
    // Proves the guard is not vacuous — the pre-fix value really was invisible.
    const before = composite([11, 11, 12], 0.55, CLAIM_BG)
    expect(contrast(before, CLAIM_BG)).toBeLessThan(1.2)
  })
})

describe('S31/S21 guard: light-theme --muted-foreground clears AA on the app surface', () => {
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')

  /**
   * The body of a specific top-level CSS block (`:root` or `.dark`).
   *
   * Locating the light token by "first --muted-foreground in the file" worked
   * only because `:root` happens to precede `.dark`. Reordering the file, or
   * adding an earlier declaration, would have made this test silently composite
   * the DARK token rgba(242,242,243,0.60) over the LIGHT background #f6f6f4 —
   * about 1.07:1 — and fail spuriously (or, worse, pass against a token nobody
   * edits). Scope the lookup to the block instead. Review finding.
   */
  const blockBody = (selector: string): string => {
    // A plain indexOf(selector) is NOT enough and produced a real bug here:
    // `.dark` first occurs on line 4 inside `@custom-variant dark (&:is(.dark *))`
    // and again inside a comment on line 54, so brace-matching from the first hit
    // landed on the `@theme inline` block instead of `.dark {` — the same
    // naive-substring failure this whole PR is about, in the guard meant to
    // prevent it. Require the selector to actually start a rule.
    const stripped = css
      .replace(/\/\*[\s\S]*?\*\//g, '')   // comments (line 54 mentions `.dark`)
      .replace(/^\s*\/\/.*$/gm, '')
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // selector, then only whitespace, then '{'; and not preceded by an
    // identifier char (so `.dark-mode` cannot satisfy `.dark`)
    const rule = new RegExp(`(^|[};])\\s*${escaped}\\s*\\{`, 'm')
    const m = stripped.match(rule)
    expect(m, `${selector} must open a rule block in globals.css`).not.toBeNull()
    const open = m!.index! + m![0].length - 1
    // match braces to find this block's own close, ignoring nested rules
    let depth = 0
    for (let i = open; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++
      else if (stripped[i] === '}') {
        depth--
        if (depth === 0) return stripped.slice(open + 1, i)
      }
    }
    throw new Error(`${selector} block is never closed`)
  }

  const tokenIn = (body: string, name: string): string => {
    const m = body.match(new RegExp(`--${name}:\\s*([^;]+);`))
    expect(m, `--${name} must be declared in this block`).not.toBeNull()
    return m![1].trim()
  }

  it('light theme muted text is >= 4.5:1 on the light --background', () => {
    // #223 raised this 0.55 -> 0.62. On #f6f6f4 that is 5.57:1; at 0.55 it was
    // 4.35:1 and FAILED. This is the guard that keeps S21 from silently
    // regressing — and the reason the bump must not be reverted casually.
    const light = blockBody(':root')
    const bgHex = tokenIn(light, 'background')
    expect(bgHex, '--background must be hex (no alpha form) so parseRgb is exact')
      .toMatch(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    const bg = parseRgb(bgHex)

    const muted = tokenIn(light, 'muted-foreground')
    const m = muted.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/)
    expect(m, `light --muted-foreground must be rgba(), got: ${muted}`).not.toBeNull()
    const [, r, g, b, a] = m as RegExpMatchArray
    const composited = composite([+r, +g, +b], parseFloat(a), bg)
    const ratio = contrast(composited, bg)
    expect(
      ratio,
      `light muted rgb(${r},${g},${b}@${a}) composites to rgb(${composited.join(',')}) on ${bgHex}`,
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('the dark-theme tokens are read from .dark, and prove the scoping works', () => {
    // Without this, blockBody() could return the same body for both selectors and
    // the light assertion above would be meaningless.
    const dark = blockBody('.dark')
    const light = blockBody(':root')
    expect(dark).not.toBe(light)

    const darkBg = parseRgb(tokenIn(dark, 'background'))
    const lightBg = parseRgb(tokenIn(light, 'background'))
    expect(darkBg).not.toEqual(lightBg)

    // the dark theme's own muted text must clear AA on the dark surface too
    const m = tokenIn(dark, 'muted-foreground').match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/)
    expect(m, 'dark --muted-foreground must be rgba()').not.toBeNull()
    const composited = composite([+m![1], +m![2], +m![3]], parseFloat(m![4]), darkBg)
    expect(
      contrast(composited, darkBg),
      `dark muted text on rgb(${darkBg.join(',')})`,
    ).toBeGreaterThanOrEqual(4.5)
  })
})
