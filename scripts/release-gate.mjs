#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const checks = [
  { label: 'Lint', command: 'npm', args: ['run', 'lint'] },
  { label: 'Typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { label: 'Build', command: 'npm', args: ['run', 'build'] },
  { label: 'Prisma generate', command: 'npm', args: ['run', 'db:generate'] },
  { label: 'Tests', command: 'npm', args: ['run', 'test'] },
]

for (const check of checks) {
  console.log(`\n=== ${check.label}: ${check.command} ${check.args.join(' ')} ===`)
  const result = spawnSync(check.command, check.args, { stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`\nRelease gate failed at: ${check.label}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\nRelease gate passed.')
