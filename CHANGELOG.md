# Changelog

All notable changes to Browserlet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-02-01

### Changed

- **Streamlined Side Panel Layout**
  - Removed header branding for more content space
  - Scripts list is now the primary view (no more tabs)
  - Bottom action bar with Record, Credentials, Settings buttons

### Added

- **Per-Script Execution History**
  - Clock icon on each script to view execution history
  - Modal showing date, status, steps completed, duration
  - Clear history functionality

### Removed

- Execution tab (scripts now run inline)
- Navigation tabs (replaced by bottom bar)

## [1.2.0] - 2026-02-01

### Added

- **Master Password System**
  - PBKDF2 key derivation for master password
  - Session-based vault unlock with auto-lock timer
  - Setup wizard for first-time users

- **Credential Migration**
  - Automatic detection of legacy per-key encrypted credentials
  - One-click migration to master password encryption
  - Seamless upgrade path for existing users

### Changed

- All credentials now encrypted under master password key
- Vault unlocks once per session instead of per-credential

## [1.1.0] - 2026-01-31

### Changed

- **Migrated from VanJS to Preact**
  - Better TypeScript support with JSX
  - Preact Signals for reactive state management
  - More maintainable component architecture

### Added

- **Password Infrastructure**
  - Encrypted password storage with AES-256-GCM
  - Password capture during recording with user approval
  - Vault state management (locked/unlocked)
  - Auto-lock timer with chrome.alarms

- **Credential Integration**
  - `{{vault:alias}}` syntax for credential substitution in scripts
  - CredentialManager component in Side Panel
  - Pre-flight credential validation before playback
  - Visual indicator for credential capture mode

- **OpenAI-Compatible Provider**
  - Support for any OpenAI-compatible API endpoint
  - Custom endpoint URL configuration

### Fixed

- Monaco Editor CSP compliance
- Improved dynamic ID detection in recording
- Better handling of pending inputs when recording stops

## [1.0.0] - 2026-01-31

### Added

- **Recording System**
  - Capture clicks, text inputs, form submissions
  - 10 semantic hint types (role, aria-label, text, data-attribute, etc.)
  - Visual feedback during recording (highlight overlay, indicator)
  - Navigation capture with History API patching for SPAs
  - iframe support via allFrames injection
  - Recording persistence across page refresh

- **Playback Engine**
  - Deterministic BSL script execution
  - Weighted semantic resolver (0.7 confidence threshold)
  - All 8 BSL actions: click, type, select, extract, wait_for, navigate, scroll, hover
  - Humanization layer with Gaussian-distributed delays
  - Cross-page navigation state persistence
  - Session detection with manual authentication prompt

- **Side Panel UI**
  - Monaco Editor with YAML syntax highlighting
  - Script list with search and filtering
  - Import/export as YAML files
  - Execution progress bar and step counter
  - Results export (JSON, CSV)
  - Context zone showing current tab URL
  - Internationalization (French, English)

- **LLM Integration**
  - Claude API support (Anthropic)
  - Ollama support (local models)
  - Encrypted API key storage (AES-GCM 256-bit)
  - Rate limiting with exponential backoff
  - Fallback generator when LLM unavailable

- **Contextual Triggers**
  - URL pattern matching
  - Element presence detection
  - Suggest mode (badge + panel suggestions)
  - Auto-execute mode (in-page notification with Stop/Disable buttons)
  - Per-site enable/disable overrides
  - Cooldown system for auto-execute

### Technical

- Chrome Extension Manifest V3
- WXT framework for extension scaffolding
- VanJS for reactive UI components (migrated to Preact in 1.1)
- TypeScript strict mode

[1.3.0]: https://github.com/mmaudet/browserlet/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/mmaudet/browserlet/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mmaudet/browserlet/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mmaudet/browserlet/releases/tag/v1.0.0
