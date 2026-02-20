# Browserlet

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Version: v1.9](https://img.shields.io/badge/version-v1.9-green.svg)]()
[![Tests: 524](https://img.shields.io/badge/tests-524%20passing-brightgreen.svg)]()
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

### The 6-Stage Cascade Resolver

| Stage | Name | Type | What it does |
|-------|------|------|-------------|
| 1 | **Deterministic hint matching** | Deterministic | Scores every candidate element against the recorded semantic hints (role, text, aria-label, etc.) using weighted scoring. Requires confidence >= 0.85 and at least one high-weight hint match. |
| 2 | **Enriched structural matching** | Deterministic | Takes competing candidates from Stage 1 and applies structural boosts from DOM context — fieldset legends, associated labels, landmark regions, section headings. Requires adjusted confidence >= 0.70. |
| 3 | **`hint_suggester` micro-prompt** | LLM | Triggered when no candidate was found at all. Sends the failed hints + a DOM excerpt to the LLM, which suggests alternative hints. Retries Stages 1-2 with the new hints. |
| 4 | **`disambiguator` micro-prompt** | LLM | Triggered when 2+ candidates score >= 0.70. Presents their attributes and structural context to the LLM, which picks the correct one. |
| 5 | **`confidence_booster` micro-prompt** | LLM | Triggered when a single candidate scores between 0.50 and 0.69. The LLM confirms or rejects the match; if confirmed, confidence is boosted by +0.20. |
| 6 | **CSS fallback** | Deterministic | Last resort — falls back to the `fallback_selector` (CSS selector captured during recording). |

Stages 1-2 resolve ~85% of elements with zero LLM cost. Stages 3-5 are only invoked when `--micro-prompts` is enabled. Stage 6 uses the raw CSS selector from the original recording session.

#### How micro-prompts flow in the extension

During playback (never during recording), the cascade resolver runs in the **content script**. When Stages 1-2 are insufficient and micro-prompts are enabled, the content script sends a `MICRO_PROMPT_REQUEST` message to the **background service worker**, which routes it through the `MicroPromptRouter` → `LLMService.generate()` → returns the typed result back to the content script. The resolver then uses the LLM output to retry with better hints (Stage 3), pick the right candidate (Stage 4), or confirm a borderline match (Stage 5).

The extension also maintains a **HintStabilityTracker** that records per-site hint success/failure rates in `chrome.storage.local`. Hints with > 90% success rate (and >= 5 attempts) receive a +0.20 confidence boost — a learning loop that improves resolution over time without any LLM call.

> **Micro-prompts do not modify the BSL script.** They only assist element resolution at runtime. To permanently update hints in the `.bsl` file, use the CLI's `--auto-repair` flag — see [Auto-Repair](#auto-repair) below.

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

### Semantic Resolution — 15 Hint Types

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

**15 hint types with weights:**

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
| `landmark_context` | 0.65 | ARIA landmark region (nav, main, search, etc.) |
| `section_context` | 0.6 | Section heading context |
| `near_label` | 0.6 | Adjacent label text |
| `position_context` | 0.55 | Positional disambiguation for repeated elements |
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
browserlet vault del my-alias            # Delete a credential
browserlet vault reset                   # Delete all credentials
browserlet vault lock                    # Clear unlock cache immediately
browserlet vault import-from-extension   # Import from browser vault
```

### Batch Testing

`browserlet test` discovers every `.bsl` file in a directory, runs each in an isolated browser, and reports pass/fail per script. The process exits with `0` (all pass), `1` (any failure), or `2` (any error) — designed for CI integration.

```bash
browserlet test ./scripts/
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--workers <n>` | Parallel workers (fresh browser each) | `1` |
| `--bail` | Stop on first failure | `false` |
| `--headed` | Visible browser | `false` |
| `--timeout <ms>` | Step timeout | `30000` |
| `--output-dir <dir>` | Failure screenshots directory | `browserlet-output` |
| `--vault` | Enable credential vault | `false` |
| `--auto-repair` | LLM-guided hint repair (confidence >= 0.70) | `false` |
| `--interactive` | Approve repair suggestions manually | `false` |
| `--micro-prompts` | Enable LLM for cascade resolver stages 3-5 | `false` |
| `--session-restore` | Restore session state (cookies + localStorage) from previous run | `false` |
| `--diagnostic-json` | Output structured failure diagnostics as JSON to stdout | `false` |

#### Examples

**Simple test suite** — run a directory of smoke tests sequentially:

```bash
browserlet test ./smoke-tests/
```

**CI with parallel workers, bail, and auto-repair:**

```bash
browserlet test ./regression/ --workers 4 --bail --auto-repair
```

#### Auto-Repair

When `--auto-repair` is enabled, a failed element resolution triggers the `hint_repairer` micro-prompt, which suggests an alternative hint. If the suggestion meets the confidence threshold (>= 0.70), the step is retried automatically with the repaired selector. Use `--interactive` to review each suggestion before it is applied.

### Session Persistence

Browserlet can capture and restore session state (cookies + localStorage) to skip re-authentication across runs.

**Extension:** Enable "Memoriser la connexion" per script — session is automatically captured after successful execution and restored on next run.

**CLI:** Use `--session-restore` to restore a previous session, or declare `session_persistence` in your BSL script for automatic capture/restore:

```yaml
name: Daily ERP check
session_persistence:
  enabled: true
  max_age: "72h"
  snapshot_id: "erp-prod"
steps:
  - action: navigate
    url: https://erp.example.com
  # First run: logs in, captures session
  # Subsequent runs: restores session, skips login
```

The vault unlock cache reduces master password prompts during batch execution — after the first unlock, subsequent commands within 15 minutes proceed without prompting.

### Failure Diagnostics

When a step fails, Browserlet provides structured diagnostics showing exactly what was searched and why it failed:

- **Per-candidate scoring matrix** — every hint checked against every candidate element, with individual scores
- **Confidence gap** — the threshold required vs. the best candidate's score
- **Fix suggestion** — deterministic recommendation (e.g., "try adding a `near_label` hint for disambiguation")
- **JSON output** — `--diagnostic-json` pipes structured reports for CI/CD automation

```bash
# Human-readable diagnostics (stderr)
browserlet run login.bsl

# Machine-readable JSON (stdout)
browserlet run login.bsl --diagnostic-json | jq '.suggestion'
```

### Repair Workflow

When a script breaks, fix it without re-recording:

**Extension:** The DiagnosticRepairPanel opens automatically when a step fails with diagnostic info. It shows:
- Failed and matched hints with color-coded badges
- "Get suggestions from page" — scans the live DOM for alternative hints (no LLM required)
- One-click apply and re-run to verify the fix
- Repair audit trail in `chrome.storage.local`

**CLI:** Use `--auto-repair` for LLM-guided automatic fix, or `--interactive` to review each suggestion.

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
│           ├── vault/               #   AES-GCM encryption, LevelDB storage, unlock cache
│           ├── session/             #   Session persistence (storageState snapshots)
│           ├── credentials/         #   Resolver, log sanitizer
│           ├── llm/                 #   Micro-prompt router
│           ├── diagnostic/          #   Failure diagnostics (suggester, formatter)
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
npm test                    # Run all tests (524 tests, 29 suites)
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
| v1.8 | Session Persistence | Session capture/restore (extension + CLI), vault unlock cache, BSL `session_persistence` |
| v1.9 | Reliability & Diagnostics | 15 hint types, layout-aware generation, failure diagnostics, repair workflow, >90% first-try success |

### What's Next (v2.0+)

- JUnit XML / HTML reports for CI/CD
- `--last-failed` flag for re-running failures
- Script version control with diff tracking
- Scheduled execution (cron-like)
- Screenshot diff on repair

## License

[AGPL-3.0](LICENSE) — Michel-Marie MAUDET (mmaudet@linagora.com)
