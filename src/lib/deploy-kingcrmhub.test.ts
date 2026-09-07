import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
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

/** Execute the deployment script against mocked Git and Docker commands. */
function runMockDeploy({ failVerify = false, keepContainerAfterRemove = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kingcrmhub-deploy-test-'))
  tempDirs.push(root)

  const binDir = join(root, 'bin')
  const repoDir = join(root, 'repo')
  const composeFile = join(root, 'docker-compose.apps.yml')
  const deployLog = join(root, 'docker.log')
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
if [[ "$1" == "exec" ]]; then
  request_path="${'${@: -1}'}"
  case "$request_path" in
    /api/health) printf '{"status":"ok"}' ;;
    /) printf '<main data-deploy-marker="public-landing-v1">King CRM Hub</main>' ;;
    /sitemap.xml) printf '<urlset />' ;;
  esac
fi
exit 0
`,
  )

  const result = spawnSync('bash', [deployScriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      COMPOSE_FILE: composeFile,
      DEPLOY_LOG: deployLog,
      DEPLOY_ROOT: root,
      FAIL_VERIFY: failVerify ? '1' : '0',
      KEEP_CONTAINER_AFTER_REMOVE: keepContainerAfterRemove ? '1' : '0',
      PATH: `${binDir}:${process.env.PATH ?? ''}`,
      REPO_DIR: repoDir,
    },
  })
  return { deployLog, result }
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
    expect(script).toContain('RAISE EXCEPTION')
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
    const restoreRename = dockerCalls.search(/rename kingcrmhub-old-\d+ kingcrmhub/)
    const restoreStart = dockerCalls.indexOf('start kingcrmhub', restoreRename)

    expect(result.status).toBe(1)
    expect(output).toContain('VERIFY_FAILED')
    expect(output).toContain('ROLLED_BACK_TO_ORIGINAL')
    expect(output).not.toContain('DEPLOY_V4_DONE')
    expect(restoreRename).toBeGreaterThanOrEqual(0)
    expect(restoreStart).toBeGreaterThan(restoreRename)
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

    expect(dockerfile).toContain('/app/prisma.config.ts ./prisma.config.ts')
  })
})
