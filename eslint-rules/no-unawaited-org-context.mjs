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
//     belonging to the SAME function (function boundaries are respected: a
//     helper declared inside a try is its own scope)
//   - does NOT flag `return await withRequestOrgContext(...)` (the fixed form)
//   - does NOT flag bare `withRequestOrgContext(...)` outside a try (Next.js
//     awaits the returned promise itself; adding await there is pure churn)
//
// Autofix: offered ONLY when the containing function is `async`. For a
// synchronous containing function the report carries an explicit
// must-be-async message and no blind fix (inserting `await` inside a sync
// function would produce invalid JavaScript).

const MESSAGE_ID = 'mustAwait'
const MESSAGE_ID_SYNC = 'mustBeAsyncFunction'

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
])

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
      [MESSAGE_ID_SYNC]:
        'withRequestOrgContext(...) is used inside a try block of a NON-async function: an un-awaited rejection escapes the catch and Next.js returns an opaque empty-body 500. Make the containing function async and use `return await withRequestOrgContext(request, handler)`.',
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

    function nearestFunctionAncestor(node) {
      const ancestors = context.sourceCode.getAncestors(node)
      for (let i = ancestors.length - 1; i >= 0; i--) {
        if (FUNCTION_TYPES.has(ancestors[i].type)) return ancestors[i]
      }
      return null
    }

    function insideTryBlock(node) {
      const ancestors = context.sourceCode.getAncestors(node)
      // Respect function boundaries: only try blocks that lexically enclose the
      // return INSIDE the nearest function count. A function declared inside a
      // try block does not inherit that try's catch for its own returns.
      let functionIndex = -1
      for (let i = ancestors.length - 1; i >= 0; i--) {
        if (FUNCTION_TYPES.has(ancestors[i].type)) {
          functionIndex = i
          break
        }
      }
      for (let i = functionIndex + 1; i < ancestors.length; i++) {
        const a = ancestors[i]
        if (a.type === 'TryStatement' && a.block) {
          if (a.block.range[0] <= node.range[0] && node.range[1] <= a.block.range[1]) {
            return true
          }
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

        const fn = nearestFunctionAncestor(node)
        if (!fn || fn.async !== true) {
          context.report({ node, messageId: MESSAGE_ID_SYNC })
          return
        }

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
