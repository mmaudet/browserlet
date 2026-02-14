---
phase: 27-credential-wiring
plan: 01
status: complete
duration: "~15 min (with bug fix iteration)"
tasks_completed: 3
files_modified: 3
commits:
  - "81d32ec: feat(27-01): wire --vault flag and credential substitution to BSLRunner"
  - "fix: verify master password before proceeding (post-checkpoint)"
---

## What Was Built

Complete credential substitution flow for CLI: `--vault` flag prompts for master password, verifies it against vault validation data, then resolves `{{credential:alias}}` references in BSL scripts before step execution.

## Key Changes

**packages/cli/src/index.ts:**
- Added `--vault` CLI flag to Commander.js run command
- Vault existence check with clear error message
- Master password prompt via readline
- Password verification via `verifyMasterPassword()` before proceeding (bug fix: originally used `deriveKey()` without validation)
- Derived key passed to BSLRunner

**packages/cli/src/runner.ts:**
- BSLRunnerOptions extended with `derivedKey?: CryptoKey`
- Credential substitution wired before step execution using `substituteCredentials()`
- Fail-fast: credential references without `--vault` flag throw immediately

**packages/cli/src/vault/encryption.ts:**
- Added `promptMasterPassword()` using `readline/promises`

## Decisions

- **Password verification upfront**: Originally deferred to first decryption attempt, but wrong passwords produced silent failures. Fixed to verify against vault's `validationData` immediately.
- **Visible password input**: readline doesn't mask input by default. Acceptable for v1.7; would need `read` package for masking.

## Human Verification

All 4 tests passed:
1. Credential substitution works with correct password
2. Missing vault shows clear error
3. Credential references without `--vault` fail fast
4. Wrong master password shows "Invalid master password" and exits

## Requirements Satisfied

- CRED-01: Credential vault integration (master password unlock)
- CRED-02: {{credential:name}} reference resolution
- CRED-03: Fail-fast validation (missing credentials detected pre-run)
- CRED-04: Credential value redaction in logs (existing sanitizer)
