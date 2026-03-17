#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

function detectPackageRunner() {
  const preferredRunner = process.env.RELEASE_GATE_RUNNER?.trim()
  if (preferredRunner) return preferredRunner

  const bunCheck = spawnSync('bun', ['--version'], { stdio: 'ignore' })
  if (bunCheck.status === 0) return 'bun'

  return 'npm'
}

const packageRunner = detectPackageRunner()

const checks = [
  { label: 'Lint', args: ['run', 'lint'] },
  { label: 'Build', args: ['run', 'build'] },
  { label: 'Prisma generate', args: ['run', 'db:generate'] },
  { label: 'Tests', args: ['run', 'test'] },
]

console.log(`Using package runner: ${packageRunner}`)

for (const check of checks) {
  console.log(`\n=== ${check.label}: ${packageRunner} ${check.args.join(' ')} ===`)
  const result = spawnSync(packageRunner, check.args, { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\nRelease gate failed at: ${check.label}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\nRelease gate passed.')
