// RuleTester regression suite for eslint-rules/no-unawaited-org-context.mjs
//
// Covers the exact bug class proven in t_f10ef70d / PR #185:
// an un-awaited `return withRequestOrgContext(...)` inside a try block lets a
// handler rejection escape the catch → Next.js opaque empty-body 500 instead of
// the route's mapped JSON error.
//
// - invalid: un-awaited in-try form is flagged and the fixer inserts `await`
// - valid: awaited in-try (fixed form), bare return outside any try (Next.js
//   awaits the promise itself — safe fail-through, must NOT be flagged),
//   and a non-withRequestOrgContext call (no false positives)
// - negative control: lint the ACTUAL fixed packages routes from PR #185 —
//   the rule must report zero violations on those files.

import { describe, expect, it } from 'vitest'
import { RuleTester, Linter } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import rule from '../eslint-rules/no-unawaited-org-context.mjs'
import { readFileSync } from 'node:fs'

describe('eslint rule no-unawaited-org-context', () => {
  const ruleTester = new RuleTester({
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
  })

  it('flags the un-awaited in-try pattern, fixes with await, and passes valid cases', () => {
    ruleTester.run('no-unawaited-org-context', rule, {
      valid: [
        // fixed form: awaited inside try
        `export async function GET(request: any) {
           try {
             return await withRequestOrgContext(request, async (ctx) => 1)
           } catch (e) {
             return { error: 'x' }
           }
         }`,
        // safe fail-through: bare return outside any try — Next.js awaits it
        `export async function GET(request: any) {
           return withRequestOrgContext(request, async (ctx) => 1)
         }`,
        // not a withRequestOrgContext call
        `export async function GET(request: any) {
           try {
             return someOtherHelper(request)
           } catch (e) { return { error: 'x' } }
         }`,
      ],
      invalid: [
        {
          code: `export async function GET(request: any) {
            try {
              return withRequestOrgContext(request, async (ctx) => 1)
            } catch (e) {
              return { error: 'x' }
            }
          }`,
          output: `export async function GET(request: any) {
            try {
              return await withRequestOrgContext(request, async (ctx) => 1)
            } catch (e) {
              return { error: 'x' }
            }
          }`,
          errors: [{ messageId: 'mustAwait' }],
        },
      ],
    })
  })

  it('negative control: zero reports on the PR #185 fixed packages routes', () => {
    const linter = new Linter()
    const withRule = (code: string) =>
      linter.verify(code, [
        {
          languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest' } },
          plugins: { local: { rules: { 'no-unawaited-org-context': rule } } },
          rules: { 'local/no-unawaited-org-context': 'error' },
        },
      ])

    const sources = [
      readFileSync(new URL('../src/app/api/packages/route.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../src/app/api/packages/[id]/route.ts', import.meta.url), 'utf8'),
    ]

    for (const source of sources) {
      const messages = withRule(source)
      expect(messages, `expected 0 violations in packages routes`).toEqual([])
    }
  })
})
