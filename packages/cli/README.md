# @browserlet/cli

CLI runner for BSL (Browserlet Scripting Language) automation scripts.

Run browser automation scripts headlessly with Playwright, resolve elements using semantic hints, manage credentials with an encrypted vault, and leverage LLM-powered micro-prompts for resilient element resolution.

## Installation

```bash
npm install @browserlet/cli
```

Or from the monorepo:

```bash
npm run build --workspace=packages/cli
```

## Quick Start

Run a single script:

```bash
browserlet run script.bsl
```

Run all scripts in a directory:

```bash
browserlet test tests/
```

Run with a visible browser window:

```bash
browserlet run script.bsl --headed
```

---

## BSL Script Format

BSL scripts are YAML files with a `name` and a list of `steps`. Each step describes one browser action with semantic hints for element targeting.

### Structure

```yaml
name: Script description
steps:
  - action: <action_type>
    target:
      intent: "Human-readable description of the target element"
      hints:
        - type: <hint_type>
          value: <hint_value>
      fallback_selector: "CSS selector as last resort"
    value: "Action-specific value (URL, text, path)"
    output:
      variable: "extracted.variable_name"
      attribute: "href"
      transform: "trim"
    timeout: "10s"
```

### Action Types

BSL supports 10 action types:

| Action | Description | Requires `value` | Requires `target` |
|--------|-------------|:-----------------:|:------------------:|
| `navigate` | Navigate to a URL | Yes (URL) | No |
| `click` | Click an element | No | Yes |
| `type` | Type text into an input field (clears first) | Yes (text) | Yes |
| `select` | Select an option from a `<select>` dropdown | Yes (option value) | Yes |
| `extract` | Extract text content or an attribute from an element | No | Yes |
| `table_extract` | Extract structured data from a `<table>` element | No | Yes |
| `wait_for` | Wait for an element to become visible | No | Yes |
| `scroll` | Scroll an element into view | No | Yes |
| `hover` | Move the mouse pointer over an element | No | Yes |
| `screenshot` | Capture the current page to a PNG file | Optional (path) | No |

### Semantic Hint Types

Hints tell the resolver how to find elements without brittle CSS selectors. BSL supports 13 hint types:

| Hint Type | Description | Example Value |
|-----------|-------------|---------------|
| `role` | ARIA role of the element | `button`, `link`, `heading`, `textbox` |
| `text_contains` | Partial text content match | `"Submit"`, `"Login"` |
| `type` | Input type attribute | `email`, `password`, `tel` |
| `name` | Element name attribute | `username`, `custname` |
| `placeholder_contains` | Partial placeholder text match | `"Enter your email"` |
| `aria_label` | ARIA label attribute | `"Close dialog"` |
| `near_label` | Label text near the element | `"Email Address"` |
| `class_contains` | Partial CSS class match | `"btn-primary"` |
| `data_attribute` | Data attribute name and value | `{ name: "testid", value: "submit-btn" }` |
| `id` | Element ID attribute | `"login-form"` |
| `fieldset_context` | Parent fieldset legend text | `"Billing Address"` |
| `associated_label` | Associated `<label>` text | `"Password"` |
| `section_context` | Parent section/heading context | `"Account Settings"` |

### Complete Example

```yaml
name: Extract product price from catalog
steps:
  - action: navigate
    value: "https://books.toscrape.com/"

  - action: wait_for
    target:
      intent: "Page heading"
      hints:
        - type: role
          value: heading
      fallback_selector: "h1"
    timeout: "10s"

  - action: extract
    target:
      intent: "First product price"
      hints:
        - type: class_contains
          value: price_color
      fallback_selector: ".product_price .price_color"
    output:
      variable: "extracted.price"
```

---

## Command Reference

### `browserlet run <script>`

Execute a single BSL automation script.

```bash
browserlet run <script> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<script>` | Path to the `.bsl` script file |

**Options:**

| Flag | Default | Description |
|------|---------|-------------|
| `--headed` | `false` | Run browser in headed mode (visible window) |
| `--timeout <ms>` | `30000` | Global step timeout in milliseconds |
| `--output-dir <dir>` | `browserlet-output` | Directory for failure screenshots |
| `--vault` | `false` | Use encrypted credential vault for `{{credential:name}}` substitution |
| `--micro-prompts` | `false` | Enable LLM micro-prompts for cascade resolver stages 3-5 |
| `--auto-repair` | `false` | Automatically apply LLM-suggested repairs (confidence >= 0.70) |
| `--interactive` | `false` | Interactively approve each repair suggestion |

**Note:** `--auto-repair` and `--interactive` are mutually exclusive. Using both will exit with an error.

**Example:**

```bash
# Basic run
browserlet run login.bsl

# Run with visible browser and longer timeout
browserlet run login.bsl --headed --timeout 60000

# Run with credential vault and LLM micro-prompts
browserlet run login.bsl --vault --micro-prompts

# Run with auto-repair enabled
browserlet run login.bsl --micro-prompts --auto-repair
```

### `browserlet test <directory>`

Run all BSL scripts in a directory as a test suite.

```bash
browserlet test <directory> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<directory>` | Directory containing `.bsl` test scripts |

**Options:**

All options from `browserlet run`, plus:

| Flag | Default | Description |
|------|---------|-------------|
| `--bail` | `false` | Stop on first failure; remaining scripts are marked SKIP |
| `--workers <count>` | `1` | Number of parallel workers (each with its own browser) |

**Example:**

```bash
# Run all tests sequentially
browserlet test tests/

# Run with 4 parallel workers, stop on first failure
browserlet test tests/ --bail --workers 4

# Run tests with visible browsers and extended timeout
browserlet test tests/ --headed --timeout 60000
```

---

## Exit Codes

| Code | Meaning | Triggered By |
|------|---------|--------------|
| `0` | Success | All steps/scripts passed |
| `1` | Step or script failure | Assertion failed, element not found, action error |
| `2` | Infrastructure error | Timeout, browser crash, invalid arguments, missing config |
| `-1` | Skipped | Batch mode with `--bail` (remaining scripts after a failure) |

In batch mode (`browserlet test`), the aggregated exit code is: `2` if any script errored, `1` if any failed, `0` if all passed.

---

## Credential Vault

The credential vault securely stores and injects sensitive values (usernames, passwords, API keys) into BSL scripts at runtime.

### How It Works

1. Initialize the vault (one-time setup):
   ```bash
   browserlet vault init
   ```
   This creates an encrypted vault file using AES-256-GCM encryption with a master password you choose.

2. Add credentials with aliases:
   ```bash
   browserlet vault add --alias username --value "myuser"
   browserlet vault add --alias password --value "s3cretP@ss"
   ```

3. Reference credentials in BSL scripts using `{{credential:alias}}`:
   ```yaml
   steps:
     - action: type
       target:
         intent: "Username field"
         hints:
           - type: name
             value: username
       value: "{{credential:username}}"
   ```

4. Run with the `--vault` flag:
   ```bash
   browserlet run login.bsl --vault
   ```
   The CLI prompts for your master password to unlock the vault. Credential values are decrypted in memory and substituted into step values at runtime.

### Security

- Vault is encrypted at rest with AES-256-GCM
- Master password is verified before decryption
- Credential values are **never printed** in terminal output (redacted automatically)
- Vault location: platform-dependent directory via `env-paths` (e.g., `~/.config/browserlet/` on Linux)

### Common Errors

- **"Vault not found"** -- Vault has not been initialized. Run `browserlet vault init` first.
- **"Invalid master password"** -- The entered password does not match. Re-enter the correct password.
- **"credential references but --vault flag not provided"** -- The script uses `{{credential:...}}` syntax but `--vault` was not passed. Add `--vault` to the command.

---

## LLM Micro-Prompts

The cascade resolver uses 5 stages to find elements. Stages 1-2 are deterministic (hint matching, structural scoring). Stages 3-5 use LLM micro-prompts for intelligent element resolution when deterministic methods fail.

### Enabling Micro-Prompts

```bash
browserlet run script.bsl --micro-prompts
```

Without `--micro-prompts`, the CLI runs in **deterministic-only mode** (stages 1-2). This is the default and requires no API keys.

### LLM Stages

| Stage | Name | Mode |
|-------|------|------|
| 1 | Hint matcher | Deterministic |
| 2 | Structural scorer | Deterministic |
| 3 | Hint suggester | LLM micro-prompt |
| 4 | Disambiguator | LLM micro-prompt |
| 5 | Semantic matcher | LLM micro-prompt |

### Environment Variables

Configure the LLM provider using environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key | (required for `claude` provider) |
| `BROWSERLET_LLM_PROVIDER` | LLM provider selection | `claude` |
| `BROWSERLET_LLM_MODEL` | Model name override | `claude-sonnet-4-5-20250929` (claude) / `llama3.1` (ollama) |
| `BROWSERLET_OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |

### Provider Configuration

**Claude (default):**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
browserlet run script.bsl --micro-prompts
```

**Ollama (local, no API key needed):**

```bash
export BROWSERLET_LLM_PROVIDER=ollama
browserlet run script.bsl --micro-prompts
```

---

## Auto-Repair

When element resolution fails, the auto-repair system uses the LLM to analyze the DOM and suggest updated hints for the failing step.

### Modes

**Automatic (`--auto-repair`):** Repairs are applied automatically when the LLM's confidence is >= 0.70. The BSL file is updated on disk with the new hints.

```bash
browserlet run script.bsl --micro-prompts --auto-repair
```

**Interactive (`--interactive`):** Each repair suggestion is displayed with its confidence score and reasoning. You approve or reject each one.

```bash
browserlet run script.bsl --micro-prompts --interactive
```

### How It Works

1. Both cascade resolver and simple resolver fail to find the element
2. The repair engine captures DOM context around the expected element location
3. The LLM analyzes the DOM excerpt and suggests replacement hints
4. If confidence >= 0.70 (auto mode) or user approves (interactive mode):
   - The BSL file is updated on disk with new hints
   - Resolution is re-attempted with the repaired hints
5. A repair history log is maintained per script

### Requirements

- LLM configuration must be set (via `ANTHROPIC_API_KEY` or Ollama)
- `--auto-repair` and `--interactive` are **mutually exclusive**
- Auto-repair implicitly enables LLM capabilities (even without `--micro-prompts`)

---

## Batch Testing

The `browserlet test` command discovers and runs all `.bsl` files in a directory as a test suite.

### Discovery

- Scans the given directory for `.bsl` files (non-recursive)
- Files are sorted alphabetically for deterministic execution order
- Each script runs in a **fresh, isolated browser instance**

### Parallel Execution

```bash
# Run 4 scripts simultaneously
browserlet test tests/ --workers 4
```

Each worker gets its own Chromium browser instance. Worker count should not exceed available CPU cores/RAM.

### Bail on First Failure

```bash
browserlet test tests/ --bail
```

When `--bail` is set, execution stops after the first script failure. Remaining scripts are marked as `SKIP` in the report.

### Test Output

The test reporter produces CI-friendly output (no spinners, no interactive prompts):

```
  Browserlet Test | tests/ | 5 scripts
  ──────────────────────────────────────────────────
  [1/5] Running login.bsl...
  PASS login.bsl (1.2s)
  [2/5] Running search.bsl...
  PASS search.bsl (0.8s)
  [3/5] Running checkout.bsl...
  FAIL checkout.bsl (3.1s)
         Script failed with exit code 1
  SKIP payment.bsl
  SKIP confirmation.bsl

  ──────────────────────────────────────────────────
  Results: 2 passed, 1 failed, 2 skipped | 5.1s

  Failures:
    1) checkout.bsl
       Script failed with exit code 1
```

### Summary Report

The batch result includes:

| Field | Description |
|-------|-------------|
| `passed` | Number of scripts that completed successfully |
| `failed` | Number of scripts with step failures (exit code 1) |
| `errored` | Number of scripts with infrastructure errors (exit code 2) |
| `skipped` | Number of scripts skipped due to `--bail` |

---

## Examples

The `examples/` directory contains 14 ready-to-use BSL scripts. Each demonstrates a specific feature or use case.

### Quick Start Examples

**Navigate and verify a heading:**

```yaml
name: Navigate to Example.com and verify heading
steps:
  - action: navigate
    value: "https://example.com"
  - action: wait_for
    target:
      intent: "Main heading on the page"
      hints:
        - type: role
          value: heading
        - type: text_contains
          value: "Example Domain"
      fallback_selector: "h1"
    timeout: "5s"
```

**Fill a form:**

```yaml
name: Fill and submit a form
steps:
  - action: navigate
    value: "https://httpbin.org/forms/post"
  - action: type
    target:
      intent: "Customer name input field"
      hints:
        - type: name
          value: custname
      fallback_selector: "input[name='custname']"
    value: "Jane Doe"
  - action: click
    target:
      intent: "Submit button"
      hints:
        - type: role
          value: button
        - type: text_contains
          value: "Submit"
      fallback_selector: "button[type='submit']"
```

**Extract text and use in a later step:**

```yaml
name: Extract and reuse a value
steps:
  - action: navigate
    value: "https://quotes.toscrape.com/"
  - action: extract
    target:
      intent: "First quote text"
      hints:
        - type: class_contains
          value: text
      fallback_selector: ".quote .text"
    output:
      variable: "extracted.quote"
```

### Example Index

| File | Feature | Action Types |
|------|---------|--------------|
| [01-navigate-and-verify.bsl](examples/01-navigate-and-verify.bsl) | Basic navigation and waiting | `navigate`, `wait_for` |
| [02-form-login.bsl](examples/02-form-login.bsl) | Form filling and submission | `navigate`, `type`, `click` |
| [03-extract-text.bsl](examples/03-extract-text.bsl) | Text extraction with `output.variable` | `navigate`, `extract` |
| [04-table-extract.bsl](examples/04-table-extract.bsl) | Structured table data extraction | `navigate`, `table_extract` |
| [05-screenshot-on-demand.bsl](examples/05-screenshot-on-demand.bsl) | Page screenshot to file | `navigate`, `wait_for`, `screenshot` |
| [06-credential-vault-login.bsl](examples/06-credential-vault-login.bsl) | Credential vault `{{credential:alias}}` syntax | `navigate`, `type`, `click` |
| [07-multi-step-workflow.bsl](examples/07-multi-step-workflow.bsl) | Multi-page workflow chaining | `navigate`, `wait_for`, `click`, `extract` |
| [08-dropdown-select.bsl](examples/08-dropdown-select.bsl) | Dropdown `<select>` interaction | `navigate`, `wait_for`, `select` |
| [09-wait-for-dynamic-content.bsl](examples/09-wait-for-dynamic-content.bsl) | Dynamic content with timeout override | `navigate`, `wait_for` |
| [10-hover-and-scroll.bsl](examples/10-hover-and-scroll.bsl) | Hover and scroll actions | `navigate`, `hover`, `scroll`, `wait_for` |
| [11-variable-substitution.bsl](examples/11-variable-substitution.bsl) | Extract-then-substitute flow | `navigate`, `extract`, `type` |
| [12-batch-test-suite/](examples/12-batch-test-suite/) | Batch testing with `browserlet test` | Multiple |

### Running Examples

```bash
# Single example
browserlet run examples/01-navigate-and-verify.bsl

# With visible browser
browserlet run examples/07-multi-step-workflow.bsl --headed

# Batch test suite
browserlet test examples/12-batch-test-suite/

# Batch with parallel workers
browserlet test examples/12-batch-test-suite/ --workers 3
```

---

## Migration Guide: Extension to CLI

The Browserlet browser extension and CLI share the same BSL script format. Here is how to migrate your workflow.

### Workflow

1. **Record** scripts interactively using the browser extension
2. **Export** the recorded `.bsl` file from the extension
3. **Run** the exported script with the CLI: `browserlet run script.bsl`

No format conversion is needed -- the same BSL YAML works in both environments.

### Key Differences

| Aspect | Browser Extension | CLI |
|--------|------------------|-----|
| **Execution** | Runs in the browser tab (content script) | Runs headlessly via Playwright (Chromium) |
| **Recording** | Interactive recording with event capture | N/A (CLI is playback-only) |
| **Credentials** | Stored in browser extension storage | File-based encrypted vault (same AES-256-GCM encryption) |
| **LLM Micro-Prompts** | Via extension background script | Direct API calls to Claude/Ollama |
| **Element Resolution** | Extension cascade resolver (in-browser) | CLI cascade resolver (Playwright injected) |
| **Batch Testing** | Not available | `browserlet test` with `--bail` and `--workers` |
| **Auto-Repair** | Not available | `--auto-repair` and `--interactive` modes |
| **Output** | Visual overlay in browser | Terminal output with colored status |
| **CI/CD Integration** | Not applicable | Full support (exit codes, no interactive prompts in batch mode) |

### Feature Parity

| Feature | Extension | CLI |
|---------|:---------:|:---:|
| All 10 BSL action types | Yes | Yes |
| 13 semantic hint types | Yes | Yes |
| Credential substitution | Yes | Yes |
| Cascade resolver (stages 1-2) | Yes | Yes |
| LLM micro-prompts (stages 3-5) | Yes | Yes |
| Variable extraction and substitution | Yes | Yes |
| Failure screenshots | No | Yes |
| Batch test execution | No | Yes |
| Parallel workers | No | Yes |
| Auto-repair | No | Yes |
| Interactive repair | No | Yes |
| CI-friendly output | No | Yes |

### Credential Migration

Extension credentials are stored in browser storage and are not directly portable. To use the same credentials with the CLI:

1. Initialize the CLI vault: `browserlet vault init`
2. Re-add each credential: `browserlet vault add --alias <name> --value <value>`
3. Update BSL scripts to use `{{credential:alias}}` syntax (same format the extension uses)

---

## Troubleshooting

### Common Errors

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Script file not found: <path>` | Script path does not exist | Check the file path; use an absolute path if needed |
| `Vault not found. Initialize with browserlet vault init` | Vault has not been created | Run `browserlet vault init` to create and encrypt a new vault |
| `Invalid master password` | Wrong password entered | Re-enter the correct master password |
| `credential references but --vault flag not provided` | Script uses `{{credential:...}}` without vault | Add `--vault` to the command |
| `--micro-prompts with provider=claude requires ANTHROPIC_API_KEY environment variable` | Claude provider selected but no API key | Set `export ANTHROPIC_API_KEY="sk-ant-..."` |
| `--auto-repair and --interactive are mutually exclusive` | Both flags specified | Use only `--auto-repair` or `--interactive`, not both |
| `Unknown LLM provider: <name>` | Invalid `BROWSERLET_LLM_PROVIDER` value | Use `claude` or `ollama` |
| `No .bsl files found in: <dir>` | Test directory has no `.bsl` files | Verify the directory contains `.bsl` files |
| `Invalid timeout value: <val>` | Non-numeric or negative timeout | Use a positive integer (milliseconds) |
| `Timeout after <N>ms on <action>` | Step exceeded its timeout | Increase `--timeout`, add per-step `timeout`, or improve hints |
| `CascadeCLIResolver failed` | Element could not be found by any resolver stage | Improve semantic hints, add `fallback_selector`, or enable `--micro-prompts` |
| `Infrastructure error: <message>` | Browser launch failure or crash | Run `npx playwright install chromium` to install the browser |
| `Invalid --workers value: must be a positive integer` | Non-numeric or zero workers value | Use a positive integer (e.g., `--workers 4`) |
| `Not a directory: <path>` | Path passed to `browserlet test` is a file | Provide a directory path, not a file path |
| `--auto-repair / --interactive requires ANTHROPIC_API_KEY environment variable` | Repair mode needs LLM but no key set | Set `ANTHROPIC_API_KEY` or configure Ollama provider |

### Debugging Tips

1. **Use `--headed` mode** to watch the browser execute steps in real-time:
   ```bash
   browserlet run script.bsl --headed
   ```

2. **Check failure screenshots** in the output directory (default: `browserlet-output/`). Each failed step generates a `fail-<step-name>.png` screenshot.

3. **Increase timeouts** for slow-loading pages:
   ```bash
   browserlet run script.bsl --timeout 60000
   ```

4. **Enable micro-prompts** when deterministic resolution is not enough:
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..."
   browserlet run script.bsl --micro-prompts
   ```

5. **Add `fallback_selector`** to steps as a safety net when semantic hints might not match perfectly.

---

## Programmatic API

The CLI package exports its core modules for programmatic use in Node.js applications:

```typescript
import {
  BSLRunner,
  BatchRunner,
  PlaywrightExecutor,
  CascadeCLIResolver,
  SimpleResolver,
  StepReporter,
  TestReporter,
} from '@browserlet/cli';

import type {
  RunResult,
  BSLRunnerOptions,
  BatchResult,
  ScriptResult,
  BatchRunnerOptions,
  StepError,
  StepErrorCode,
} from '@browserlet/cli';
```

### Example: Run a Script Programmatically

```typescript
import { chromium } from 'playwright';
import { BSLRunner } from '@browserlet/cli';

const browser = await chromium.launch({ headless: true });
const page = await browser.newContext().then(ctx => ctx.newPage());

const runner = new BSLRunner(page, {
  globalTimeout: 30000,
  outputDir: 'output',
});

const result = await runner.run('script.bsl');
console.log('Exit code:', result.exitCode);

await browser.close();
```

### Example: Run a Batch Programmatically

```typescript
import { BatchRunner, TestReporter } from '@browserlet/cli';

const reporter = new TestReporter();
const runner = new BatchRunner({
  headed: false,
  globalTimeout: 30000,
  outputDir: 'output',
  vault: false,
  microPrompts: false,
  workers: 2,
}, reporter);

const scripts = runner.discover('tests/');
const result = await runner.runAll(scripts);
console.log(`Passed: ${result.passed}, Failed: ${result.failed}`);
```

---

## License

See the root [LICENSE](../../LICENSE) file.
