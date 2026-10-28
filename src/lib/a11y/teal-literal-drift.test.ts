import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Brady requirement (2026-10-27): "Should be blue and white not teal."
//
// History: the brand tokens (--teal, --teal-deep, ...) were repointed to the
// cobalt family, but Tailwind ARBITRARY VALUES carried the old teal as
// hardcoded literals — rgba(24,184,151,X) gradient overlays/glows and
// rgba(18,124,102,X) shadows — which a token swap can never reach. Those
// literals shipped teal to /auth, /pricing and the onboarding wizard while
// the landing page was clean (t_7457d034). This guard is the tripwire so a
// teal literal can never re-enter src/ silently: the compiled CSS would
// regress with no failing test, exactly like the nav-labels drift class.
//
// This scans SOURCE, not built CSS: chunk names change per build, but
// anything present in src/ ships. A source scan makes the regression die in
// CI, pre-deploy.

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const srcRoot = join(repoRoot, 'src')
const guardRelativePath = join('src', 'lib', 'a11y', 'teal-literal-drift.test.ts')

// Teal-family literals banned anywhere under src/. The comma form is the
// regression class that actually shipped; the space/underscore form is the
// same colors in modern rgb() syntax (Tailwind renders `_` as a space in
// arbitrary values); the hexes are the compact spellings of the same colors.
// The guard itself names these literals, so the guard file is skipped below.
const tealFamilyPatterns: Array<[string, RegExp]> = [
  ['rgba(24,184,151,…) — teal', /rgba?\(\s*24\s*,\s*184\s*,\s*151/i],
  ['rgb(24 184 151) — teal, space/underscore syntax', /rgba?\(\s*24[\s_]+184[\s_]+151/i],
  ['rgba(18,124,102,…) — teal-deep', /rgba?\(\s*18\s*,\s*124\s*,\s*102/i],
  ['rgb(18 124 102) — teal-deep, space/underscore syntax', /rgba?\(\s*18[\s_]+124[\s_]+102/i],
  ['#18b897 — teal hex', /#18b897/i],
  ['#126c66 — teal-deep hex', /#126c66/i],
]

function listSourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...listSourceFiles(path))
    else files.push(path)
  }
  return files
}

interface TealHit {
  file: string
  line: number
  literal: string
}

function scanSourceForTeal(): TealHit[] {
  const hits: TealHit[] = []
  for (const file of listSourceFiles(srcRoot)) {
    if (relative(repoRoot, file) === guardRelativePath) continue
    let content: string
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue // unreadable entry (binary etc.) — nothing to scan
    }
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      for (const [literal, pattern] of tealFamilyPatterns) {
        if (pattern.test(lines[index] ?? '')) {
          hits.push({ file: relative(repoRoot, file), line: index + 1, literal })
        }
      }
    }
  }
  return hits
}

describe('teal literal drift guard (Brady: "blue and white, not teal")', () => {
  it('contains no teal-family color literal anywhere under src/', () => {
    const hits = scanSourceForTeal()
    const rendered = hits.map(hit => `${hit.file}:${hit.line} ${hit.literal}`).join('\n')
    expect(
      hits,
      `teal-family literals found in source — replace with the cobalt family at identical alpha (rgba(47,107,255,…) / rgba(30,79,204,…), matching --teal/--teal-deep):\n${rendered}`,
    ).toEqual([])
  })
})
