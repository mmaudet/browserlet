# Browserlet Privacy Policy

Last updated: February 2026

## Data Collection

Browserlet does **not** collect, transmit, or store any personal data on external servers.

All data (BSL scripts, configuration, credentials) is stored locally in your browser using Chrome's storage API. Nothing leaves your machine unless you explicitly configure an external AI provider.

## Permissions Explained

| Permission | Purpose |
|-----------|---------|
| `activeTab` / `scripting` / `tabs` | Required to record and replay browser actions on the active page |
| `storage` / `unlimitedStorage` | Stores your BSL scripts, configuration, and encrypted credentials locally |
| `cookies` | Used for session persistence between automation runs |
| `downloads` | Enables exporting data (CSV, screenshots, BSL scripts) |
| `<all_urls>` (host) | Required because automation can target any website |
| `alarms` / `idle` | Enables scheduled and periodic script execution |
| `notifications` | Alerts you when monitoring detects changes or a script completes |
| `clipboardWrite` | Copies extracted data to clipboard |
| `contextMenus` | Adds "Record with Browserlet" to the right-click menu |
| `sidePanel` | Opens the Browserlet UI as a side panel in Chrome |

## AI Provider Communication

When generating or repairing BSL scripts, Browserlet communicates with your configured AI provider. Supported providers:

- **Anthropic Claude** (cloud) -- API key required
- **Ollama** (local) -- runs entirely on your machine
- **OpenAI-compatible APIs** -- any self-hosted or third-party provider

Only the relevant DOM context (element attributes, ARIA roles, text content) is sent to the AI provider. **Credentials, passwords, and personal data are never included in AI requests.**

You choose your AI provider. You can use a fully local provider (Ollama) for complete data sovereignty.

## Credential Vault

Credentials are encrypted locally using the Web Crypto API (AES-256-GCM). They are decrypted only at runtime and injected directly into form fields. They are never logged, never sent to any external service, and never included in AI prompts.

## Open Source

Browserlet is open source under the AGPL-3.0 license. You can audit the entire codebase:

https://github.com/nicmusic/browserlet

## Contact

Michel-Marie Maudet
LINAGORA -- https://www.linagora.com
