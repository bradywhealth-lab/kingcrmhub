#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Provide your Postgres URL and rerun.')
  process.exit(1)
}

if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
  console.error('DATABASE_URL must be a Postgres URL (postgres:// or postgresql://).')
  process.exit(1)
}

const result = spawnSync('npx', ['prisma', 'db', 'execute', '--file', 'prisma/init.sql'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
