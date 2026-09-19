// Custom ESLint rule: ban un-awaited `return withRequestOrgContext(...)` inside
// a try block.
//
// Bug class (t_f10ef70d / PR #185, live on kingcrmhub.net): `withRequestOrgContext`
// returns a Promise. A `return withRequestOrgContext(request, handler)` that is
// NOT awaited lets a handler rejection (Prisma P2002, DB failure) escape the
// enclosing try/catch entirely — the catch's error mapping (409/400/403/500)
// never runs and Next.js emits an opaque empty-body 500.
//
// Scope is deliberately narrow:
//   - flags ONLY a ReturnStatement whose argument is a non-awaited
//     `withRequestOrgContext(...)` call and that sits inside a try block
//   - does NOT flag `return await withRequestOrgContext(...)` (the fixed form)
//   - does NOT flag bare `withRequestOrgContext(...)` outside a try (Next.js
//     awaits the returned promise itself; adding await there is pure churn)
//
// Meta fixer: rewrites `return withRequestOrgContext(` to
// `return await withRequestOrgContext(` — same-line, zero semantic change.

const MESSAGE_ID = 'mustAwait'

/** @type {import('eslint').Rule.RuleModule} */
const noUnawaitedOrgContext = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'withRequestOrgContext must be awaited inside a try block or the rejection escapes the catch (opaque empty-body 500)',
    },
    fixable: 'code',
    messages: {
      [MESSAGE_ID]:
        'withRequestOrgContext(...) must be awaited inside a try block: an un-awaited rejection escapes the catch and Next.js returns an opaque empty-body 500. Use `return await withRequestOrgContext(request, handler)`.',
    },
    schema: [],
  },
  create(context) {
    function isCallTo(node, name) {
      return (
        node &&
        node.type === 'CallExpression' &&
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === name
      )
    }

    function insideTryBlock(node) {
      const sourceCode = context.sourceCode
      for (const ancestor of sourceCode.getAncestors(node)) {
        if (ancestor.type === 'TryStatement' && ancestor.block) {
          const block = ancestor.block
          if (block.range[0] <= node.range[0] && node.range[1] <= block.range[1]) {
            return true
          }
        }
        if (ancestor.type === 'CatchClause') {
          return false
        }
      }
      return false
    }

    return {
      ReturnStatement(node) {
        const argument = node.argument
        if (!argument) return
        if (argument.type === 'AwaitExpression') return // fixed form
        if (!isCallTo(argument, 'withRequestOrgContext')) return
        if (!insideTryBlock(node)) return // safe fail-through: Next.js awaits the promise
        context.report({
          node,
          messageId: MESSAGE_ID,
          fix(fixer) {
            const sourceCode = context.sourceCode
            const calleeStart = argument.range[0]
            const returnTokenStart = node.range[0]
            const text = sourceCode.getText(node)
            // `return withRequestOrgContext(` … → `return await withRequestOrgContext(`
            if (text.startsWith('return await ')) return null
            return fixer.insertTextAfterRange([returnTokenStart, calleeStart], 'await ')
          },
        })
      },
    }
  },
}

export { noUnawaitedOrgContext }
export default noUnawaitedOrgContext
