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
 * Pinned to their EXACT occurrences in the pattern-guard section (disabled
 * completed-tab kanban toggle /25, decorative CheckSquare watermark /12) —
 * a bare alpha-value allow-list is not accepted (PR #233 review).
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

// ---------- theme tokens PARSED from globals.css (never duplicated) ----------

/**
 * Extract a theme block (`:root` / `.dark`) from globals.css by brace matching,
 * then read custom properties out of it at test time. The guard deliberately
 * does NOT duplicate theme constants (PR #233 review: "Read contrast colors
 * from the production theme") — a theme change now re-measures instead of
 * silently keeping the guard green while Tasks regresses below AA.
 */
function themeBlock(css: string, selector: ':root' | '.dark'): string {
  const re = selector === ':root' ? /(^|\n):root\s*\{/ : /(^|\n)\.dark\s*\{/
  const start = css.search(re)
  if (start === -1) throw new Error(`themeBlock: ${selector} block not found in globals.css`)
  const open = css.indexOf('{', start)
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  throw new Error(`themeBlock: ${selector} block is unterminated`)
}

function themeVar(block: string, name: string): string {
  const m = block.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))
  if (!m) throw new Error(`themeVar: --${name} not found in theme block`)
  return m[1].trim()
}

function rgbaThemeVar(block: string, name: string): [number, number, number, number] {
  const value = themeVar(block, name)
  const m = value.match(/^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/)
  if (!m) {
    throw new Error(
      `rgbaThemeVar: --${name} is not an rgba() literal (got "${value}") — the guard cannot measure it; update the parse`,
    )
  }
  return [+m[1], +m[2], +m[3], +m[4]]
}

const globalsCss = src('src/app/globals.css')
const LIGHT_THEME = themeBlock(globalsCss, ':root')
const DARK_THEME = themeBlock(globalsCss, '.dark')
const rgbOf = (c: [number, number, number, number]): [number, number, number] => [c[0], c[1], c[2]]

const INK = parseRgb(themeVar(LIGHT_THEME, 'foreground'))       // light --foreground (parsed)
const MUTED_FG = rgbaThemeVar(LIGHT_THEME, 'muted-foreground')  // light --muted-foreground (parsed)
const CANVAS = parseRgb(themeVar(LIGHT_THEME, 'background'))    // --background
const CARD = parseRgb(themeVar(LIGHT_THEME, 'card'))            // --card
const MUTED = parseRgb(themeVar(LIGHT_THEME, 'muted'))          // --muted  (worst case: lowest luminance light surface)
const DARK_MUTED_FG = rgbaThemeVar(DARK_THEME, 'muted-foreground') // dark --muted-foreground (parsed)
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
  it('--muted-foreground (parsed from globals.css) clears AA on EVERY light app surface', () => {
    // tasks-view now uses text-muted-foreground for all small text. The token
    // is PARSED from the globals.css :root block — if the theme changes, this
    // test re-measures the new values instead of staying green on duplicated
    // constants (PR #233 review: "Read contrast colors from the production
    // theme").
    for (const [name, bg] of LIGHT_SURFACES) {
      const ratio = contrast(composite(rgbOf(MUTED_FG), MUTED_FG[3], bg), bg)
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
  it('tasks-view sub-60 text-foreground alphas are exactly the two pinned exemptions', () => {
    const tv = src('src/components/tasks/tasks-view.tsx')

    // The ONLY allowed sub-60 occurrences, pinned in their exact contexts
    // (WCAG 1.4.3 disabled-state + 1.4.11 decorative non-text scoping — the
    // bare alpha allow-list let ANY future text at /25 or /12 pass; PR #233
    // review, cubic + codex):
    // Index-based extraction: a `<button[^>]*>` regex would stop at the `>`
    // inside the onClick arrow, so walk to the enclosing button explicitly.
    const labelIdx = tv.indexOf('aria-label="Kanban board view"')
    expect(labelIdx, 'the kanban board view toggle must exist').toBeGreaterThan(-1)
    const btnStart = tv.lastIndexOf('<button', labelIdx)
    const btnEnd = tv.indexOf('</button>', labelIdx)
    expect(btnStart, 'an enclosing <button> must precede the toggle label').toBeGreaterThan(-1)
    expect(btnEnd, 'a closing </button> must follow the toggle label').toBeGreaterThan(-1)
    const disabledToggle = tv.slice(btnStart, btnEnd + '</button>'.length)
    expect(
      disabledToggle,
      '/25 must sit on the disabled completed-tab toggle, not on active UI',
    ).toMatch(/disabled=\{tab === 'completed'\}[\s\S]*cursor-not-allowed text-foreground\/25/)
    const watermark = tv.match(/<CheckSquare className="h-12 w-12 text-foreground\/12" \/>/)
    expect(watermark, 'the decorative empty-state watermark icon must keep its exact /12 class').not.toBeNull()

    // Every OTHER alpha below /60 now FAILS: a future label or paragraph at
    // /25 or /12 (or any new sub-AA alpha) is rejected outright.
    const alphas = [...tv.matchAll(/text-foreground\/(\d+)/g)].map((m) => +m[1])
    expect(alphas.length).toBeGreaterThan(0)
    const lows = alphas.filter((a) => a < 60).sort((a, b) => a - b)
    expect(lows, 'sub-60 text-foreground alphas must be exactly the pinned /12 + /25 exemptions').toEqual([12, 25])
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
  const DARK_SURFACES: Array<[string, [number, number, number]]> = [
    ['--background (parsed)', parseRgb(themeVar(DARK_THEME, 'background'))],
    ['--card (parsed)', parseRgb(themeVar(DARK_THEME, 'card'))],
    ['--muted (parsed)', parseRgb(themeVar(DARK_THEME, 'muted'))],
  ]

  it('dark --muted-foreground (parsed from globals.css) still clears AA everywhere', () => {
    // The tasks-view fix moved text ONTO this token; in dark it renders
    // 6.37-6.61:1 (vs the old foreground/50 at 4.79-4.87) — strictly better.
    // Token values are PARSED from the .dark block, not duplicated here.
    for (const [name, bg] of DARK_SURFACES) {
      const ratio = contrast(composite(rgbOf(DARK_MUTED_FG), DARK_MUTED_FG[3], bg), bg)
      expect(ratio, `dark muted on ${name}`).toBeGreaterThanOrEqual(AA)
    }
  })
})
