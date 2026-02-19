import { Circle, KeyRound, Settings } from 'lucide-preact';
import { navigateTo, ViewName } from '../router';

interface ActionBarProps {
  currentView: ViewName;
  isRecording?: boolean; // To show recording state (red pulse)
}

const styles: Record<string, Record<string, string | number>> = {
  bar: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTop: '1px solid #e5e5e5',
    background: 'white',
    padding: '6px 0 8px',
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  button: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    padding: '6px 8px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '10px',
  },
  activeButton: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '2px',
    padding: '6px 8px',
    border: 'none',
    background: 'rgba(66, 133, 244, 0.08)',
    cursor: 'pointer',
    fontSize: '10px',
    borderRadius: '8px',
  },
  iconWrapper: {
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export function ActionBar({ currentView, isRecording }: ActionBarProps) {
  const isRecordingActive = currentView === 'recording';
  const isCredentialsActive = currentView === 'credentials';
  const isSettingsActive = currentView === 'settings';

  return (
    <nav style={styles.bar}>
      {/* Record button */}
      <button
        style={isRecordingActive ? styles.activeButton : styles.button}
        onClick={() => navigateTo('recording')}
        title={chrome.i18n.getMessage('record') || 'Record'}
      >
        <span style={styles.iconWrapper}>
          <Circle
            size={22}
            strokeWidth={isRecordingActive ? 2 : 1.5}
            fill={isRecording ? '#ff3b30' : '#ff3b30'}
            color={isRecordingActive ? '#4285f4' : '#ff3b30'}
          />
        </span>
        <span style={{ color: isRecordingActive ? '#4285f4' : '#8e8e93', fontWeight: isRecordingActive ? 500 : 400 }}>
          {chrome.i18n.getMessage('record') || 'Record'}
        </span>
      </button>

      {/* Credentials button */}
      <button
        style={isCredentialsActive ? styles.activeButton : styles.button}
        onClick={() => navigateTo('credentials')}
        title={chrome.i18n.getMessage('manageCredentials') || 'Credentials'}
      >
        <span style={styles.iconWrapper}>
          <KeyRound
            size={22}
            strokeWidth={isCredentialsActive ? 2 : 1.5}
            color={isCredentialsActive ? '#4285f4' : '#8e8e93'}
          />
        </span>
        <span style={{ color: isCredentialsActive ? '#4285f4' : '#8e8e93', fontWeight: isCredentialsActive ? 500 : 400 }}>
          {chrome.i18n.getMessage('manageCredentials') || 'Credentials'}
        </span>
      </button>

      {/* Settings button */}
      <button
        style={isSettingsActive ? styles.activeButton : styles.button}
        onClick={() => navigateTo('settings')}
        title={chrome.i18n.getMessage('settings') || 'Settings'}
      >
        <span style={styles.iconWrapper}>
          <Settings
            size={22}
            strokeWidth={isSettingsActive ? 2 : 1.5}
            color={isSettingsActive ? '#4285f4' : '#8e8e93'}
          />
        </span>
        <span style={{ color: isSettingsActive ? '#4285f4' : '#8e8e93', fontWeight: isSettingsActive ? 500 : 400 }}>
          {chrome.i18n.getMessage('settings') || 'Settings'}
        </span>
      </button>
    </nav>
  );
}
