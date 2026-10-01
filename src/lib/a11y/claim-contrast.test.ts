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

function parseRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
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

  it('that placeholder colour is >= 4.5:1 on the claim field background', () => {
    const m = claim.match(/placeholder:text-\[rgba\((\d+),(\d+),(\d+),([\d.]+)\)\]/)
    expect(m, 'placeholder colour must be an rgba() so we can composite it').not.toBeNull()
    const [, r, g, b, a] = m as RegExpMatchArray
    const composited = composite([+r, +g, +b], parseFloat(a), CLAIM_BG)
    const ratio = contrast(composited, CLAIM_BG)
    expect(ratio, `placeholder composites to rgb(${composited.join(',')}) on #0C111B`).toBeGreaterThanOrEqual(4.5)
  })

  it('stays subordinate to the typed input text', () => {
    const m = claim.match(/placeholder:text-\[rgba\((\d+),(\d+),(\d+),([\d.]+)\)\]/) as RegExpMatchArray
    const phRatio = contrast(composite([+m[1], +m[2], +m[3]], parseFloat(m[4]), CLAIM_BG), CLAIM_BG)
    const textRatio = contrast(parseRgb('#F4F0E6'), CLAIM_BG) // claim page PAPER
    expect(textRatio).toBeGreaterThanOrEqual(4.5)
    expect(phRatio, 'placeholder must remain dimmer than real input').toBeLessThan(textRatio)
  })

  it('documents the bug it guards: the old light-theme muted grey was ~1:1 here', () => {
    // Proves the guard is not vacuous — the pre-fix value really was invisible.
    const before = composite([11, 11, 12], 0.55, CLAIM_BG)
    expect(contrast(before, CLAIM_BG)).toBeLessThan(1.2)
  })
})

describe('S31/S21 guard: light-theme --muted-foreground clears AA on the app surface', () => {
  const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')

  it('light theme muted text is >= 4.5:1 on --background', () => {
    // #223 raised this 0.55 -> 0.62. On #f6f6f4 that is 5.57:1; at 0.55 it was
    // 4.35:1 and FAILED. This is the guard that keeps S21 from silently
    // regressing — and the reason the bump must not be reverted casually.
    const token = css.match(/--background:\s*(#[0-9a-fA-F]{3,8})\s*;/)
    expect(token, '--background must be a hex colour').not.toBeNull()
    const bg = parseRgb(token![1])

    // the FIRST --muted-foreground in the file is the light theme one
    const idx = css.indexOf('--muted-foreground:')
    expect(idx).toBeGreaterThan(-1)
    const decl = css.slice(idx, css.indexOf(';', idx))
    const m = decl.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
    expect(m, `light --muted-foreground must be rgba(), got: ${decl.slice(0, 60)}`).not.toBeNull()
    const [, r, g, b, a] = m as RegExpMatchArray
    const composited = composite([+r, +g, +b], parseFloat(a), bg)
    const ratio = contrast(composited, bg)
    expect(ratio, `light muted text composites to rgb(${composited.join(',')}) on ${token![1]}`).toBeGreaterThanOrEqual(4.5)
  })
})
