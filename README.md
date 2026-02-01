# Browserlet

**Resilient web automation for legacy applications — no recurring AI costs**

Browserlet is a Chrome extension that automates interactions with legacy web applications (without APIs) in a deterministic, resilient, and maintainable way. Unlike full-AI solutions that consume tokens on every execution, Browserlet uses AI only during script creation to generate automation scripts in a semantic meta-language (BSL). Execution is then 100% deterministic, fast, and cost-free.

## Key Features

### Recording & Script Generation
- **Semantic Recording** — Capture clicks, inputs, and navigation with 10 semantic hint types (role, aria-label, text, data-attribute, etc.) instead of fragile XPath
- **LLM-Powered Generation** — Generate BSL scripts via Claude API or Ollama (local models)
- **Visual Feedback** — Real-time highlight overlay during recording
- **Cross-Page Navigation** — Scripts persist state across page loads and SPA navigation

### Playback & Execution
- **Deterministic Playback** — Execute BSL scripts with a weighted semantic resolver (0.7 confidence threshold)
- **8 BSL Actions** — click, type, select, extract, wait_for, navigate, scroll, hover
- **Humanization Layer** — Gaussian-distributed delays to avoid bot detection
- **Session Detection** — Automatic pause for manual authentication when logged out

### Credential Management
- **Encrypted Vault** — Master password protection with PBKDF2 key derivation
- **Credential Substitution** — Use `{{vault:alias}}` syntax to inject credentials during playback
- **Auto-Capture** — Capture passwords during recording with user approval
- **AES-256-GCM Encryption** — Industry-standard security for all stored secrets

### Contextual Triggers
- **Smart Suggestions** — Auto-suggest scripts based on URL patterns and element presence
- **Auto-Execute Mode** — Run scripts automatically with user notification
- **Per-Site Control** — Enable/disable triggers per website
- **Cooldown System** — Prevent trigger spam with configurable delays

### Professional UI
- **Side Panel Interface** — Full-featured UI in Chrome's side panel
- **Monaco Editor** — YAML syntax highlighting and validation
- **Script Management** — Create, edit, rename, delete, import/export
- **Execution History** — Per-script history with status, duration, and errors
- **Internationalization** — French and English support

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/mmaudet/browserlet.git
cd browserlet

# Install dependencies
npm install

# Build for development (with HMR)
npm run dev

# Build for production
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory

## Usage

### Recording a Script

1. Open the Side Panel (click the Browserlet icon)
2. Click the Record button (red circle) in the bottom bar
3. Click "Start Recording"
4. Perform actions on the target website
5. Click "Stop Recording"
6. The script is generated automatically using your configured LLM

### Running a Script

1. Open the Side Panel
2. Select a script from the list
3. Click the Run button (▶)
4. Watch the execution progress
5. View extracted data when complete

### Configuring Triggers

1. Click the lightning icon (⚡) next to a script
2. Add a URL pattern (e.g., `*example.com*`)
3. Choose mode: "Suggest" (show in panel) or "Auto-execute"
4. Save the trigger

### Managing Credentials

1. Click the lock icon in the bottom bar to open Credential Manager
2. Set up your master password (first time only)
3. Add credentials with aliases (e.g., "work-email")
4. Use `{{vault:work-email}}` in scripts to inject credentials

## BSL (Browserlet Scripting Language)

Scripts are written in YAML with semantic selectors:

```yaml
name: Login to Dashboard
version: "1.0"
steps:
  - action: type
    target:
      role: textbox
      aria_label: Email
    value: user@example.com

  - action: type
    target:
      role: textbox
      type: password
    value: "{{vault:my-password}}"

  - action: click
    target:
      role: button
      text_contains: Sign in

  - action: wait_for
    target:
      text_contains: Dashboard
```

### Supported Actions

| Action | Description | Key Parameters |
|--------|-------------|----------------|
| `click` | Click on an element | `target` |
| `type` | Enter text in a field | `target`, `value` |
| `select` | Choose option in dropdown | `target`, `option` |
| `extract` | Extract data from element | `target`, `output` |
| `wait_for` | Wait for element/condition | `target`, `timeout` |
| `navigate` | Go to URL | `url` |
| `scroll` | Scroll to element | `target` |
| `hover` | Hover over element | `target` |

### Semantic Hints

| Hint | Priority | Description |
|------|----------|-------------|
| `data_attribute` | 1.0 | Custom data-* attributes |
| `role` | 1.0 | ARIA role |
| `type` | 1.0 | Input type |
| `aria_label` | 0.9 | ARIA label |
| `name` | 0.9 | Form element name |
| `id` | 0.85 | Element ID (filtered for stability) |
| `text_contains` | 0.8 | Text content |
| `placeholder_contains` | 0.7 | Placeholder text |
| `near_label` | 0.6 | Adjacent label |
| `class_contains` | 0.5 | Semantic class names |

### Credential Substitution

Use the `{{vault:alias}}` syntax to inject credentials from the vault:

```yaml
steps:
  - action: type
    target:
      type: password
    value: "{{vault:erp-password}}"
```

Credentials are decrypted only at execution time and never logged.

## Configuration

### LLM Providers

Open Settings (gear icon) in the Side Panel to configure:

**Claude API:**
- Enter your Anthropic API key
- Keys are encrypted with AES-GCM 256-bit

**Ollama (Local):**
- Install [Ollama](https://ollama.ai)
- Run a model: `ollama run llama3`
- Configure the endpoint in Settings

**OpenAI-Compatible:**
- Enter API endpoint URL
- Enter API key
- Works with any OpenAI-compatible provider

### Master Password

The master password encrypts all stored credentials:
- Set on first use of credential manager
- Never stored — only the derived key is used
- Session-based unlock with configurable auto-lock

## Development

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Type check (via WXT)
npm run dev  # Runs type checking automatically
```

### Tech Stack

- **Framework:** [WXT](https://wxt.dev) (Chrome Extension framework)
- **UI:** [Preact](https://preactjs.com) + [Preact Signals](https://preactjs.com/guide/v10/signals/)
- **Icons:** [Lucide](https://lucide.dev)
- **Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) (YAML syntax)
- **Build:** Vite
- **Language:** TypeScript
- **Tests:** Vitest

### Project Structure

```
browserlet/
├── entrypoints/
│   ├── background/       # Service worker (message routing, storage)
│   ├── content/          # Content scripts (recording, playback, triggers)
│   └── sidepanel/        # Side Panel UI (Preact components)
├── utils/
│   ├── storage/          # Chrome storage utilities
│   ├── playback/         # Playback engine (resolver, executor)
│   ├── recording/        # Recording system (hints, capture)
│   ├── llm/              # LLM providers (Claude, Ollama)
│   ├── triggers/         # Trigger system
│   └── vault/            # Credential encryption
└── public/
    └── _locales/         # i18n messages (en, fr)
```

## Roadmap

### Completed

| Version | Features | Status |
|---------|----------|--------|
| v1.0 | Recording, Playback, Side Panel, LLM, Triggers | ✅ Shipped |
| v1.1 | Preact migration, Password infrastructure | ✅ Shipped |
| v1.2 | Master password, Credential migration | ✅ Shipped |
| v1.3 | UX refactoring, Bottom bar, History | ✅ Shipped |

### Planned (v1.4)

- **Data Extraction & Export** — Extract structured data, export to JSON/CSV
- **Self-Healing Selectors** — LLM-assisted automatic selector repair
- **Screenshots & Visual Debugging** — Capture page state for debugging

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policy and reporting vulnerabilities.

## License

[AGPL-3.0](LICENSE) — Copyleft, no vendor lock-in.

## Acknowledgments

- Built by [LINAGORA](https://linagora.com) for automating legacy enterprise applications
- Semantic resolver validated on real ERPs (OBM, etc.)
