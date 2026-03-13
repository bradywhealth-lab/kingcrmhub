#!/usr/bin/env node

const baseUrl = process.env.APP_BASE_URL
const internalRunnerKey = process.env.INTERNAL_RUNNER_KEY
const organizationId = process.env.RUNNER_ORGANIZATION_ID

if (!baseUrl) {
  console.error('Missing APP_BASE_URL')
  process.exit(1)
}
if (!internalRunnerKey) {
  console.error('Missing INTERNAL_RUNNER_KEY')
  process.exit(1)
}
if (!organizationId) {
  console.error('Missing RUNNER_ORGANIZATION_ID')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'x-internal-runner-key': internalRunnerKey,
  'x-organization-id': organizationId,
}

async function callRunner(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text}`)
  }
  console.log(`${path} ok: ${text}`)
}

async function main() {
  await callRunner('/api/sequences/run', {})
  await callRunner('/api/content/publish', { limit: 25 })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
