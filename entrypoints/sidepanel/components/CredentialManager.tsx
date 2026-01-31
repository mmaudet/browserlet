import { useSignal, type Signal } from '@preact/signals';
import type { StoredPassword } from '../../../utils/passwords/types';
import { passwordStore, loadPasswords } from '../stores/passwords';
import { scriptsState } from '../stores/scripts';
import { deletePassword } from '../../../utils/passwords/storage';
import { unlockVault } from '../../../utils/passwords/vault';
import { extractCredentialRefs } from '../../../utils/passwords/substitution';

/**
 * Build a map of credential ID -> script names that use it.
 */
function buildUsageMap(): Map<string, string[]> {
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
            <span style={{ fontWeight: 500, color: '#333' }}>{credential.id}</span>
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
                title="Click to see which scripts use this credential"
              >
                {usageCount} script{usageCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
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
              color: '#666',
            }}
            title="Edit credential"
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
            title="Delete credential"
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
          <div style={{ fontWeight: 500, color: '#666', marginBottom: '4px' }}>Used by:</div>
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
  onSave: () => void;
  onCancel: () => void;
}

function EditForm({ credential, editPassword, onSave, onCancel }: EditFormProps) {
  return (
    <div
      style={{
        padding: '12px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fff9c4',
      }}
    >
      <div style={{ fontWeight: 500, color: '#333', marginBottom: '8px' }}>
        Edit: {credential.id}
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
        {credential.username} @ {formatUrl(credential.url)}
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
        Credential name cannot be changed. Delete and recreate to rename.
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>
          New Password
        </label>
        <input
          type="password"
          value={editPassword.value}
          onInput={(e: Event) => { editPassword.value = (e.target as HTMLInputElement).value; }}
          placeholder="Enter new password"
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
          Cancel
        </button>
        <button
          onClick={onSave}
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
          Save
        </button>
      </div>
    </div>
  );
}

async function handleUnlock(): Promise<void> {
  await unlockVault();
  await loadPasswords();
}

export function CredentialManager() {
  const editingId = useSignal<string | null>(null);
  const editPassword = useSignal('');

  const { passwords, vaultState, isLoading, error } = passwordStore;
  const usageMap = buildUsageMap();

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
  }

  async function handleSaveEdit(credential: StoredPassword): Promise<void> {
    if (editPassword.value) {
      // Import savePassword dynamically to update the password
      const { savePassword } = await import('../../../utils/passwords/storage');
      await savePassword(credential.url, credential.username, editPassword.value);
      await loadPasswords();
    }
    editingId.value = null;
    editPassword.value = '';
  }

  function handleCancelEdit(): void {
    editingId.value = null;
    editPassword.value = '';
  }

  // Locked state - show unlock button
  if (vaultState.value.isLocked) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#128274;</div>
          <div style={{ fontWeight: 500, color: '#333', marginBottom: '8px' }}>
            Vault is Locked
          </div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            Unlock to view and manage your stored credentials.
          </div>
          <button
            onClick={handleUnlock}
            style={{
              padding: '10px 24px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Unlock Vault
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading.value) {
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
          <div style={{ fontWeight: 500, color: '#333' }}>
            Stored Credentials
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {passwords.value.length} credential{passwords.value.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Credential list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {passwords.value.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>&#128273;</div>
            <div>No credentials stored.</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Credentials are captured during recording when you log into websites.
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
