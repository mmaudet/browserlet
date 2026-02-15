# Browserlet

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Version: v1.7](https://img.shields.io/badge/version-v1.7-green.svg)]()
[![Tests: 428](https://img.shields.io/badge/tests-428%20passing-brightgreen.svg)]()
[![Chrome](https://img.shields.io/badge/Chrome-MV3-yellow.svg)]()
[![Firefox](https://img.shields.io/badge/Firefox-MV3-orange.svg)]()

> Resilient web automation for legacy applications — AI at creation time, zero recurring cost.

## The Problem

Enterprise teams waste hours on repetitive tasks inside legacy web apps that expose no API. Traditional automation breaks on every UI change because it relies on fragile DOM selectors. Full-AI solutions work but burn tokens on every single execution, making them expensive and non-deterministic.

Browserlet takes a different approach: **use AI once to generate a semantic automation script, then execute it deterministically forever** — no tokens, no flakiness, no recurring cost.

## How It Works

```
 Record               Generate              Execute
┌──────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Click,   │    │ LLM converts to  │    │ Deterministic    │
│ type,    │───>│ BSL script with  │───>│ playback via     │
│ navigate │    │ semantic hints   │    │ cascade resolver │
└──────────┘    └──────────────────┘    └──────────────────┘
  Browser            One-time AI             Zero cost
  extension          (~600 tokens)           per execution
```

**AI is used only during script creation.** Execution is 100% deterministic through a 6-stage cascade resolver that targets elements by intent ("the login button") rather than fragile XPath (`#btn-submit-x7`).

## Quick Start

### Extension (Chrome / Firefox)

```bash
git clone https://github.com/mmaudet/browserlet.git
cd browserlet && npm install
npm run build              # or: npm run build:firefox
```

1. **Chrome:** `chrome://extensions/` → Developer mode → Load unpacked → select `.output/chrome-mv3`
2. **Firefox:** `about:debugging` → Load Temporary Add-on → select `.output/firefox-mv3/manifest.json`
3. Open the Browserlet side panel (click the {B} icon)
4. Configure your LLM provider in Settings (Claude API, Ollama, or OpenAI-compatible)
5. Hit Record, interact with your target app, stop — your BSL script is ready

### CLI (Headless / CI-CD)

```bash
cd packages/cli && npm run build
```

```bash
# Run a single script
browserlet run login.bsl --headed --vault

# Run a test suite
browserlet test ./scripts/ --workers 4 --bail --auto-repair

# Manage credentials
browserlet vault init
browserlet vault add erp-password
```

## Features

### Two Modes, One Language

Browserlet scripts (BSL) work identically in both environments:

| | Extension | CLI |
|---|---|---|
| **Engine** | In-browser content script | Playwright (headless or headed) |
| **Use case** | Record, edit, play interactively | CI/CD, batch testing, automation |
| **Commands** | Side panel UI | `browserlet run` / `browserlet test` |
| **Credentials** | Browser-encrypted vault | Local AES-GCM vault, `vault import-from-extension` |

### BSL — 10 Actions

BSL (Browserlet Scripting Language) scripts are YAML files with semantic selectors:

| Action | Description | Key parameters |
|--------|-------------|----------------|
| `click` | Click an element | `target` |
| `type` | Enter text in a field | `target`, `value` |
| `select` | Choose a dropdown option | `target`, `option` |
| `extract` | Extract text from an element | `target`, `output`, `transform` |
| `table_extract` | Extract a full HTML table | `target`, `output`, `headers` |
| `wait_for` | Wait for an element or condition | `target`, `timeout` |
| `navigate` | Go to a URL | `url` |
| `scroll` | Scroll to an element | `target` |
| `hover` | Hover over an element | `target` |
| `screenshot` | Capture page as PNG | `output` |

### Semantic Resolution — 13 Hint Types

Instead of brittle CSS selectors, BSL targets elements with semantic hints. The cascade resolver matches them through 6 stages:

| Stage | Strategy | Threshold |
|-------|----------|-----------|
| 1 | Deterministic hint matching | 0.85 |
| 2 | Enriched structural matching (DOM context) | 0.70 |
| 3 | `hint_suggester` micro-prompt (zero candidates) | LLM |
| 4 | `disambiguator` micro-prompt (multiple candidates) | LLM |
| 5 | `confidence_booster` micro-prompt (low confidence) | LLM |
| 6 | CSS fallback selector | — |

Stages 1-2 resolve ~80% of elements without any LLM call.

**13 hint types with weights:**

| Hint | Weight | Description |
|------|--------|-------------|
| `data_attribute` | 1.0 | Custom `data-*` attributes |
| `role` | 1.0 | ARIA role |
| `type` | 1.0 | Input type (`text`, `password`, ...) |
| `aria_label` | 0.9 | ARIA label |
| `name` | 0.9 | Form element name |
| `id` | 0.85 | Element ID (auto-generated IDs filtered) |
| `text_contains` | 0.8 | Visible text content |
| `placeholder_contains` | 0.7 | Placeholder text |
| `fieldset_context` | 0.7 | Fieldset legend (form section disambiguation) |
| `associated_label` | 0.7 | Explicit `for`/`aria-labelledby` association |
| `section_context` | 0.6 | Section heading context |
| `near_label` | 0.6 | Adjacent label text |
| `class_contains` | 0.5 | Semantic class names (CSS modules filtered) |

### Data Extraction & Transforms

Extract data from pages and pipe it through transforms:

```yaml
- action: extract
  target: { text_contains: "Total HT" }
  output: total
  transform: parse_currency

- action: type
  target: { role: textbox, aria_label: "Amount" }
  value: "{{extracted.total}}"
```

| Transform | Description | Example |
|-----------|-------------|---------|
| `trim` | Strip whitespace | `"  hello  "` → `"hello"` |
| `lowercase` | Lowercase text | `"Hello"` → `"hello"` |
| `uppercase` | Uppercase text | `"Hello"` → `"HELLO"` |
| `parse_number` | Parse locale-aware number | `"1 234,56"` → `1234.56` |
| `parse_currency` | Extract currency amount | `"€1.234,56"` → `1234.56` |
| `parse_date` | Parse locale-aware date | `"15/02/2026"` → `"2026-02-15"` |
| `extract_number` | Extract first number from text | `"Total: $1,234.56"` → `1234.56` |

Variables are referenced with `{{extracted.<output_name>}}` syntax.

### Credential Vault

Credentials are encrypted with AES-256-GCM and a master password derived via PBKDF2 (600k iterations, OWASP 2025 recommendation).

```yaml
- action: type
  target: { type: password }
  value: "{{credential:erp-password}}"
```

Credentials are decrypted only at execution time and never appear in logs.

**CLI vault commands:**

```bash
browserlet vault init                    # Set master password
browserlet vault add my-alias            # Add credential (prompted for value)
browserlet vault list                    # List aliases (no plaintext)
browserlet vault import-from-extension   # Import from browser vault
```

### Batch Testing & Auto-Repair

Run entire script directories as test suites:

```bash
browserlet test ./scripts/ \
  --workers 4 \            # Parallel execution (fresh browser per script)
  --bail \                 # Stop on first failure
  --auto-repair \          # LLM-guided hint repair on resolution failure
  --interactive            # Approve repairs before applying
```

Auto-repair uses a `hint_repairer` micro-prompt to suggest alternative hints when resolution fails, then retries the step with the repaired selector.

### Screenshots & Visual Debugging

- `screenshot` BSL action captures PNG snapshots at any step
- Auto-capture on step failure (page state + failure reason)
- Screenshot gallery in the extension with failure indicators
- Batch export as ZIP with `manifest.json` metadata

### LLM Providers

| Provider | Use case | Config |
|----------|----------|--------|
| **Claude API** | Best BSL generation quality | API key (AES-GCM encrypted) |
| **Ollama** | Local / air-gapped, no cloud dependency | Endpoint URL |
| **OpenAI-compatible** | Any compatible provider | Endpoint URL + API key |

All micro-prompts are **<600 tokens** (down from 5,000 token monolithic prompts in v1.4), reducing LLM cost by ~88%.

## BSL Example

A complete script that logs in, extracts data, and captures a screenshot:

```yaml
name: Extract invoice total
version: "1.0"
steps:
  - action: navigate
    url: https://erp.example.com/invoices

  - action: type
    target:
      role: textbox
      aria_label: Email
    value: admin@example.com

  - action: type
    target:
      type: password
      associated_label: Password
    value: "{{credential:erp-password}}"

  - action: click
    target:
      role: button
      text_contains: Sign in

  - action: wait_for
    target:
      text_contains: Dashboard
    timeout: 10000

  - action: extract
    target:
      text_contains: "Total HT"
      section_context: Invoice Summary
    output: invoice_total
    transform: parse_currency

  - action: screenshot
    output: dashboard-state

  - action: type
    target:
      role: textbox
      aria_label: Reference
    value: "{{extracted.invoice_total}}"
```

## Architecture

```
browserlet/                          # npm workspaces monorepo
├── packages/
│   ├── core/                        # @browserlet/core — shared library
│   │   └── src/
│   │       ├── types/               #   BSL types, hints, weights
│   │       ├── parser/              #   YAML step parser, validator
│   │       ├── prompts/             #   Micro-prompt builder & validator
│   │       └── substitution/        #   Variable & credential substitution
│   └── cli/                         # @browserlet/cli — headless runner
│       └── src/
│           ├── commands/            #   run, test, vault (Commander.js)
│           ├── vault/               #   AES-GCM encryption, LevelDB storage
│           ├── credentials/         #   Resolver, log sanitizer
│           ├── llm/                 #   Micro-prompt router
│           └── repair/              #   AI auto-repair engine
├── entrypoints/                     # Browser extension (WXT)
│   ├── background/                  #   Service worker
│   ├── content/                     #   Recording, playback, cascade resolver
│   └── sidepanel/                   #   Preact UI, Monaco editor
├── utils/                           # Extension utilities
│   ├── vault/                       #   Credential encryption
│   ├── export/                      #   JSON/CSV/ZIP export
│   └── llm/                         #   Claude, Ollama, OpenAI providers
└── public/_locales/                 # i18n (EN, FR)
```

**Tech stack:** TypeScript, WXT, Preact, Monaco Editor, Playwright, Commander.js, esbuild, Vitest

## Development

```bash
npm install                 # Install all workspaces
npm run dev                 # Extension dev mode (Chrome, HMR)
npm run dev:firefox         # Extension dev mode (Firefox)
npm run build               # Production build
npm test                    # Run all tests (428 tests, 24 suites)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and [SECURITY.md](SECURITY.md) for security policy.

## Roadmap

### Shipped

| Version | Milestone | Key features |
|---------|-----------|--------------|
| v1.0 | Core Platform | Recording, playback, side panel, LLM generation, triggers |
| v1.1 | Preact & Auth | Preact migration, password detection, encrypted storage |
| v1.2 | Master Password | PBKDF2 key derivation, persistent credentials, migration |
| v1.3 | UX Refactoring | Streamlined layout, per-script history, bottom action bar |
| v1.4 | Data & Screenshots | `extract`/`table_extract` actions, `screenshot` action, ZIP export |
| v1.5 | Resilience | Cascade resolver (6 stages), 13 hint types, Firefox MV3, micro-prompts |
| v1.6 | CLI & Monorepo | `browserlet run`, @browserlet/core, Playwright runner, CLI vault |
| v1.7 | Testing & Repair | `browserlet test`, batch workers, AI auto-repair, vault CLI |

### What's Next (v1.8+)

- Script version control
- Scheduled execution (cron-like)
- JUnit XML / HTML reports for CI/CD
- `--last-failed` flag for re-running failures
- Screenshot diff on repair

## License

[AGPL-3.0](LICENSE) — Michel-Marie MAUDET (mmaudet@linagora.com)
