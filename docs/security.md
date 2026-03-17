# Security Workflow Matrix

This document defines the mandatory security checks used in GitHub Actions and the required branch protection configuration for `main`.

## Workflow matrix

| Workflow file | Job/check name | Trigger | Purpose | Fail threshold |
|---|---|---|---|---|
| `.github/workflows/ci.yml` | `dependency-audit` | `push` (`main`, `cursor/**`), `pull_request` (`main`) | Runs package vulnerability audit | Fails on `npm audit --audit-level=high` (high+critical) |
| `.github/workflows/dependency-review.yml` | `Block vulnerable dependency changes` | `pull_request` (`main`) | Blocks vulnerable dependency changes in PRs | `fail-on-severity: high` |
| `.github/workflows/secret-scan.yml` | `gitleaks` | `push` (`main`, `cursor/**`), `pull_request` (`main`) | Detects committed secrets | Any finding fails |
| `.github/workflows/codeql.yml` | `Analyze JavaScript/TypeScript` | `push` (`main`), `pull_request` (`main`), weekly cron | Static analysis for code vulnerabilities | Any CodeQL policy violation fails |
| `.github/workflows/branch-protection.yml` | `enforce-security-required-checks` | `pull_request_target` (`main`), `workflow_dispatch` | Verifies `main` branch protection still requires all security checks | Fails if any required check is missing |

## Action pinning policy

All third-party `uses:` references in `.github/workflows/` are pinned to immutable commit SHAs, with the upstream tag preserved in an inline comment for readability (for example: `# v5`).

## Required branch protection checks (`main`)

Configure branch protection on `main` with these required status checks:

- `Status Checks / dependency-audit`
- `Status Checks / lint`
- `Status Checks / typecheck`
- `Status Checks / test`
- `Status Checks / build`
- `Secret Scan / gitleaks`
- `Dependency Review / Block vulnerable dependency changes`
- `CodeQL / Analyze JavaScript/TypeScript`
- `Branch Protection Policy / enforce-security-required-checks`

This ensures secret scanning, dependency risk controls, and static analysis are all mandatory before merge.
