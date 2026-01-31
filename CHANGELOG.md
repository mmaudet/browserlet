# Changelog

All notable changes to Browserlet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- VanJS for reactive UI components
- TypeScript strict mode
- 12,603 lines of code

[1.0.0]: https://github.com/mmaudet/browserlet/releases/tag/v1.0
