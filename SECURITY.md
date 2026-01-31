# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Browserlet, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers directly at: security@linagora.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a detailed response within 7 days.

## Security Measures

Browserlet implements the following security measures:

### API Key Storage
- API keys are encrypted using AES-GCM 256-bit
- Encryption key stored in `chrome.storage.session` (cleared on browser restart)
- Keys never stored in plaintext

### Script Execution
- Scripts only execute on URLs explicitly configured by user
- No automatic execution without user consent
- Session detection prevents unauthorized access

### Extension Permissions
- Minimal required permissions
- No background network requests without user action
- All data stored locally (no external servers)

## Known Limitations

- Password fields are masked as `[MASKED]` during recording but users should review scripts before sharing
- Cross-origin iframe recording limited by browser security policies
