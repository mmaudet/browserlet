import { useSignal, type Signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { StoredPassword } from '../../../utils/passwords/types';

// Helper to get i18n messages
const msg = (key: string): string => chrome.i18n.getMessage(key) || key;
import type { CapturedPassword } from '../../../entrypoints/content/recording/passwordCapture';
import { passwordStore, loadPasswords, refreshVaultState } from '../stores/passwords';
import { scriptsState } from '../stores/scripts';
import { deletePassword } from '../../../utils/passwords/storage';
import { unlockVault, lockVault } from '../../../utils/passwords/vault';
import { extractCredentialRefs } from '../../../utils/passwords/substitution';
import { clearCachedKey } from '../../../utils/crypto/masterPassword';
import { detectMigrationState } from '../../../utils/passwords/migration';
import { loadLLMConfig } from '../stores/llmConfig';
import { MasterPasswordSetup } from './MasterPasswordSetup';
import { VaultUnlock } from './VaultUnlock';
import { CredentialMigration } from './CredentialMigration';

/**
 * Build a map of credential ID/alias -> script names that use it.
 * Maps both the ID and alias (if set) to the same credential for lookup.
 */
function buildUsageMap(passwords: StoredPassword[]): Map<string, string[]> {
  const usage = new Map<string, string[]>();

  for (const script of scriptsState.value) {
    if (!script.content) continue;
    const refs = extractCredentialRefs(script.content);
    for (const ref of refs) {
      const scriptNames = usage.get(ref.name) || [];
      scriptNames.push(script.name);
      usage.set(ref.name, scriptNames);
    }
  }

  // Also map aliases to the same usage
  for (const password of passwords) {
    if (password.alias && usage.has(password.alias)) {
      const aliasUsage = usage.get(password.alias) || [];
      const idUsage = usage.get(password.id) || [];
      // Merge both usages
      const combined = Array.from(new Set([...aliasUsage, ...idUsage]));
      usage.set(password.id, combined);
      usage.set(password.alias, combined);
    }
  }

  return usage;
}

/**
 * Format a URL for display (truncated).
 */
function formatUrl(url: string, maxLength = 30): string {
  if (url.length <= maxLength) return url;
  // Remove protocol for brevity
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  if (withoutProtocol.length <= maxLength) return withoutProtocol;
  return withoutProtocol.substring(0, maxLength - 3) + '...';
}

/**
 * Format a timestamp for display.
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

interface CredentialItemProps {
  credential: StoredPassword;
  usageCount: number;
  scriptNames: string[];
  onDelete: () => void;
  onEdit: () => void;
}

function CredentialItem({ credential, usageCount, scriptNames, onDelete, onEdit }: CredentialItemProps) {
  const showUsage = useSignal(false);
  const copySuccess = useSignal(false);

  async function handleCopy() {
    const refName = credential.alias || credential.id;
    await navigator.clipboard.writeText(`{{credential:${refName}}}`);
    copySuccess.value = true;
    setTimeout(() => { copySuccess.value = false; }, 2000);
  }

  return (
    <div
      style={{
        padding: '12px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 500, color: '#333' }}>{credential.alias || credential.id}</span>
            {usageCount > 0 && (
              <button
                style={{
                  fontSize: '10px',
                  background: '#e3f2fd',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: '#1976d2',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => { showUsage.value = !showUsage.value; }}
                title={msg('credentialClickToSeeUsage')}
              >
                {usageCount} script{usageCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
          {credential.alias && (
            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
              ID: {credential.id}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            <span>{credential.username}</span>
            <span style={{ margin: '0 4px' }}>@</span>
            <span title={credential.url}>{formatUrl(credential.url)}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
            Updated: {formatDate(credential.updatedAt)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 6px',
              color: copySuccess.value ? '#4caf50' : '#666',
            }}
            title={msg('credentialCopyReference')}
            onClick={handleCopy}
          >
            {copySuccess.value ? '✓' : '📋'}
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 6px',
              color: '#666',
            }}
            title={msg('credentialEdit')}
            onClick={onEdit}
          >
            &#9999;&#65039;
          </button>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 6px',
              color: '#d32f2f',
            }}
            title={msg('credentialDelete')}
            onClick={onDelete}
          >
            &#128465;&#65039;
          </button>
        </div>
      </div>

      {/* Usage disclosure */}
      {showUsage.value && scriptNames.length > 0 && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          <div style={{ fontWeight: 500, color: '#666', marginBottom: '4px' }}>{msg('credentialUsedBy')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {scriptNames.map(name => (
              <span
                key={name}
                style={{
                  background: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: '1px solid #ddd',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface EditFormProps {
  credential: StoredPassword;
  editPassword: Signal<string>;
  editAlias: Signal<string>;
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ credential, editPassword, editAlias, onSave, onCancel }: EditFormProps) {
  const aliasError = useSignal('');

  function handleAliasInput(value: string) {
    editAlias.value = value;
    // Validate alias format
    if (value && !/^[a-zA-Z0-9_-]*$/.test(value)) {
      aliasError.value = 'Only alphanumeric, underscore, and hyphen allowed';
    } else {
      aliasError.value = '';
    }
  }

  return (
    <div
      style={{
        padding: '12px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff9c4',
      }}
    >
      <div style={{ fontWeight: 500, color: '#333', marginBottom: '8px' }}>
        Edit: {credential.alias || credential.id}
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
        {credential.username} @ {formatUrl(credential.url)}
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
        ID: {credential.id}
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
          Alias (optional)
        </label>
        <input
          type="text"
          value={editAlias.value}
          onInput={(e: Event) => { handleAliasInput((e.target as HTMLInputElement).value); }}
          placeholder={msg('credentialPlaceholderAlias')}
          style={{
            width: '100%',
            padding: '8px',
            border: aliasError.value ? '1px solid #d32f2f' : '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: '11px', color: aliasError.value ? '#d32f2f' : '#888', marginTop: '4px' }}>
          {aliasError.value || 'Alphanumeric, underscores, and hyphens only'}
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
          {msg('credentialNewPassword')}
        </label>
        <input
          type="password"
          value={editPassword.value}
          onInput={(e: Event) => { editPassword.value = (e.target as HTMLInputElement).value; }}
          placeholder={msg('credentialPlaceholderNewPassword')}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
          Leave empty to keep current password.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            background: '#f5f5f5',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          {msg('credentialCancel')}
        </button>
        <button
          onClick={onSave}
          disabled={!!aliasError.value}
          style={{
            padding: '6px 12px',
            background: aliasError.value ? '#ccc' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: aliasError.value ? 'not-allowed' : 'pointer',
            fontSize: '12px',
          }}
        >
          {msg('credentialSave')}
        </button>
      </div>
    </div>
  );
}

/**
 * Lock the vault - clears cached key and updates state.
 */
async function handleLock(): Promise<void> {
  await clearCachedKey();
  await lockVault();
  await refreshVaultState();
}

interface CredentialManagerProps {
  /**
   * Called when vault becomes ready (after setup or unlock).
   * Used by main.tsx to transition app state to 'ready'.
   */
  onVaultReady?: () => Promise<void>;
}

export function CredentialManager({ onVaultReady }: CredentialManagerProps) {
  const editingId = useSignal<string | null>(null);
  const editPassword = useSignal('');
  const editAlias = useSignal('');
  const captureMode = useSignal<'idle' | 'capturing' | 'confirming'>('idle');
  const capturedCredentials = useSignal<CapturedPassword[]>([]);

  // Migration state (null = checking, true = needs migration, false = no migration needed)
  const needsMigration = useSignal<boolean | null>(null);
  const migrationCredentialCount = useSignal(0);

  const { passwords, vaultState, isLoading, error } = passwordStore;
  const usageMap = buildUsageMap(passwords.value);

  /**
   * Called after master password setup is complete.
   * Updates vault state, loads passwords, reloads LLM config.
   * Does NOT call onVaultReady - migration check happens next.
   */
  async function handleSetupComplete(): Promise<void> {
    await unlockVault();
    await refreshVaultState();
    await loadPasswords();
    await loadLLMConfig();
    // Don't call onVaultReady here - migration check will run next
    // If no migration needed, the useEffect below will call onVaultReady
  }

  /**
   * Called after vault unlock is successful.
   * Updates vault state, loads passwords, reloads LLM config, and notifies parent.
   */
  async function handleUnlockSuccess(): Promise<void> {
    await unlockVault();
    await refreshVaultState();
    await loadPasswords();
    await loadLLMConfig();
    // Notify parent that vault is ready (no migration on unlock)
    if (onVaultReady) {
      await onVaultReady();
    }
  }

  // Load vault state and passwords on mount
  useEffect(() => {
    loadPasswords();
  }, []);

  // Check for migration needed on mount (only when not in setup mode)
  useEffect(() => {
    async function checkMigration() {
      // Only check migration after setup is complete
      if (vaultState.value.needsSetup) {
        needsMigration.value = false;
        return;
      }

      const state = await detectMigrationState();
      needsMigration.value = state.needsMigration;
      migrationCredentialCount.value = state.credentialCount;

      // If no migration needed and vault is unlocked, notify parent
      if (!state.needsMigration && !vaultState.value.isLocked && onVaultReady) {
        await onVaultReady();
      }
    }

    checkMigration();
  }, [vaultState.value.needsSetup]);

  /**
   * Called when migration is complete.
   * Clears migration state, refreshes vault, and notifies parent.
   */
  async function handleMigrationComplete(): Promise<void> {
    needsMigration.value = false;
    await refreshVaultState();
    await loadPasswords();
    // Notify parent that vault is ready after migration
    if (onVaultReady) {
      await onVaultReady();
    }
  }

  async function handleDelete(credential: StoredPassword): Promise<void> {
    const usageCount = usageMap.get(credential.id)?.length || 0;
    const usageNote = usageCount > 0 ? ` Used by ${usageCount} script(s).` : '';
    const confirmMessage = `Delete credential "${credential.id}"?${usageNote} This cannot be undone.`;

    if (confirm(confirmMessage)) {
      await deletePassword(credential.id);
      await loadPasswords();
    }
  }

  function handleStartEdit(credential: StoredPassword): void {
    editingId.value = credential.id;
    editPassword.value = '';
    editAlias.value = credential.alias || '';
  }

  async function handleSaveEdit(credential: StoredPassword): Promise<void> {
    const { updatePasswordAlias } = await import('../../../utils/passwords/storage');

    // Update alias (always, even if empty to allow clearing)
    await updatePasswordAlias(credential.id, editAlias.value || null);

    // Update password if provided
    if (editPassword.value) {
      const { savePassword } = await import('../../../utils/passwords/storage');
      await savePassword(credential.url, credential.username, editPassword.value);
    }

    await loadPasswords();
    editingId.value = null;
    editPassword.value = '';
    editAlias.value = '';
  }

  function handleCancelEdit(): void {
    editingId.value = null;
    editPassword.value = '';
    editAlias.value = '';
  }

  async function handleStartCapture(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_PASSWORD_CAPTURE' });
      captureMode.value = 'capturing';
    }
  }

  async function handleStopCapture(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'STOP_PASSWORD_CAPTURE' });
      if (response.success && response.data?.length > 0) {
        capturedCredentials.value = response.data;
        captureMode.value = 'confirming';
      } else {
        captureMode.value = 'idle';
        // Optionally show "no credentials captured" message
      }
    }
  }

  async function handleSaveCredentials(): Promise<void> {
    const { savePassword } = await import('../../../utils/passwords/storage');
    for (const cred of capturedCredentials.value) {
      await savePassword(cred.url, cred.username, cred.password);
    }
    capturedCredentials.value = [];
    captureMode.value = 'idle';
    await loadPasswords(); // refresh list
  }

  function handleCancelCapture(): void {
    capturedCredentials.value = [];
    captureMode.value = 'idle';
  }

  // First-time setup needed - show setup UI
  if (vaultState.value.needsSetup) {
    return <MasterPasswordSetup onSetupComplete={handleSetupComplete} />;
  }

  // Migration needed - show migration UI (after setup, before unlock)
  if (needsMigration.value === true) {
    return (
      <CredentialMigration
        onComplete={handleMigrationComplete}
        credentialCount={migrationCredentialCount.value}
      />
    );
  }

  // Vault locked - show unlock UI
  if (vaultState.value.isLocked) {
    return <VaultUnlock onUnlockSuccess={handleUnlockSuccess} />;
  }

  // Loading state (including migration check)
  if (isLoading.value || needsMigration.value === null) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
          Loading credentials...
        </div>
      </div>
    );
  }

  // Error state
  if (error.value) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{
          padding: '12px',
          background: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          fontSize: '13px',
        }}>
          {error.value}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontWeight: 500, color: '#333' }}>
              Stored Credentials
            </div>
            <button
              onClick={handleStartCapture}
              disabled={captureMode.value !== 'idle'}
              style={{
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                width: '24px',
                height: '24px',
                cursor: captureMode.value === 'idle' ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: captureMode.value === 'idle' ? 1 : 0.5,
              }}
              title={msg('credentialAdd')}
            >
              +
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {passwords.value.length} credential{passwords.value.length === 1 ? '' : 's'}
            </div>
            <button
              onClick={handleLock}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px',
                color: '#666',
              }}
              title={msg('credentialLockVault')}
            >
              &#128274;
            </button>
          </div>
        </div>
      </div>

      {/* Capturing mode banner */}
      {captureMode.value === 'capturing' && (
        <div style={{
          padding: '12px',
          background: '#f3e5f5',
          borderBottom: '1px solid #ce93d8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 500, color: '#7b1fa2' }}>🔑 Capture Mode Active</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Enter credentials on any login page, then click Stop
            </div>
          </div>
          <button
            onClick={handleStopCapture}
            style={{
              padding: '6px 12px',
              background: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Stop Capture
          </button>
        </div>
      )}

      {/* Confirming mode UI */}
      {captureMode.value === 'confirming' && (
        <div style={{ padding: '16px' }}>
          <div style={{ fontWeight: 500, marginBottom: '12px' }}>{msg('credentialCaptured')}</div>
          {capturedCredentials.value.map((cred, i) => (
            <div key={i} style={{
              padding: '12px',
              background: '#f5f5f5',
              borderRadius: '4px',
              marginBottom: '8px',
            }}>
              <div style={{ fontWeight: 500 }}>{cred.username || '(no username)'}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{cred.url}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={handleCancelCapture}
              style={{
                padding: '6px 12px',
                background: '#f5f5f5',
                color: '#666',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCredentials}
              style={{
                padding: '6px 12px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Save {capturedCredentials.value.length} Credential(s)
            </button>
          </div>
        </div>
      )}

      {/* Credential list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {captureMode.value === 'idle' && passwords.value.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>&#128273;</div>
            <div>{msg('credentialNoneStored')}</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Credentials are captured during recording when you log into websites.
            </div>
          </div>
        ) : captureMode.value === 'idle' ? (
          <div>
            {passwords.value.map(credential => {
              const scriptNames = usageMap.get(credential.id) || [];
              const usageCount = scriptNames.length;

              if (editingId.value === credential.id) {
                return (
                  <EditForm
                    key={credential.id}
                    credential={credential}
                    editPassword={editPassword}
                    editAlias={editAlias}
                    onSave={() => handleSaveEdit(credential)}
                    onCancel={handleCancelEdit}
                  />
                );
              }

              return (
                <CredentialItem
                  key={credential.id}
                  credential={credential}
                  usageCount={usageCount}
                  scriptNames={scriptNames}
                  onDelete={() => handleDelete(credential)}
                  onEdit={() => handleStartEdit(credential)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
