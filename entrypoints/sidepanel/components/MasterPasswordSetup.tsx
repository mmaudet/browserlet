import { useSignal } from '@preact/signals';
import {
  getOrCreateSalt,
  deriveKeyFromPassword,
  createValidationData,
  cacheDerivedKey,
} from '../../../utils/crypto/masterPassword';

/**
 * Props for MasterPasswordSetup component.
 */
interface MasterPasswordSetupProps {
  onSetupComplete: () => void;
}

/**
 * Password strength levels.
 */
type PasswordStrength = 'weak' | 'fair' | 'strong' | null;

/**
 * Calculate password strength using simple heuristics.
 * - weak: < 12 chars
 * - fair: >= 12 chars
 * - strong: >= 12 chars AND has mixed case AND has number
 */
function calculateStrength(password: string): PasswordStrength {
  if (!password) return null;
  if (password.length < 12) return 'weak';

  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (hasMixedCase && hasNumber) return 'strong';
  return 'fair';
}

/**
 * Get color for password strength indicator.
 */
function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak': return '#d32f2f';
    case 'fair': return '#f9a825';
    case 'strong': return '#4caf50';
    default: return '#ddd';
  }
}

/**
 * Get label for password strength indicator.
 */
function getStrengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak': return 'Weak (min 12 characters)';
    case 'fair': return 'Fair';
    case 'strong': return 'Strong';
    default: return '';
  }
}

/**
 * Get width percentage for strength bar.
 */
function getStrengthWidth(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak': return '33%';
    case 'fair': return '66%';
    case 'strong': return '100%';
    default: return '0%';
  }
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
  maxWidth: '400px',
  background: 'white',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
};

const titleStyle: Record<string, string | number> = {
  margin: '0 0 8px 0',
  fontSize: '20px',
  fontWeight: 600,
  color: '#333',
  textAlign: 'center',
};

const descriptionStyle: Record<string, string | number> = {
  margin: '0 0 20px 0',
  fontSize: '14px',
  color: '#666',
  textAlign: 'center',
  lineHeight: 1.5,
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

const inputErrorStyle: Record<string, string | number> = {
  ...inputStyle,
  borderColor: '#d32f2f',
};

const strengthContainerStyle: Record<string, string | number> = {
  marginTop: '8px',
};

const strengthBarBgStyle: Record<string, string | number> = {
  height: '4px',
  background: '#eee',
  borderRadius: '2px',
  overflow: 'hidden',
};

const strengthLabelStyle: Record<string, string | number> = {
  fontSize: '12px',
  marginTop: '4px',
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
 * Master password setup component for first-time users.
 *
 * Guides user through creating a master password:
 * - Shows password strength indicator
 * - Requires confirmation
 * - Derives encryption key and stores validation data
 */
export function MasterPasswordSetup({ onSetupComplete }: MasterPasswordSetupProps) {
  const password = useSignal('');
  const confirmPassword = useSignal('');
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);

  // Calculate strength from current password
  const strength = calculateStrength(password.value);

  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    // Clear previous errors
    error.value = null;

    // Validate password length (NIST minimum)
    if (password.value.length < 12) {
      error.value = 'Password must be at least 12 characters long.';
      return;
    }

    // Validate confirmation matches
    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match.';
      return;
    }

    // Set loading state
    isLoading.value = true;

    try {
      // Generate or get salt
      const salt = await getOrCreateSalt();

      // Derive encryption key from password
      const derivedKey = await deriveKeyFromPassword(password.value, salt);

      // Create validation data for future password verification
      await createValidationData(derivedKey);

      // Cache derived key in session storage
      await cacheDerivedKey(derivedKey);

      // Notify parent that setup is complete
      onSetupComplete();
    } catch (err) {
      error.value = err instanceof Error
        ? `Setup failed: ${err.message}`
        : 'An unexpected error occurred during setup.';
      isLoading.value = false;
    }
  }

  function handlePasswordInput(e: Event): void {
    password.value = (e.target as HTMLInputElement).value;
    // Clear error when user starts typing again
    if (error.value) error.value = null;
  }

  function handleConfirmInput(e: Event): void {
    confirmPassword.value = (e.target as HTMLInputElement).value;
    if (error.value) error.value = null;
  }

  const isDisabled = isLoading.value || password.value.length < 12 || !confirmPassword.value;

  return (
    <div style={containerStyle}>
      <form style={formStyle} onSubmit={handleSubmit}>
        <h2 style={titleStyle}>Create Master Password</h2>
        <p style={descriptionStyle}>
          This password will encrypt your credentials. It cannot be recovered if forgotten.
        </p>

        {error.value && (
          <div style={errorStyle}>{error.value}</div>
        )}

        {/* Password input */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Master Password</label>
          <input
            type="password"
            value={password.value}
            onInput={handlePasswordInput}
            placeholder="Enter master password"
            style={error.value && password.value.length < 12 ? inputErrorStyle : inputStyle}
            disabled={isLoading.value}
            autoFocus
          />

          {/* Password strength indicator */}
          {password.value && (
            <div style={strengthContainerStyle}>
              <div style={strengthBarBgStyle}>
                <div
                  style={{
                    height: '100%',
                    width: getStrengthWidth(strength),
                    background: getStrengthColor(strength),
                    transition: 'width 0.2s, background 0.2s',
                    borderRadius: '2px',
                  }}
                />
              </div>
              <div style={{ ...strengthLabelStyle, color: getStrengthColor(strength) }}>
                {getStrengthLabel(strength)}
              </div>
            </div>
          )}
        </div>

        {/* Confirm password input */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword.value}
            onInput={handleConfirmInput}
            placeholder="Confirm master password"
            style={error.value && password.value !== confirmPassword.value ? inputErrorStyle : inputStyle}
            disabled={isLoading.value}
          />
        </div>

        {/* Warning about password recovery */}
        <div style={warningStyle}>
          <strong>Important:</strong> If you forget this password, you will lose access to all stored credentials.
          There is no way to recover it.
        </div>

        {/* Submit button */}
        <button
          type="submit"
          style={isDisabled ? buttonDisabledStyle : buttonStyle}
          disabled={isDisabled}
        >
          {isLoading.value ? 'Creating...' : 'Create Master Password'}
        </button>
      </form>
    </div>
  );
}
