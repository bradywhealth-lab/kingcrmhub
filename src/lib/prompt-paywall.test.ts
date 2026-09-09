import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Paywall-integrity law (Cubic P1 + Codex P1 on PR #161):
 *
 * Paid prompt bodies must be impossible to recover from the client bundle.
 * The ONLY file that may import the full PROMPT_LIBRARY is server code
 * (route handlers, server libs, tests). A client component ('use client')
 * importing prompts.ts ships every paid body to every free user.
 *
 * This gate is a static import-graph scan, so it fails on a re-introduced
 * leak at review time — it does not depend on build output.
 */

const repoRoot = join(import.meta.dirname, '..', '..')
const SRC = join(repoRoot, 'src')

/** Files allowed to touch the full library: server routes, the lib itself, tests. */
function isServerAllowed(relPath: string): boolean {
  return (
    relPath === 'src/lib/prompts.ts' ||
    relPath.endsWith('.test.ts') || // vitest runs in node env — never bundled for clients
    relPath.startsWith('src/app/api/') // Next.js route handlers are server-only
  )
}

/**
 * True when the file has a VALUE (runtime) import of @/lib/prompts.
 * For each '@/lib/prompts' string specifier, the statement head is everything
 * from the LAST `import` keyword before it to the specifier — an `import`
 * appearing earlier belongs to a different statement only if another `from`
 * intervened, which cannot happen between the last `import` and this
 * specifier. Only `import type …` heads are compile-time-erased; anything
 * else (named default, multi-line, side-effect) fails closed as a value
 * import (cubic P1 round 3: line-anchored regexes silently pass multi-line
 * value imports, re-enabling the exact leak the gate exists to catch).
 */
export function hasValuePromptsImport(text: string): boolean {
  const specifier = /['"]@\/lib\/prompts['"]/g
  let match: RegExpExecArray | null
  while ((match = specifier.exec(text)) !== null) {
    const before = text.slice(0, match.index)
    const idx = before.lastIndexOf('import')
    if (idx === -1) return true // specifier without a visible import — fail closed
    const head = before.slice(idx).replace(/\s+/g, ' ').trim()
    if (!/^import\s+type(\s|$)/.test(head)) return true
  }
  return false
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

describe('paid prompt bodies never ship to the client bundle', () => {
  const importers = walk(SRC)
    .filter((file) => file !== join(SRC, 'lib', 'prompts.ts'))
    .filter((file) => {
      const text = readFileSync(file, 'utf8')
      if (!text.includes("@/lib/prompts")) return false
      return hasValuePromptsImport(text)
    })
    .map((file) => file.slice(repoRoot.length + 1))

  it('the detector itself catches multi-line value imports (no silent pass)', () => {
    expect(hasValuePromptsImport("import { useState } from 'react'\nimport {\n  PROMPT_LIBRARY,\n} from '@/lib/prompts'\n")).toBe(true)
    expect(hasValuePromptsImport("import { PROMPT_LIBRARY } from '@/lib/prompts'")).toBe(true)
    expect(hasValuePromptsImport("import type { PromptPlan } from '@/lib/prompts'")).toBe(false)
    expect(hasValuePromptsImport("import type {\n  PromptPlan,\n  PromptWithUnlock,\n} from '@/lib/prompts'")).toBe(false)
    expect(hasValuePromptsImport("const x = 1\nimport '@/lib/prompts'")).toBe(true) // bare side-effect import — fail closed
  })

  it('every importer of the full library is server-allowed', () => {
    const violations = importers.filter((rel) => !isServerAllowed(rel))
    expect(violations, `client-side imports of PROMPT_LIBRARY leak paid bodies: ${violations.join(', ')}`).toEqual([])
  })

  it('the workspace PromptsView fetches the catalog instead of importing it', () => {
    const view = readFileSync(join(repoRoot, 'src/components/prompts/prompts-view.tsx'), 'utf8')
    expect(view).not.toContain('PROMPT_LIBRARY')
    expect(view).toContain('buildApiPath')
    expect(view).toContain("fetch(buildApiPath('/api/prompts')")
  })

  it('the prompts API route serializes through the plan gate', () => {
    const route = readFileSync(join(repoRoot, 'src/app/api/prompts/route.ts'), 'utf8')
    expect(route).toContain('promptsForPlan')
    expect(route).toContain('withRequestOrgContext')
  })
})
