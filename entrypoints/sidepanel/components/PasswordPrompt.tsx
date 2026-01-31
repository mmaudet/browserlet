import { signal } from '@preact/signals';
import type { DetectedPassword } from '../../../utils/passwords/types';

// Module-level signals for shared state across components
export const detectedPasswords = signal<DetectedPassword[]>([]);
export const showPasswordPrompt = signal(false);

// Saving state
const isSaving = signal(false);
const saveError = signal<string | null>(null);

/**
 * Extract hostname from URL for display.
 */
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Handle save passwords action.
 * Sends SAVE_PASSWORDS message to background service.
 */
async function handleSave(): Promise<void> {
  if (isSaving.value || detectedPasswords.value.length === 0) return;

  isSaving.value = true;
  saveError.value = null;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PASSWORDS',
      payload: detectedPasswords.value
    });

    if (response.success) {
      // Clear state and close modal
      detectedPasswords.value = [];
      showPasswordPrompt.value = false;
    } else {
      saveError.value = response.error || 'Failed to save passwords';
    }
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'Failed to save passwords';
  } finally {
    isSaving.value = false;
  }
}

/**
 * Handle skip action.
 * Clears state and closes modal without saving.
 */
function handleSkip(): void {
  detectedPasswords.value = [];
  showPasswordPrompt.value = false;
  saveError.value = null;
}

/**
 * Modal overlay styles.
 */
const overlayStyle: Record<string, string | number> = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000
};

const modalStyle: Record<string, string | number> = {
  background: 'white',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '400px',
  width: '90%',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
};

const titleStyle: Record<string, string | number> = {
  margin: '0 0 8px 0',
  fontSize: '18px',
  fontWeight: 600,
  color: '#333'
};

const descriptionStyle: Record<string, string | number> = {
  margin: '0 0 16px 0',
  fontSize: '14px',
  color: '#666'
};

const listStyle: Record<string, string | number> = {
  margin: '0 0 20px 0',
  padding: 0,
  listStyle: 'none'
};

const listItemStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#f8f9fa',
  borderRadius: '8px',
  marginBottom: '8px'
};

const hostnameStyle: Record<string, string | number> = {
  fontWeight: 500,
  fontSize: '14px',
  color: '#333',
  marginBottom: '4px'
};

const usernameStyle: Record<string, string | number> = {
  fontSize: '13px',
  color: '#666'
};

const buttonContainerStyle: Record<string, string | number> = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'flex-end'
};

const primaryButtonStyle: Record<string, string | number> = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  background: '#4285f4',
  color: 'white'
};

const secondaryButtonStyle: Record<string, string | number> = {
  padding: '10px 20px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  background: 'white',
  color: '#333'
};

const disabledButtonStyle: Record<string, string | number> = {
  ...primaryButtonStyle,
  background: '#ccc',
  cursor: 'not-allowed'
};

const errorStyle: Record<string, string | number> = {
  padding: '10px 12px',
  background: '#f8d7da',
  border: '1px solid #f5c6cb',
  borderRadius: '6px',
  color: '#721c24',
  fontSize: '13px',
  marginBottom: '16px'
};

const lockIconStyle: Record<string, string | number> = {
  display: 'inline-block',
  marginRight: '8px',
  fontSize: '16px'
};

/**
 * Password save prompt modal component.
 * Appears at end of recording when passwords were detected.
 * Shows detected passwords (URL, username - NOT the password itself).
 */
export function PasswordPrompt() {
  // Don't render if not visible or no passwords
  if (!showPasswordPrompt.value || detectedPasswords.value.length === 0) {
    return null;
  }

  const passwords = detectedPasswords.value;
  const saving = isSaving.value;
  const error = saveError.value;

  return (
    <div style={overlayStyle} onClick={(e) => {
      // Close on backdrop click, but not if clicking modal content
      if (e.target === e.currentTarget) handleSkip();
    }}>
      <div style={modalStyle}>
        <h3 style={titleStyle}>
          <span style={lockIconStyle}>&#128274;</span>
          {chrome.i18n.getMessage('savePasswords') || 'Save Passwords?'}
        </h3>
        <p style={descriptionStyle}>
          {passwords.length === 1
            ? (chrome.i18n.getMessage('passwordDetectedSingular') || '1 password was detected during recording')
            : (chrome.i18n.getMessage('passwordDetectedPlural', [passwords.length.toString()]) || `${passwords.length} passwords were detected during recording`)
          }
        </p>

        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        <ul style={listStyle}>
          {passwords.map((pwd, index) => (
            <li key={index} style={listItemStyle}>
              <div style={hostnameStyle}>{getHostname(pwd.url)}</div>
              <div style={usernameStyle}>
                {pwd.username
                  ? (chrome.i18n.getMessage('usernameLabel') || 'Username:') + ' ' + pwd.username
                  : (chrome.i18n.getMessage('noUsernameDetected') || 'No username detected')
                }
              </div>
            </li>
          ))}
        </ul>

        <div style={buttonContainerStyle}>
          <button
            style={secondaryButtonStyle}
            onClick={handleSkip}
            disabled={saving}
          >
            {chrome.i18n.getMessage('skip') || 'Skip'}
          </button>
          <button
            style={saving ? disabledButtonStyle : primaryButtonStyle}
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? (chrome.i18n.getMessage('saving') || 'Saving...')
              : (chrome.i18n.getMessage('saveSecurely') || 'Save Securely')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
