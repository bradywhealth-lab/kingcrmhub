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
    .filter((file) => readFileSync(file, 'utf8').includes('@/lib/prompts'))
    .map((file) => file.slice(repoRoot.length + 1))

  it('every importer of the full library is server-allowed', () => {
    const violations = importers.filter((rel) => !isServerAllowed(rel))
    expect(violations, `client-side imports of PROMPT_LIBRARY leak paid bodies: ${violations.join(', ')}`).toEqual([])
  })

  it('the workspace PromptsView fetches the catalog instead of importing it', () => {
    const view = readFileSync(join(repoRoot, 'src/components/prompts/prompts-view.tsx'), 'utf8')
    expect(view).not.toContain('PROMPT_LIBRARY')
    expect(view).toContain("fetch('/api/prompts'")
  })

  it('the prompts API route serializes through the plan gate', () => {
    const route = readFileSync(join(repoRoot, 'src/app/api/prompts/route.ts'), 'utf8')
    expect(route).toContain('promptsForPlan')
    expect(route).toContain('withRequestOrgContext')
  })
})
