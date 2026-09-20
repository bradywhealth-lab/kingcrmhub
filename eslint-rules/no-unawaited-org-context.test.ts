// Regression suite for eslint-rules/no-unawaited-org-context.mjs
//
// Covers the exact bug class proven in t_f10ef70d / PR #185:
// an un-awaited `return withRequestOrgContext(...)` inside a try block lets a
// handler rejection escape the catch → Next.js opaque empty-body 500 instead of
// the route's mapped JSON error.
//
// Cases (each an explicit assertion, no nested test registration):
//  1. un-awaited in-try inside an async fn  → 1 mustAwait report, fixer inserts `await`
//  2. un-awaited in-try inside a sync fn    → 1 mustBeAsyncFunction report, NO autofix
//  3. awaited in-try (fixed form)          → 0 reports
//  4. bare fail-through outside any try    → 0 reports (Next.js awaits it)
//  5. unrelated helper call                → 0 reports
//  6. helper declared inside a try whose own return is not flagged (function
//     boundary)                            → 0 reports
//  7. negative control: the ACTUAL PR #185 fixed packages routes → 0 reports

import { describe, expect, it } from 'vitest'
import { Linter } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import rule from '../eslint-rules/no-unawaited-org-context.mjs'
import { readFileSync } from 'node:fs'

describe('eslint rule no-unawaited-org-context', () => {
  const linter = new Linter()
  const withRule = (code: string) =>
    linter.verify(code, [
      {
        languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest' } },
        plugins: { local: { rules: { 'no-unawaited-org-context': rule } } },
        rules: { 'local/no-unawaited-org-context': 'error' },
      },
    ])
  const messages = (code: string) =>
    withRule(code).map((m) => m.messageId as string)

  it('flags un-awaited in-try return in an async function (mustAwait)', () => {
    const code = `export async function GET(request: any) {
      try {
        return withRequestOrgContext(request, async (ctx) => 1)
      } catch (e) {
        return { error: 'x' }
      }
    }`
    expect(messages(code)).toEqual(['mustAwait'])
  })

  it('does not autofix inside a synchronous function (mustBeAsyncFunction, no blind fix)', () => {
    const code = `export function GET(request: any) {
      try {
        return withRequestOrgContext(request, async (ctx) => 1)
      } catch (e) {
        return { error: 'x' }
      }
    }`
    expect(messages(code)).toEqual(['mustBeAsyncFunction'])
    const fixResult = linter.verifyAndFix(code, [
      {
        languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest' } },
        plugins: { local: { rules: { 'no-unawaited-org-context': rule } } },
        rules: { 'local/no-unawaited-org-context': 'error' },
      },
    ])
    expect(fixResult.fixed).toBe(false)
    expect(fixResult.output).toBe(code)
  })

  it('accepts the fixed awaited form inside a try', () => {
    const code = `export async function GET(request: any) {
      try {
        return await withRequestOrgContext(request, async (ctx) => 1)
      } catch (e) {
        return { error: 'x' }
      }
    }`
    expect(messages(code)).toEqual([])
  })

  it('accepts bare fail-through outside any try (Next.js awaits the promise)', () => {
    const code = `export async function GET(request: any) {
      return withRequestOrgContext(request, async (ctx) => 1)
    }`
    expect(messages(code)).toEqual([])
  })

  it('accepts unrelated helper calls', () => {
    const code = `export async function GET(request: any) {
      try {
        return someOtherHelper(request)
      } catch (e) {
        return { error: 'x' }
      }
    }`
    expect(messages(code)).toEqual([])
  })

  it('respects function boundaries: helper declared inside a try is not flagged', () => {
    const code = `export async function GET(request: any) {
      try {
        const helper = () => {
          return withRequestOrgContext(request, async (ctx) => 1)
        }
        return await helper()
      } catch (e) {
        return { error: 'x' }
      }
    }`
    expect(messages(code)).toEqual([])
  })

  it('meta fixer rewrites to await (verifyAndFix round-trip on the async invalid case)', () => {
    const before = `export async function GET(request: any) {
      try {
        return withRequestOrgContext(request, async (ctx) => 1)
      } catch (e) {
        return { error: 'x' }
      }
    }`
    const expectedOutput = `export async function GET(request: any) {
      try {
        return await withRequestOrgContext(request, async (ctx) => 1)
      } catch (e) {
        return { error: 'x' }
      }
    }`
    const result = linter.verifyAndFix(before, [
      {
        languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest' } },
        plugins: { local: { rules: { 'no-unawaited-org-context': rule } } },
        rules: { 'local/no-unawaited-org-context': 'error' },
      },
    ])
    expect(result.fixed).toBe(true)
    expect(result.output).toBe(expectedOutput)
    expect(result.messages).toEqual([])
  })

  it('negative control: zero reports on the PR #185 fixed packages routes', () => {
    const sources = [
      readFileSync(new URL('../src/app/api/packages/route.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/app/api/packages/[id]/route.ts', import.meta.url), 'utf8'),
    ]
    for (const source of sources) {
      expect(withRule(source), `expected 0 violations in packages routes`).toEqual([])
    }
  })
})
