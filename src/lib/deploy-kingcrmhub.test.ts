import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = join(import.meta.dirname, '..', '..')
const deployScriptPath = join(repoRoot, 'scripts', 'deploy-kingcrmhub.sh')
const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

/** Read the versioned deployment script under test. */
function readDeployScript(): string {
  expect(existsSync(deployScriptPath), 'versioned deploy script must exist').toBe(true)
  return readFileSync(deployScriptPath, 'utf8')
}

/** Create an executable command shim for the isolated deployment harness. */
function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content)
  chmodSync(path, 0o755)
}

interface DeployHarnessOptions {
  failLock?: boolean
  failVerify?: boolean
  keepContainerAfterRemove?: boolean
}

interface DeployHarness {
  deployLog: string
  env: Record<string, string>
  lockFile: string
  root: string
}

/**
 * Build an isolated harness (mocked git/docker/flock shims + env) that the
 * deploy script can run against. The flock shim performs REAL advisory
 * locking on the inherited file descriptor so concurrent deploys genuinely
 * contend on the same lock file.
 */
function createDeployHarness({ failLock = false, failVerify = false, keepContainerAfterRemove = false }: DeployHarnessOptions = {}): DeployHarness {
  const root = mkdtempSync(join(tmpdir(), 'kingcrmhub-deploy-test-'))
  tempDirs.push(root)

  const binDir = join(root, 'bin')
  const repoDir = join(root, 'repo')
  const composeFile = join(root, 'docker-compose.apps.yml')
  const deployLog = join(root, 'docker.log')
  const lockFile = join(root, 'deploy.lock')
  mkdirSync(binDir)
  mkdirSync(join(repoDir, '.git'), { recursive: true })
  writeFileSync(composeFile, 'services: {}\n')
  writeFileSync(deployLog, '')

  writeExecutable(
    join(binDir, 'git'),
    `#!/usr/bin/env bash
args=" $* "
if [[ "$args" == *" status --porcelain "* ]]; then exit 0; fi
if [[ "$args" == *" rev-parse --short HEAD "* ]]; then echo abc1234; fi
exit 0
`,
  )

  writeExecutable(
    join(binDir, 'sleep'),
    `#!/usr/bin/env bash
exit 0
`,
  )

  // Real flock semantics: acquire LOCK_EX|LOCK_NB on inherited FD 9 via
  // fcntl.flock. Fails with exit 1 when another process holds the lock.
  writeExecutable(
    join(binDir, 'flock'),
    `#!/usr/bin/env bash
if [[ "$FAIL_LOCK" == "1" ]]; then exit 1; fi
if [[ "$1" == "-n" && "$2" == "9" ]]; then
  python3 - <<'PY'
import fcntl, sys
try:
    fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
except OSError:
    sys.exit(1)
PY
  exit $?
fi
exit 0
`,
  )

  writeExecutable(
    join(binDir, 'docker'),
    `#!/usr/bin/env bash
printf '%s\n' "$*" >> "$DEPLOY_LOG"
args=" $* "
if [[ "$args" == *" compose version "* ]]; then exit 0; fi
if [[ "$args" == *" --stdin "* ]]; then
  cat >/dev/null
  if [[ "$FAIL_VERIFY" == "1" ]]; then exit 42; fi
  exit 0
fi
if [[ "$args" == *" container inspect "* ]]; then
  if [[ "$KEEP_CONTAINER_AFTER_REMOVE" == "1" ]]; then exit 0; fi
  exit 1
fi
if [[ "$args" == *" --format {{.Image}} kingcrmhub "* ]]; then
  printf 'sha256:old-image'
  exit 0
fi
if [[ "$args" == *" --format {{.Config.Image}} kingcrmhub "* ]]; then
  printf 'deployer-kingcrmhub'
  exit 0
fi
if [[ "$1" == "exec" ]]; then
  request_path="${'${@: -1}'}"
  case "$request_path" in
    /api/health) printf '{"status":"ok"}' ;;
    /api/ready) printf '{"ok":true,"ready":true,"database":"ok"}' ;;
    /) printf '<main data-deploy-marker="public-landing-v1">King CRM Hub</main>' ;;
    /sitemap.xml) printf '<urlset />' ;;
  esac
fi
exit 0
`,
  )

  const env: Record<string, string> = {
    COMPOSE_FILE: composeFile,
    DEPLOY_LOCK_FILE: lockFile,
    DEPLOY_LOG: deployLog,
    DEPLOY_ROOT: root,
    FAIL_LOCK: failLock ? '1' : '0',
    FAIL_VERIFY: failVerify ? '1' : '0',
    KEEP_CONTAINER_AFTER_REMOVE: keepContainerAfterRemove ? '1' : '0',
    PATH: `${binDir}:${process.env.PATH ?? ''}`,
    REPO_DIR: repoDir,
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && !(key in env)) env[key] = value
  }

  return { deployLog, env, lockFile, root }
}

/** Execute the deployment script against a fresh mocked harness. */
function runMockDeploy(options: DeployHarnessOptions = {}) {
  const harness = createDeployHarness(options)
  const result = spawnSync('bash', [deployScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: harness.env,
  })
  return { deployLog: harness.deployLog, result }
}

describe('KingCRMhub deploy hardening', () => {
  it('uses Prisma 7 db execute instead of constructing an adapter-less client', () => {
    const script = readDeployScript()

    expect(script).toContain('prisma db execute --stdin')
    expect(script).not.toContain('new PrismaClient')
    expect(script).not.toContain('--schema')
  })

  it('fails schema verification when any required onboarding column is missing', () => {
    const script = readDeployScript()

    expect(script).toContain("'onboardingCompleted'")
    expect(script).toContain("'onboardingCompletedAt'")
    expect(script).toContain("'onboardingStep'")
    expect(script).toContain("'boolean', 'NO', 'false'")
    expect(script).toContain("'timestamp without time zone', 'YES', NULL")
    expect(script).toContain("'integer', 'NO', '0'")
    expect(script).toContain('RAISE EXCEPTION')
  })

  it('uses the database-ready endpoint for replacement and rollback gates', () => {
    const script = readDeployScript()

    expect(script).toContain('container_get "$container_name" /api/ready')
  })

  it('completes when mocked build, migration, schema, and HTTP gates pass', () => {
    const { result } = runMockDeploy()

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('ORG_FIELDS_OK')
    expect(result.stdout).toContain('LANDING_MARKER_OK')
    expect(result.stdout).toContain('SITEMAP_OK')
    expect(result.stdout).toContain('DEPLOY_V4_DONE')
  })

  it('restores the original container when Prisma schema verification fails', () => {
    const { deployLog, result } = runMockDeploy({ failVerify: true })
    const output = `${result.stdout}\n${result.stderr}`
    const dockerCalls = readFileSync(deployLog, 'utf8')
    const rollbackImage = dockerCalls.match(/tag sha256:old-image (kingcrmhub-rollback:\S+)/)?.[1]
    const preserveImage = dockerCalls.indexOf(`tag sha256:old-image ${rollbackImage}`)
    const restoreImage = dockerCalls.indexOf(`tag ${rollbackImage} deployer-kingcrmhub`)
    const recreateOriginal = dockerCalls.indexOf('up -d --no-deps --force-recreate kingcrmhub', restoreImage)

    expect(result.status).toBe(1)
    expect(output).toContain('VERIFY_FAILED')
    expect(output).toContain('ROLLED_BACK_TO_ORIGINAL')
    expect(output).not.toContain('DEPLOY_V4_DONE')
    expect(rollbackImage).toMatch(/kingcrmhub-rollback:\d+-\d+/)
    expect(preserveImage).toBeGreaterThanOrEqual(0)
    expect(restoreImage).toBeGreaterThan(preserveImage)
    expect(recreateOriginal).toBeGreaterThan(restoreImage)
    expect(dockerCalls).not.toContain('rename kingcrmhub')
  })

  it('rejects a deploy when the lock cannot be acquired, before any Docker work', () => {
    const { deployLog, result } = runMockDeploy({ failLock: true })
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(75)
    expect(output).toContain('DEPLOY_ALREADY_RUNNING')
    expect(readFileSync(deployLog, 'utf8')).toBe('')
  })

  it('serializes concurrent deploys through a real file lock', async () => {
    const harness = createDeployHarness()

    // External holder takes a real LOCK_EX on the same lock file and keeps it.
    const holder = spawn(
      'python3',
      [
        '-c',
        'import fcntl, sys, time\nf = open(sys.argv[1], "w")\nfcntl.flock(f, fcntl.LOCK_EX)\nsys.stdout.write("LOCKED")\nsys.stdout.flush()\ntime.sleep(30)\n',
        harness.lockFile,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    try {
      await new Promise<void>((resolve, reject) => {
        holder.stdout?.once('data', chunk => {
          if (String(chunk).includes('LOCKED')) resolve()
          else reject(new Error('unexpected holder output'))
        })
        holder.once('exit', code => reject(new Error(`holder exited early: ${code}`)))
      })

      const result = spawnSync('bash', [deployScriptPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: harness.env,
      })
      const output = `${result.stdout}\n${result.stderr}`

      expect(result.status).toBe(75)
      expect(output).toContain('DEPLOY_ALREADY_RUNNING')
      expect(readFileSync(harness.deployLog, 'utf8')).toBe('')
    } finally {
      holder.kill('SIGKILL')
    }
  })

  it('uses unique per-process rollback tags across separate deploys', () => {
    const script = readDeployScript()
    expect(script).toContain('flock -n 9')
    expect(script).toContain('$(date +%Y%m%d%H%M%S)-$$')

    const first = runMockDeploy().result.stdout.match(/ROLLBACK_IMAGE=(\S+)/)?.[1]
    const second = runMockDeploy().result.stdout.match(/ROLLBACK_IMAGE=(\S+)/)?.[1]

    expect(first).toMatch(/^kingcrmhub-rollback:\d+-\d+$/)
    expect(second).toMatch(/^kingcrmhub-rollback:\d+-\d+$/)
    expect(first).not.toBe(second)
  })

  it('reports a distinct rollback failure when the replacement name remains occupied', () => {
    const { result } = runMockDeploy({ failVerify: true, keepContainerAfterRemove: true })
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(2)
    expect(output).toContain('ROLLBACK_NAME_CONFLICT')
    expect(output).not.toContain('ROLLED_BACK_TO_ORIGINAL')
  })

  it('uses the same stable public landing marker as the rendered page', () => {
    const landingPage = readFileSync(join(repoRoot, 'src/app/welcome/page.tsx'), 'utf8')
    const script = readDeployScript()

    expect(landingPage).toContain('data-deploy-marker="public-landing-v1"')
    expect(script).toContain('data-deploy-marker="public-landing-v1"')
    expect(script).toContain('AbortSignal.timeout(10_000)')
  })

  it('ships the Prisma 7 config in the runtime image used by db execute', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    const prismaConfig = readFileSync(join(repoRoot, 'prisma.config.ts'), 'utf8')

    expect(dockerfile).toContain('/app/prisma.config.ts ./prisma.config.ts')
    expect(packageJson.dependencies.dotenv).toBe('^16.6.1')
    expect(prismaConfig).toContain('seed: "npx tsx prisma/seed.ts"')
    expect(prismaConfig).not.toContain('seed: "bun prisma/seed.ts"')
  })
})
