import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * D2 regression guard — light-mode text clears WCAG AA (4.5:1 small text).
 *
 * ## The defect this guards (kanban t_848dc45d, FIX ledger row D2)
 * OpsForge measured the LIVE light-mode app and found small text at
 * 3.56 / 4.22 / 4.26 / 4.35:1 — all below the 4.5:1 AA floor. The culprit
 * class was alpha-multiplied ink text: `text-foreground/50` on the light
 * --muted surface composites to rgb(133,133,131) = 3.56:1 (matches the live
 * measurement exactly), and the same pattern landed at 4.22-4.35 on canvas
 * and card surfaces. The fix raised those sites to the existing
 * --muted-foreground token (ink @ 0.62 = 5.35-5.57:1 on every light surface)
 * or, on hardcoded-light surfaces where the token would flip in dark mode,
 * to /62 (5.00-5.57:1).
 *
 * ## What this file does
 * 1. MEASURES the composited ratio of every fixed site class against its real
 *    worst-case background (same sRGB math as claim-contrast.test.ts).
 * 2. PATTERN-GUARDS the six fixed files so a `text-foreground/4x|5x` style
 *    sub-AA alpha cannot silently return.
 *
 * ## Documented exemptions (WCAG 1.4.3 / 1.4.11 scoping, NOT oversights)
 * - Pure icons (lucide `<Icon className="text-...">`) are non-text content:
 *   WCAG 1.4.11 requires 3:1, not 4.5:1 — e.g. app-shell Search icon
 *   white/40 = 3.80:1 passes; the ⌘K kbd IS text and was fixed to white/60.
 * - `disabled`/`cursor-not-allowed` states (kanban toggle text-foreground/25)
 *   are inactive components — exempt from 1.4.3.
 * - Decorative empty-state watermark icon (CheckSquare text-foreground/12).
 *
 * If you add small text anywhere in these files, it must clear 4.5:1 on its
 * real background in light mode — measure it here, don't eyeball it.
 */

const ROOT = process.cwd()
const src = (p: string): string => readFileSync(join(ROOT, p), 'utf8')

// ---------- color math (identical to claim-contrast.test.ts) ----------

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
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function composite(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  if (alpha < 0 || alpha > 1) throw new Error(`composite: alpha ${alpha} outside [0, 1]`)
  for (const v of fg) {
    if (!Number.isFinite(v) || v < 0 || v > 255) throw new Error(`composite: channel ${v} outside [0, 255]`)
  }
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ]
}

const AA = 4.5

// ---------- light-theme surfaces (globals.css :root, hex so exact) ----------

const INK = parseRgb('#0b0b0c')            // light --foreground / --ink
const CANVAS = parseRgb('#f6f6f4')         // --background
const CARD = parseRgb('#ffffff')           // --card
const MUTED = parseRgb('#f0f0ee')          // --muted  (worst case: lowest luminance light surface)
const KANBAN_COL = composite(CANVAS, 0.6, CARD) // tasks kanban column bg-background/60 over card
const AUTH_CARD = composite(parseRgb('#fcfcfc'), 0.76, parseRgb('#f4f0e6')) // auth page card over paper gradient
const AUTH_TAB = composite(parseRgb('#0c111b'), 0.05, AUTH_CARD)            // inactive-tab strip rgba(12,17,27,.05) over card
const CLAIM_BG = parseRgb('#0C111B')       // claim page (permanent dark surface, identical in light mode)
const BOOK_FIELD_BG = parseRgb('#18181b')  // booking form fields: bg-zinc-900
const APP_SHELL_HEADER = parseRgb('#0b0b0c') // app-shell ink header (permanent, both themes)

/** Every light surface the app-shell/tasks views can render muted text on. */
const LIGHT_SURFACES: Array<[string, [number, number, number]]> = [
  ['--background #f6f6f4', CANVAS],
  ['--card #ffffff', CARD],
  ['--muted #f0f0ee', MUTED],
  ['kanban column bg-background/60 over card', KANBAN_COL],
]

// ---------- 1. measured ratios for the fixed site classes ----------

describe('D2 guard: fixed light-mode text sites measure >= 4.5:1', () => {
  it('--muted-foreground (ink @ 0.62) clears AA on EVERY light app surface', () => {
    // tasks-view now uses text-muted-foreground for all small text. The token
    // is rgba(11,11,12,0.62); its worst case is the lowest-luminance surface.
    for (const [name, bg] of LIGHT_SURFACES) {
      const ratio = contrast(composite(INK, 0.62, bg), bg)
      expect(ratio, `muted-foreground on ${name}`).toBeGreaterThanOrEqual(AA)
    }
    // Worst-case proof of the original defect: /50 on --muted was 3.56:1.
    expect(contrast(composite(INK, 0.5, MUTED), MUTED)).toBeLessThan(AA)
  })

  it('tasks-view view-toggle icons at text-foreground/60 clear AA as text on card', () => {
    // Toggles sit on bg-card; /60 is the new floor (was /50 = 3.69).
    const ratio = contrast(composite(INK, 0.6, CARD), CARD)
    expect(ratio).toBeGreaterThanOrEqual(AA)
  })

  it('auth page ink text at /62 clears AA on the auth card AND the tab strip', () => {
    // auth/page.tsx is a hardcoded-light surface (paper gradient) — tokens
    // would flip in .dark, so the fix raised the literal alpha to /62.
    for (const [name, bg] of [['auth card', AUTH_CARD], ['inactive tab strip', AUTH_TAB]] as Array<[string, [number, number, number]]>) {
      const ratio = contrast(composite(parseRgb('#0c111b'), 0.62, bg), bg)
      expect(ratio, `#0c111b/62 on ${name}`).toBeGreaterThanOrEqual(AA)
    }
    // The untouched /60 body site must still pass (do-not-reduce rule).
    expect(contrast(composite(parseRgb('#0c111b'), 0.6, AUTH_CARD), AUTH_CARD)).toBeGreaterThanOrEqual(AA)
    // Proof the guard is not vacuous: the old /52 labels really failed.
    expect(contrast(composite(parseRgb('#0c111b'), 0.52, AUTH_CARD), AUTH_CARD)).toBeLessThan(AA)
  })

  it('auth-loading ink text at /62 clears AA on its light section', () => {
    // auth-loading right section renders on the auth card bg (same surface).
    const ratio = contrast(composite(INK, 0.62, AUTH_CARD), AUTH_CARD)
    expect(ratio).toBeGreaterThanOrEqual(AA)
  })

  it('app-shell ⌘K kbd at white/60 clears AA on the ink header', () => {
    // The kbd is TEXT (1.4.3 applies), white/40 was 3.80:1.
    const ratio = contrast(composite(parseRgb('#ffffff'), 0.6, APP_SHELL_HEADER), APP_SHELL_HEADER)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(contrast(composite(parseRgb('#ffffff'), 0.4, APP_SHELL_HEADER), APP_SHELL_HEADER)).toBeLessThan(AA)
  })

  it('claim page body text at rgba(244,240,230,0.5) clears AA on #0C111B', () => {
    // Fixed sites: "Eligible products" header, refund copy, footer — were 0.4/0.45.
    const paper = parseRgb('#f4f0e6')
    const ratio = contrast(composite(paper, 0.5, CLAIM_BG), CLAIM_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(contrast(composite(paper, 0.45, CLAIM_BG), CLAIM_BG)).toBeLessThan(AA)
    expect(contrast(composite(paper, 0.4, CLAIM_BG), CLAIM_BG)).toBeLessThan(AA)
  })

  it('booking placeholders at zinc-400 clear AA on the zinc-900 field', () => {
    const ratio = contrast(parseRgb('#a1a1aa'), BOOK_FIELD_BG)
    expect(ratio).toBeGreaterThanOrEqual(AA)
    expect(contrast(parseRgb('#71717a'), BOOK_FIELD_BG)).toBeLessThan(AA) // old zinc-500
  })
})

// ---------- 2. pattern guards on the six fixed files ----------

describe('D2 guard: sub-AA alpha text patterns cannot return', () => {
  it('tasks-view has no text-foreground alpha below /60', () => {
    const tv = src('src/components/tasks/tasks-view.tsx')
    const alphas = [...tv.matchAll(/text-foreground\/(\d+)/g)].map((m) => +m[1])
    // Remaining lows are documented exemptions only: /25 disabled toggle,
    // /12 decorative watermark icon. Everything else must be >= 60.
    for (const a of alphas) {
      expect(a === 25 || a === 12 || a >= 60, `text-foreground/${a} is sub-AA small text`).toBe(true)
    }
    // The done-card `opacity-60` wrapper multiplied EVERY inner text color by
    // 0.6 (title fell to ~2.0:1); it was removed — assert it stays removed.
    expect(tv, 'done TaskCard must not dim text via card-level opacity').not.toMatch(/isDone \? 'opacity-60'/)
  })

  it('auth page has no #0c111b text alpha below /60', () => {
    const auth = src('src/app/auth/page.tsx')
    const alphas = [...auth.matchAll(/text-\[#0c111b\]\/(\d+)/g)].map((m) => +m[1])
    expect(alphas.length).toBeGreaterThan(0)
    for (const a of alphas) {
      expect(a >= 60, `text-[#0c111b]/${a} is sub-AA on the auth card`).toBe(true)
    }
  })

  it('auth-loading has no --ink text alpha below /60', () => {
    const al = src('src/components/auth/auth-loading.tsx')
    const alphas = [...al.matchAll(/text-\[var\(--ink\)\]\/(\d+)/g)].map((m) => +m[1])
    expect(alphas.length).toBeGreaterThan(0)
    for (const a of alphas) {
      expect(a >= 60, `text-[var(--ink)]/${a} is sub-AA on the light section`).toBe(true)
    }
  })

  it('app-shell kbd shortcut text is white/60 or stronger', () => {
    const shell = src('src/components/app/app-shell.tsx')
    const kbd = shell.match(/<kbd[^>]*text-white\/(\d+)[^>]*>/)
    expect(kbd, 'the ⌘K kbd must exist and use text-white/NN').not.toBeNull()
    expect(+kbd![1]).toBeGreaterThanOrEqual(60)
  })

  it('claim page has no inline body-text alpha below 0.5', () => {
    const claim = src('src/app/claim/page.tsx')
    // All color: 'rgba(244,240,230,X)' inline styles; the S31 placeholders
    // (0.62) and the verified-state copy (0.66) already passed.
    const alphas = [...claim.matchAll(/color:\s*'rgba\(244,\s*240,\s*230,\s*([\d.]+)\)'/g)].map((m) => parseFloat(m[1]))
    expect(alphas.length).toBeGreaterThan(0)
    for (const a of alphas) {
      expect(a >= 0.5, `claim rgba(244,240,230,${a}) is sub-AA on #0C111B`).toBe(true)
      expect(contrast(composite(parseRgb('#f4f0e6'), a, CLAIM_BG), CLAIM_BG)).toBeGreaterThanOrEqual(AA)
    }
  })

  it('booking form placeholders are zinc-400, not zinc-500', () => {
    const booking = src('src/app/book/[slug]/booking-page.tsx')
    expect(booking, 'no sub-AA zinc-500 placeholders').not.toMatch(/placeholder:text-zinc-500/)
    expect([...booking.matchAll(/placeholder:text-zinc-400/g)].length).toBeGreaterThanOrEqual(6)
  })
})

// ---------- 3. dark-mode non-regression ----------

describe('D2 guard: dark mode was not reduced by the light-mode fix', () => {
  const DF = parseRgb('#f2f2f3') // dark --foreground
  const DARK_SURFACES: Array<[string, [number, number, number]]> = [
    ['--background #08080a', parseRgb('#08080a')],
    ['--card #141416', parseRgb('#141416')],
    ['--muted #17171a', parseRgb('#17171a')],
  ]

  it('dark --muted-foreground (f2f2f3 @ 0.60) still clears AA everywhere', () => {
    // The tasks-view fix moved text ONTO this token; in dark it renders
    // 6.37-6.61:1 (vs the old foreground/50 at 4.79-4.87) — strictly better.
    for (const [name, bg] of DARK_SURFACES) {
      expect(contrast(composite(DF, 0.6, bg), bg), `dark muted on ${name}`).toBeGreaterThanOrEqual(AA)
    }
  })
})
