import { useSignal } from '@preact/signals';
import { validateMasterPassword, cacheDerivedKey } from '../../../utils/crypto/masterPassword';

/**
 * Props for VaultUnlock component.
 */
interface VaultUnlockProps {
  onUnlockSuccess: () => void;
}

// Styles
const containerStyle: Record<string, string | number> = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  minHeight: '100%',
};

const formStyle: Record<string, string | number> = {
  width: '100%',
  maxWidth: '360px',
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
  margin: '0 0 8px 0',
  fontSize: '20px',
  fontWeight: 600,
  color: '#333',
  textAlign: 'center',
};

const descriptionStyle: Record<string, string | number> = {
  margin: '0 0 24px 0',
  fontSize: '14px',
  color: '#666',
  textAlign: 'center',
};

const inputGroupStyle: Record<string, string | number> = {
  marginBottom: '16px',
};

const inputStyle: Record<string, string | number> = {
  width: '100%',
  padding: '12px',
  border: '1px solid #ddd',
  borderRadius: '8px',
  fontSize: '14px',
  boxSizing: 'border-box',
};

const inputErrorStyle: Record<string, string | number> = {
  ...inputStyle,
  borderColor: '#d32f2f',
  animation: 'shake 0.3s ease-in-out',
};

const errorStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#ffebee',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#c62828',
  marginBottom: '16px',
};

const warningStyle: Record<string, string | number> = {
  padding: '12px',
  background: '#fff3e0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#e65100',
  marginBottom: '16px',
};

const buttonStyle: Record<string, string | number> = {
  width: '100%',
  padding: '14px',
  background: '#4285f4',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 500,
  cursor: 'pointer',
};

const buttonDisabledStyle: Record<string, string | number> = {
  ...buttonStyle,
  background: '#ccc',
  cursor: 'not-allowed',
};

/**
 * Vault unlock component for returning users.
 *
 * Validates the master password against stored validation data
 * and caches the derived key in session storage on success.
 */
export function VaultUnlock({ onUnlockSuccess }: VaultUnlockProps) {
  const password = useSignal('');
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);
  const attempts = useSignal(0);
  const showShake = useSignal(false);

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    if (!password.value) {
      error.value = 'Please enter your master password.';
      return;
    }

    // Clear error and set loading
    error.value = null;
    isLoading.value = true;

    try {
      const result = await validateMasterPassword(password.value);

      if (result.valid && result.key) {
        // Cache the derived key
        await cacheDerivedKey(result.key);
        // Notify parent of successful unlock
        onUnlockSuccess();
      } else {
        // Increment failed attempts
        attempts.value = attempts.value + 1;
        error.value = 'Incorrect master password.';

        // Trigger shake animation
        showShake.value = true;
        setTimeout(() => { showShake.value = false; }, 300);

        // Clear password for re-entry
        password.value = '';
      }
    } catch (err) {
      error.value = err instanceof Error
        ? `Unlock failed: ${err.message}`
        : 'An unexpected error occurred.';
    } finally {
      isLoading.value = false;
    }
  }

  function handleInput(e: Event): void {
    password.value = (e.target as HTMLInputElement).value;
    // Clear error when user starts typing
    if (error.value) error.value = null;
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  }

  const isDisabled = isLoading.value || !password.value;

  return (
    <div style={containerStyle}>
      <form style={formStyle} onSubmit={handleSubmit}>
        <div style={iconStyle}>&#128274;</div>
        <h2 style={titleStyle}>Unlock Vault</h2>
        <p style={descriptionStyle}>
          Enter your master password to access credentials.
        </p>

        {/* Multiple attempts warning */}
        {attempts.value >= 3 && (
          <div style={warningStyle}>
            Multiple failed attempts. Make sure you have the correct password.
          </div>
        )}

        {/* Error display */}
        {error.value && (
          <div style={errorStyle}>{error.value}</div>
        )}

        {/* Password input */}
        <div style={inputGroupStyle}>
          <input
            type="password"
            value={password.value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Master password"
            style={showShake.value ? inputErrorStyle : inputStyle}
            disabled={isLoading.value}
            autoFocus
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          style={isDisabled ? buttonDisabledStyle : buttonStyle}
          disabled={isDisabled}
        >
          {isLoading.value ? 'Unlocking...' : 'Unlock'}
        </button>
      </form>

      {/* CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
