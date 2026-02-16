---
phase: 032-vault-unlock-cache
plan: 01
subsystem: cli-vault
tags:
  - encryption
  - caching
  - security
  - filesystem
dependency_graph:
  requires:
    - packages/cli/src/vault/encryption.ts (encrypt/decrypt functions)
    - packages/cli/src/vault/storage.ts (readVault/writeVault functions)
  provides:
    - vault-cache-module (getCachedKey/setCachedKey/clearCache/cleanupExpiredCache)
    - device-key-infrastructure (getOrCreateDeviceKey in storage.ts)
  affects:
    - future-vault-unlock-flow (will use cache to avoid repeated password prompts)
tech_stack:
  added:
    - env-paths (cross-platform temp directory)
  patterns:
    - JWK export/import for CryptoKey serialization
    - AES-GCM encryption of cached keys
    - TTL-based cache expiration
    - Delete-before-write for file permission enforcement
    - Lazy device key generation for backward compatibility
key_files:
  created:
    - packages/cli/src/vault/cache.ts
  modified:
    - packages/cli/src/vault/storage.ts
decisions:
  - Device key is random (not password-derived) to avoid PBKDF2 overhead on cache operations
  - Cache TTL set to 15 minutes as balanced security/UX tradeoff
  - Delete-before-write pattern ensures 0600 permissions apply (mode only works on new files)
  - Lazy device key generation maintains backward compatibility with existing vaults
  - Synchronous cleanupExpiredCache for CLI startup (acceptable for single file operation)
metrics:
  duration_seconds: 147
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_date: 2026-02-16
---

# Phase 32 Plan 01: Vault Cache Infrastructure Summary

**One-liner:** JWT-encrypted vault cache with device key, 15-minute TTL, 0600 permissions, and user-isolated temp storage

## Objective

Create the vault cache module that encrypts and stores derived CryptoKeys in a temp file with TTL-based expiration, plus add device key infrastructure to vault.json for cache encryption.

This module eliminates repeated master password prompts by caching the derived encryption key in a secure, encrypted temp file.

## What Was Built

### 1. Device Key Infrastructure (storage.ts)

Added device key support to VaultData:
- **New field:** `deviceKey?: string` (optional for backward compatibility)
- **New function:** `getOrCreateDeviceKey()` - lazy generation of 256-bit random AES-GCM key
- **Lazy migration:** Existing vaults get device key on first cache access
- **Storage:** Device key stored as base64 in vault.json

**Key design decision:** Device key is random (not password-derived) to avoid PBKDF2 overhead on every cache read/write. This is safe because the cache file itself is protected by filesystem permissions (0600) and user isolation.

### 2. Vault Cache Module (cache.ts)

Created complete cache management module with 5 exported functions:

**getCachedKey(): Promise<CryptoKey | null>**
- Reads encrypted cache file from temp directory
- Validates TTL (expires after 15 minutes)
- Decrypts JWK using device key
- Imports CryptoKey from JWK
- Returns null if missing/expired/corrupted (self-healing)

**setCachedKey(key: CryptoKey): Promise<void>**
- Exports CryptoKey to JWK format
- Encrypts JWK using device key (AES-GCM)
- Deletes old cache file first (ensures 0600 applies)
- Writes to temp directory with 0600 permissions

**clearCache(): Promise<void>**
- Deletes cache file (ignores ENOENT)
- Used for explicit cache invalidation

**cleanupExpiredCache(): void**
- Synchronous cleanup for CLI startup
- Removes stale cache files without blocking

**getCachePath(): string**
- Platform-specific temp directory via env-paths
- User isolation: includes UID on Unix systems
- Example: `/var/folders/.../T/browserlet/vault-cache-501.enc`

**CACHE_TTL_MS = 900000** (15 minutes)
- Configurable constant for TTL
- Balances security (short enough) vs UX (reduces password prompts)

### Security Model

1. **Encryption:** Cache entry encrypted with device key (256-bit AES-GCM)
2. **Permissions:** Cache file created with mode 0600 (owner read/write only)
3. **User Isolation:** Cache path includes UID on Unix (prevents cross-user access)
4. **TTL:** Cache expires after 15 minutes (automatic cleanup on read)
5. **Self-Healing:** Corrupt/expired cache files automatically deleted

### File Structure

```typescript
interface VaultCacheEntry {
  encryptedJwk: {
    ciphertext: string;  // Base64 encrypted JWK
    iv: string;          // Base64 IV for AES-GCM
  };
  expiresAt: number;     // Unix timestamp (ms)
  createdAt: number;     // Unix timestamp (ms)
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:

1. **TypeScript compilation:** Zero errors (`npx tsc --noEmit -p packages/cli/tsconfig.json`)
2. **File existence:** cache.ts created, storage.ts modified
3. **Imports resolution:** All imports (encryption.ts, storage.ts, env-paths) resolve correctly
4. **Backward compatibility:** VaultData.deviceKey is optional (existing vaults parse without error)
5. **Key links verified:**
   - cache.ts → encryption.ts (encrypt/decrypt)
   - cache.ts → storage.ts (getOrCreateDeviceKey)
   - cache.ts → env-paths (cross-platform temp directory)
   - storage.ts contains deviceKey field

## Success Criteria Met

- [x] cache.ts module exists with all 5 functions
- [x] storage.ts has VaultData.deviceKey optional field
- [x] getOrCreateDeviceKey() function implemented
- [x] TypeScript compilation passes
- [x] Cache uses AES-GCM encryption (not plaintext)
- [x] File permissions are 0600 (enforced via delete-before-write)
- [x] TTL is 15 minutes (CACHE_TTL_MS = 900000)
- [x] All exports present: getCachedKey, setCachedKey, clearCache, cleanupExpiredCache, getCachePath, CACHE_TTL_MS

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add device key to VaultData and generate during vault init | 60c5439 | packages/cli/src/vault/storage.ts |
| 2 | Create vault cache module with encrypted key storage and TTL | 06c4317 | packages/cli/src/vault/cache.ts |

## Next Steps

This plan provides the foundation for vault unlock caching. The next steps are:

1. **Phase 32 Plan 02:** Integrate cache into vault unlock flow (check cache before prompting password)
2. **Phase 32 Plan 03:** Add cache management to CLI commands (vault lock, vault status)
3. **Testing:** Add unit tests for cache module (optional - TDD not required for this plan)

## Self-Check

Verification of created artifacts:

**Files created:**
- [x] packages/cli/src/vault/cache.ts exists
- [x] Exports getCachedKey, setCachedKey, clearCache, cleanupExpiredCache, getCachePath, CACHE_TTL_MS

**Files modified:**
- [x] packages/cli/src/vault/storage.ts has deviceKey field
- [x] packages/cli/src/vault/storage.ts exports getOrCreateDeviceKey

**Commits exist:**
- [x] 60c5439: feat(032-01): add device key infrastructure to vault storage
- [x] 06c4317: feat(032-01): implement vault cache with encrypted key storage and TTL

**TypeScript compilation:**
- [x] Zero errors in packages/cli/tsconfig.json

## Self-Check: PASSED

All files, commits, and compilation checks verified successfully.
