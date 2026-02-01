import { useSignal } from '@preact/signals';
import type { StoredPassword } from '../../../utils/passwords/types';
import {
  getLegacyCredentialMetadata,
  saveMigratedCredentials,
  markMigrationComplete,
  type LegacyCredentialMetadata,
} from '../../../utils/passwords/migration';
import { getCachedDerivedKey } from '../../../utils/crypto/masterPassword';
import { encryptWithKey } from '../../../utils/crypto/encryption';

// Helper to get i18n messages
const msg = (key: string, substitutions?: string[]): string =>
  chrome.i18n.getMessage(key, substitutions) || key;

/**
 * Props for CredentialMigration component.
 */
interface CredentialMigrationProps {
  /** Called when migration is finished (success or skip all) */
  onComplete: () => void;
  /** Number of credentials to migrate */
  credentialCount: number;
}

// Step type for state machine
type MigrationStep = 'explain' | 're-enter' | 'complete';

// Styles
const containerStyle: Record<string, string | number> = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  minHeight: '100%',
};

const cardStyle: Record<string, string | number> = {
  width: '100%',
  maxWidth: '420px',
  background: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
};

const iconStyle: Record<string, string | number> = {
  fontSize: '48px',
  textAlign: 'center',
  marginBottom: '16px',
};

const titleStyle: Record<string, string | number> = {
  margin: '0 0 12px 0',
  fontSize: '20px',
  fontWeight: 600,
  color: '#333',
  textAlign: 'center',
};

const descriptionStyle: Record<string, string | number> = {
  margin: '0 0 16px 0',
  fontSize: '14px',
  color: '#666',
  textAlign: 'center',
  lineHeight: 1.5,
};

const warningStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#fff3e0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#e65100',
  marginBottom: '20px',
  lineHeight: 1.4,
};

const errorStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#ffebee',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#c62828',
  marginBottom: '16px',
};

const successStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#e8f5e9',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#2e7d32',
  marginBottom: '16px',
  textAlign: 'center',
};

const buttonPrimaryStyle: Record<string, string | number> = {
  width: '100%',
  padding: '14px',
  background: '#4285f4',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
  marginBottom: '8px',
};

const buttonSecondaryStyle: Record<string, string | number> = {
  width: '100%',
  padding: '12px',
  background: '#f5f5f5',
  color: '#666',
  border: '1px solid #ddd',
  borderRadius: '8px',
  fontSize: '14px',
  cursor: 'pointer',
};

const buttonDangerStyle: Record<string, string | number> = {
  width: '100%',
  padding: '12px',
  background: 'white',
  color: '#d32f2f',
  border: '1px solid #d32f2f',
  borderRadius: '8px',
  fontSize: '14px',
  cursor: 'pointer',
};

const buttonSuccessStyle: Record<string, string | number> = {
  width: '100%',
  padding: '14px',
  background: '#4caf50',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
};

const progressStyle: Record<string, string | number> = {
  fontSize: '13px',
  color: '#666',
  textAlign: 'center',
  marginBottom: '16px',
};

const credentialInfoStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#f5f5f5',
  borderRadius: '8px',
  marginBottom: '16px',
};

const credentialUsernameStyle: Record<string, string | number> = {
  fontWeight: 500,
  color: '#333',
  marginBottom: '4px',
};

const credentialUrlStyle: Record<string, string | number> = {
  fontSize: '12px',
  color: '#666',
  wordBreak: 'break-all',
};

const credentialAliasStyle: Record<string, string | number> = {
  fontSize: '11px',
  color: '#999',
  marginTop: '4px',
};

const inputGroupStyle: Record<string, string | number> = {
  marginBottom: '16px',
};

const labelStyle: Record<string, string | number> = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#444',
  marginBottom: '6px',
};

const inputStyle: Record<string, string | number> = {
  width: '100%',
  padding: '12px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const buttonRowStyle: Record<string, string | number> = {
  display: 'flex',
  gap: '8px',
};

const buttonHalfStyle: Record<string, string | number> = {
  flex: 1,
  padding: '12px',
  borderRadius: '8px',
  fontSize: '14px',
  cursor: 'pointer',
};

const statsStyle: Record<string, string | number> = {
  fontSize: '14px',
  color: '#666',
  textAlign: 'center',
  marginBottom: '20px',
};

/**
 * Three-step migration component for legacy credentials.
 *
 * Steps:
 * 1. explain - Shows why migration is needed
 * 2. re-enter - User re-enters password for each credential
 * 3. complete - Shows success message with stats
 */
export function CredentialMigration({
  onComplete,
  credentialCount,
}: CredentialMigrationProps) {
  // State machine
  const step = useSignal<MigrationStep>('explain');
  const legacyCredentials = useSignal<LegacyCredentialMetadata[]>([]);
  const currentIndex = useSignal(0);
  const currentPassword = useSignal('');
  const migratedCredentials = useSignal<StoredPassword[]>([]);
  const skippedCount = useSignal(0);
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);

  /**
   * Load legacy credentials metadata and transition to re-enter step.
   */
  async function handleStartMigration(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const metadata = await getLegacyCredentialMetadata();
      legacyCredentials.value = metadata;
      currentIndex.value = 0;
      step.value = 're-enter';
    } catch (err) {
      error.value =
        err instanceof Error
          ? `${msg('migrationErrorLoad')}: ${err.message}`
          : msg('migrationErrorLoad');
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Skip all and delete - user confirms they want to lose all credentials.
   */
  async function handleSkipAll(): Promise<void> {
    const confirmed = confirm(msg('migrationSkipAllConfirm'));

    if (confirmed) {
      // Clear all credentials and mark migration complete
      await saveMigratedCredentials([]);
      await markMigrationComplete();
      onComplete();
    }
  }

  /**
   * Handle re-entering password for current credential.
   */
  async function handleNextCredential(): Promise<void> {
    if (!currentPassword.value) {
      error.value = msg('migrationErrorEmpty');
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // Get the cached derived key
      const key = await getCachedDerivedKey();
      if (!key) {
        error.value = msg('migrationErrorLocked');
        isLoading.value = false;
        return;
      }

      // Get current legacy credential
      const legacy = legacyCredentials.value[currentIndex.value];

      // Encrypt password with master password-derived key
      const encrypted = await encryptWithKey(currentPassword.value, key);

      // Create new StoredPassword
      const migrated: StoredPassword = {
        id: legacy.id,
        url: legacy.url,
        username: legacy.username,
        encryptedPassword: encrypted,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Preserve alias if present
      if (legacy.alias) {
        migrated.alias = legacy.alias;
      }

      // Add to migrated list
      migratedCredentials.value = [...migratedCredentials.value, migrated];

      // Clear password input
      currentPassword.value = '';

      // Move to next or complete
      if (currentIndex.value + 1 >= legacyCredentials.value.length) {
        await completeMigration();
      } else {
        currentIndex.value = currentIndex.value + 1;
      }
    } catch (err) {
      error.value =
        err instanceof Error
          ? `${msg('migrationErrorEncrypt')}: ${err.message}`
          : msg('migrationErrorEncrypt');
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Skip current credential and move to next.
   */
  function handleSkipCredential(): void {
    skippedCount.value = skippedCount.value + 1;
    currentPassword.value = '';
    error.value = null;

    if (currentIndex.value + 1 >= legacyCredentials.value.length) {
      completeMigration();
    } else {
      currentIndex.value = currentIndex.value + 1;
    }
  }

  /**
   * Save migrated credentials and mark migration complete.
   */
  async function completeMigration(): Promise<void> {
    isLoading.value = true;

    try {
      // Save all migrated credentials
      await saveMigratedCredentials(migratedCredentials.value);

      // Mark migration as complete
      await markMigrationComplete();

      // Transition to complete step
      step.value = 'complete';
    } catch (err) {
      error.value =
        err instanceof Error
          ? `${msg('migrationErrorSave')}: ${err.message}`
          : msg('migrationErrorSave');
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Handle password input change.
   */
  function handlePasswordInput(e: Event): void {
    currentPassword.value = (e.target as HTMLInputElement).value;
    if (error.value) error.value = null;
  }

  /**
   * Handle Enter key in password input.
   */
  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNextCredential();
    }
  }

  // Get current credential for re-enter step
  const currentCredential =
    step.value === 're-enter'
      ? legacyCredentials.value[currentIndex.value]
      : null;

  const total = legacyCredentials.value.length;
  const isLast = currentIndex.value + 1 >= total;

  // Explain step
  if (step.value === 'explain') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={iconStyle}>&#128274;</div>
          <h2 style={titleStyle}>{msg('migrationRequired')}</h2>
          <p style={descriptionStyle}>
            {msg('migrationExplain', [String(credentialCount)])}
          </p>

          {error.value && <div style={errorStyle}>{error.value}</div>}

          <div style={warningStyle}>
            <strong>{msg('migrationActionRequired')}</strong> {msg('migrationDescription')}
          </div>

          <button
            style={buttonPrimaryStyle}
            onClick={handleStartMigration}
            disabled={isLoading.value}
          >
            {isLoading.value ? msg('migrationLoading') : msg('migrationStartButton')}
          </button>

          <button style={buttonDangerStyle} onClick={handleSkipAll}>
            {msg('migrationSkipAll')}
          </button>
        </div>
      </div>
    );
  }

  // Re-enter step
  if (step.value === 're-enter' && currentCredential) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={progressStyle}>
            {msg('migrationReenter')} ({currentIndex.value + 1}/{total})
          </div>

          <div style={credentialInfoStyle}>
            <div style={credentialUsernameStyle}>{currentCredential.username}</div>
            <div style={credentialUrlStyle}>{currentCredential.url}</div>
            {currentCredential.alias && (
              <div style={credentialAliasStyle}>{msg('migrationAlias')} {currentCredential.alias}</div>
            )}
          </div>

          {error.value && <div style={errorStyle}>{error.value}</div>}

          <div style={inputGroupStyle}>
            <label style={labelStyle}>{msg('migrationPassword')}</label>
            <input
              type="password"
              value={currentPassword.value}
              onInput={handlePasswordInput}
              onKeyDown={handleKeyDown}
              placeholder={msg('migrationPlaceholder')}
              style={inputStyle}
              disabled={isLoading.value}
              autoFocus
            />
          </div>

          <div style={buttonRowStyle}>
            <button
              style={{ ...buttonHalfStyle, background: '#f5f5f5', color: '#666', border: '1px solid #ddd' }}
              onClick={handleSkipCredential}
              disabled={isLoading.value}
            >
              {msg('migrationSkip')}
            </button>
            <button
              style={{
                ...buttonHalfStyle,
                background: isLast ? '#4caf50' : '#4285f4',
                color: 'white',
                border: 'none',
              }}
              onClick={handleNextCredential}
              disabled={isLoading.value || !currentPassword.value}
            >
              {isLoading.value ? msg('migrationSaving') : isLast ? msg('migrationFinish') : msg('migrationNext')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Complete step
  if (step.value === 'complete') {
    const migratedCount = migratedCredentials.value.length;

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={iconStyle}>&#10004;&#65039;</div>
          <h2 style={titleStyle}>{msg('migrationComplete')}</h2>

          <div style={successStyle}>
            {msg('migrationEncrypted')}
          </div>

          <div style={statsStyle}>
            {msg('migrationMigrated', [String(migratedCount)])}
            {skippedCount.value > 0 && msg('migrationSkipped', [String(skippedCount.value)])}
          </div>

          <button style={buttonSuccessStyle} onClick={onComplete}>
            {msg('migrationContinueVault')}
          </button>
        </div>
      </div>
    );
  }

  // Fallback (should not happen)
  return null;
}
