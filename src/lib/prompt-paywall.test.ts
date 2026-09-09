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
 * Comments are stripped first (so `import /* import type *​/` cannot forge a
 * type-only head — cubic P2 round 4), then each full import statement ending
 * in '@/lib/prompts' is matched in one pass: `import`, optional `type`, the
 * clause (no quotes in it — a specifier can't contain one before `from`),
 * `from`, the specifier. Side-effect imports match the optional-clause
 * branch as '' and count as value imports. Anything not matching a strict
 * `import type` head fails CLOSED (cubic P1 round 3: no silent passes).
 */
export function hasValuePromptsImport(text: string): boolean {
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1') // skip // inside strings
  const statement = /\bimport(\s+type)?\s*(?:[^'"]*?\bfrom\s*)?['"]@\/lib\/prompts['"]/g
  let match: RegExpExecArray | null
  while ((match = statement.exec(code)) !== null) {
    if (!match[1]) return true // value import
  }
  // A specifier present in code but not matched by any legal statement
  // shape is unparseable — fail closed.
  const specCount = (code.match(/['"]@\/lib\/prompts['"]/g) ?? []).length
  const stmtCount = (code.match(/\bimport[^;]*['"]@\/lib\/prompts['"]/g) ?? []).length
  if (specCount > 0 && stmtCount < specCount) return true
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
    // cubic P2 round 4: comment must not be able to forge a type-only head
    expect(hasValuePromptsImport("import /* import type */ {\n  PROMPT_LIBRARY,\n} from '@/lib/prompts'")).toBe(true)
    expect(hasValuePromptsImport("// import type x\nimport {\n  PROMPT_LIBRARY,\n} from '@/lib/prompts'")).toBe(true)
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
