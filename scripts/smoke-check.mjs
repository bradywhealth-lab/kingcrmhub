#!/usr/bin/env node

const baseUrl = process.env.APP_BASE_URL?.trim()?.replace(/\/$/, '')

if (!baseUrl) {
  console.error('Missing APP_BASE_URL')
  process.exit(1)
}

async function readJson(response) {
  const text = await response.text()

  try {
    return { text, json: JSON.parse(text) }
  } catch {
    return { text, json: null }
  }
}

async function expectJson({ label, path, method = 'GET', expectedStatus = 200, body }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await readJson(response)

  if (response.status !== expectedStatus) {
    throw new Error(
      `${label} expected status ${expectedStatus}, received ${response.status}. Body: ${payload.text}`,
    )
  }

  console.log(`${label} ok (${response.status}): ${payload.text}`)
  return payload.json
}

async function main() {
  const health = await expectJson({ label: 'Health check', path: '/api/health' })
  if (!health?.ok) {
    throw new Error(`Health check returned unexpected payload: ${JSON.stringify(health)}`)
  }

  const ready = await expectJson({ label: 'Readiness check', path: '/api/ready' })
  if (!ready?.ok || !ready?.ready) {
    throw new Error(`Readiness check returned unexpected payload: ${JSON.stringify(ready)}`)
  }

  const sequenceAuth = await expectJson({
    label: 'Sequence runner auth check',
    path: '/api/sequences/run',
    method: 'POST',
    expectedStatus: 401,
    body: {},
  })
  if (sequenceAuth?.error !== 'Unauthorized runner request') {
    throw new Error(`Sequence runner auth check returned unexpected payload: ${JSON.stringify(sequenceAuth)}`)
  }

  const publishAuth = await expectJson({
    label: 'Content publish auth check',
    path: '/api/content/publish',
    method: 'POST',
    expectedStatus: 401,
    body: {},
  })
  if (publishAuth?.error !== 'Unauthorized runner request') {
    throw new Error(`Content publish auth check returned unexpected payload: ${JSON.stringify(publishAuth)}`)
  }

  console.log('\nDeployment smoke checks passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
