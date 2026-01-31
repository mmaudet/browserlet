# Browserlet

**Resilient web automation for legacy applications — no recurring AI costs**

Browserlet is a Chrome extension that automates interactions with legacy web applications (without APIs) in a deterministic, resilient, and maintainable way. Unlike full-AI solutions that consume tokens on every execution, Browserlet uses AI only during script creation to generate automation scripts in a semantic meta-language (BSL). Execution is then 100% deterministic, fast, and cost-free.

## Features

- **Semantic Recording** — Capture clicks, inputs, and navigation with 10 semantic hint types (role, aria-label, text, data-attribute, etc.) instead of fragile XPath
- **Deterministic Playback** — Execute BSL scripts with a weighted semantic resolver (0.7 confidence threshold)
- **LLM Integration** — Generate scripts via Claude API or Ollama (local models) with encrypted API key storage
- **Contextual Triggers** — Auto-suggest or auto-execute scripts based on URL patterns and element presence
- **Professional UI** — Side Panel with Monaco Editor (YAML), script management, i18n (FR/EN)
- **Cross-page Navigation** — Scripts persist state across page loads

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
2. Click "Record" tab
3. Click "Start Recording"
4. Perform actions on the target website
5. Click "Stop Recording"
6. The script is generated and saved automatically

### Running a Script

1. Open the Side Panel
2. Select a script from the list
3. Click the Run button (▶)
4. Watch the execution progress

### Configuring Triggers

1. Click the ⚡ icon next to a script
2. Add a URL pattern (e.g., `*example.com*`)
3. Choose mode: "Suggest" (show in panel) or "Auto-execute"
4. Save the trigger

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
    value: "{{password}}"

  - action: click
    target:
      role: button
      text_contains: Sign in

  - action: wait_for
    target:
      text_contains: Dashboard
```

### Supported Actions

| Action | Description |
|--------|-------------|
| `click` | Click on an element |
| `type` | Enter text in a field |
| `select` | Choose option in dropdown |
| `extract` | Extract data from element |
| `wait_for` | Wait for element/condition |
| `navigate` | Go to URL |
| `scroll` | Scroll to element |
| `hover` | Hover over element |

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

## Configuration

### LLM Providers

Open Settings (⚙) in the Side Panel to configure:

**Claude API:**
- Enter your Anthropic API key
- Keys are encrypted with AES-GCM 256-bit

**Ollama (Local):**
- Install [Ollama](https://ollama.ai)
- Run a model: `ollama run llama3`
- Configure the endpoint in Settings

## Development

```bash
# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint
```

### Tech Stack

- **Framework:** [WXT](https://wxt.dev) (Chrome Extension framework)
- **UI:** [VanJS](https://vanjs.org) (lightweight reactive UI)
- **Editor:** Monaco Editor (YAML syntax)
- **Build:** Vite
- **Language:** TypeScript

### Project Structure

```
browserlet/
├── entrypoints/
│   ├── background/      # Service worker
│   ├── content/         # Content scripts
│   └── sidepanel/       # Side Panel UI
├── utils/
│   ├── storage/         # Chrome storage utilities
│   └── triggers/        # Trigger system types
└── public/
    └── _locales/        # i18n messages (en, fr)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[AGPL-3.0](LICENSE) — Copyleft, no vendor lock-in.

## Acknowledgments

- Built by [LINAGORA](https://linagora.com) for automating legacy enterprise applications
- Semantic resolver validated on real ERPs (OBM, etc.)
