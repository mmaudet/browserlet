# Phase 3: Side Panel - Research

**Researched:** 2026-01-29
**Domain:** Chrome Extension Side Panel UI, Monaco Editor, i18n, Storage
**Confidence:** MEDIUM (verified with official docs and multiple sources)

## Summary

Phase 3 transforms the basic recording UI into a professional script management interface. The research investigated five key domains: (1) Monaco Editor integration with WXT/Vite for YAML editing, (2) UI approach for vanilla TypeScript, (3) Chrome i18n API for French/English support, (4) chrome.storage.local patterns for script persistence, and (5) file import/export mechanisms.

The core challenge is integrating Monaco Editor into a Chrome extension built with WXT (Vite-based). Monaco requires special worker configuration and the `vite-plugin-monaco-editor` plugin handles this complexity. For YAML specifically, `monaco-yaml` provides syntax highlighting and schema-based validation. The current vanilla TypeScript approach can be enhanced with VanJS (1.0kB reactive framework) for component composition without adding React complexity.

**Primary recommendation:** Use `vite-plugin-monaco-editor` + `monaco-yaml` for the editor, VanJS for reactive UI components, Chrome's native i18n API with `_locales/` structure, and `chrome.storage.local` with in-memory filtering for script management.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| monaco-editor | ^0.52.x | Code editor component | VS Code's editor, industry standard |
| monaco-yaml | ^5.x | YAML language support | Official YAML plugin with schema validation |
| vite-plugin-monaco-editor | ^1.1.x | Vite/Monaco integration | Handles worker bundling automatically |
| js-yaml | ^4.1.x | YAML parse/dump | Most popular, actively maintained |
| vanjs-core | ^1.5.x | Reactive UI primitives | 1.0kB, no build step, TypeScript native |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| file-saver | ^2.0.x | File download | Export scripts as YAML files |
| @json2csv/plainjs | ^7.x | JSON to CSV | Export execution results |
| @types/file-saver | ^2.0.x | TypeScript types | Type safety for file-saver |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| VanJS | Vanilla DOM | VanJS adds reactivity without framework overhead |
| js-yaml | yaml (eemeli) | yaml has better AST support but js-yaml is simpler |
| file-saver | Native Blob/URL | file-saver handles cross-browser edge cases |

**Installation:**
```bash
npm install monaco-editor monaco-yaml vite-plugin-monaco-editor js-yaml vanjs-core file-saver @json2csv/plainjs
npm install -D @types/file-saver
```

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/
  sidepanel/
    index.html           # Side panel entry
    main.ts              # Bootstrap and routing
    components/          # VanJS components
      ScriptList.ts      # Script listing with search
      ScriptEditor.ts    # Monaco editor wrapper
      ExecutionView.ts   # Progress and results
      RecordingView.ts   # Recording mode UI
      ContextZone.ts     # Current page context
    stores/              # Reactive state
      scripts.ts         # Script CRUD operations
      execution.ts       # Execution state
      ui.ts              # UI state (active view, etc.)
    i18n/                # i18n helpers
      messages.ts        # getMessage wrapper
utils/
  storage/
    scripts.ts           # Script storage operations
    history.ts           # Execution history (last 50)
_locales/
  en/
    messages.json        # English strings
  fr/
    messages.json        # French strings
```

### Pattern 1: VanJS Reactive Components
**What:** Small reactive components using VanJS state primitives
**When to use:** Any UI that needs to react to state changes
**Example:**
```typescript
// Source: https://vanjs.org/
import van from 'vanjs-core';
const { div, button, span, input } = van.tags;

// Reactive state
const searchTerm = van.state('');
const filteredScripts = van.derive(() =>
  scripts.val.filter(s =>
    s.name.toLowerCase().includes(searchTerm.val.toLowerCase())
  )
);

// Component
const ScriptList = () => {
  return div(
    input({
      type: 'text',
      placeholder: chrome.i18n.getMessage('searchPlaceholder'),
      oninput: (e: Event) => searchTerm.val = (e.target as HTMLInputElement).value
    }),
    div({ class: 'script-list' },
      () => filteredScripts.val.map(script =>
        ScriptItem({ script })
      )
    )
  );
};
```

### Pattern 2: Monaco Editor Container
**What:** Wrapper component for Monaco with YAML configuration
**When to use:** BSL script editing
**Example:**
```typescript
// Source: https://github.com/remcohaszing/monaco-yaml
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';

// Configure YAML support once at startup
configureMonacoYaml(monaco, {
  enableSchemaRequest: false,
  schemas: [{
    uri: 'https://browserlet.local/bsl-schema.json',
    fileMatch: ['*'],
    schema: BSL_SCHEMA // Your BSL JSON schema
  }]
});

const createEditor = (container: HTMLElement, initialValue: string) => {
  return monaco.editor.create(container, {
    value: initialValue,
    language: 'yaml',
    theme: 'vs-light',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false
  });
};
```

### Pattern 3: Storage-Backed State
**What:** Sync VanJS state with chrome.storage.local
**When to use:** Any persisted data (scripts, settings)
**Example:**
```typescript
// scripts store with storage sync
const scripts = van.state<Script[]>([]);

// Load on init
export async function loadScripts() {
  const result = await chrome.storage.local.get('scripts');
  scripts.val = result.scripts || [];
}

// Save on change
export async function saveScript(script: Script) {
  const updated = [...scripts.val.filter(s => s.id !== script.id), script];
  await chrome.storage.local.set({ scripts: updated });
  scripts.val = updated;
}

// Listen for external changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.scripts) {
    scripts.val = changes.scripts.newValue || [];
  }
});
```

### Anti-Patterns to Avoid
- **Storing Monaco instance in state:** Monaco editor is not serializable; keep reference in component closure only
- **Re-creating editor on every render:** Create once, update content via `editor.setValue()`
- **Blocking UI with storage operations:** All storage ops are async; show loading states
- **Hardcoded strings:** Use `chrome.i18n.getMessage()` for all user-visible text

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML syntax highlighting | Custom tokenizer | monaco-yaml + built-in | Complex grammar, edge cases |
| YAML validation | Custom parser | monaco-yaml schemas | JSON Schema integration |
| YAML parsing | Regex/string manipulation | js-yaml | Edge cases (multiline, anchors) |
| File download | Blob + click hack | file-saver | Safari/iOS quirks |
| JSON to CSV | String concat | @json2csv/plainjs | Escaping, quoting, unicode |
| Reactive UI updates | Manual DOM manipulation | VanJS | Memory leaks, consistency |
| i18n | Custom translation system | chrome.i18n API | Browser locale detection |

**Key insight:** Monaco Editor and YAML parsing have years of edge case fixes. Custom solutions will fail on multi-line strings, special characters, and YAML anchors.

## Common Pitfalls

### Pitfall 1: Monaco Worker Configuration in WXT
**What goes wrong:** Monaco fails to load with "Unexpected usage" or worker errors
**Why it happens:** WXT/Vite needs special worker configuration for Monaco
**How to avoid:** Use `vite-plugin-monaco-editor` and configure in `wxt.config.ts`:
```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  vite: () => ({
    plugins: [
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'yaml'],
        customWorkers: [{
          label: 'yaml',
          entry: 'monaco-yaml/yaml.worker'
        }]
      })
    ]
  })
});
```
**Warning signs:** Console errors mentioning EditorSimpleWorker or loadForeignModule

### Pitfall 2: Monaco YAML Syntax Not Working
**What goes wrong:** YAML files show as plain text, no syntax highlighting
**Why it happens:** YAML language contribution not imported
**How to avoid:** Ensure YAML contribution is imported:
```typescript
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
```
**Warning signs:** No color in editor, language dropdown shows "Plain Text"

### Pitfall 3: Side Panel Losing State on Close
**What goes wrong:** Editor content or UI state lost when side panel closes
**Why it happens:** Side panel is destroyed when closed, like a popup
**How to avoid:**
1. Auto-save editor content to storage on change (debounced)
2. Load state from storage on panel open
3. Use `chrome.storage.onChanged` to sync between contexts
**Warning signs:** User loses work when accidentally closing panel

### Pitfall 4: i18n Default Locale Not Set
**What goes wrong:** Extension fails to load or shows raw `__MSG_key__` strings
**Why it happens:** Missing `default_locale` in manifest when using `_locales/`
**How to avoid:** Add to `wxt.config.ts` manifest:
```typescript
manifest: {
  default_locale: 'en',
  // ...
}
```
**Warning signs:** Extension install fails or shows `__MSG_...` text

### Pitfall 5: Storage Quota Exceeded
**What goes wrong:** Script save fails silently or throws
**Why it happens:** Default 10MB limit exceeded with execution history
**How to avoid:**
1. Limit execution history to 50 entries per script
2. Truncate large results before storing
3. Request `unlimitedStorage` permission if needed
**Warning signs:** `runtime.lastError` or rejected Promise on storage.set

### Pitfall 6: File Import Encoding Issues
**What goes wrong:** Imported YAML has garbled characters
**Why it happens:** FileReader default encoding doesn't match file
**How to avoid:** Explicitly specify UTF-8:
```typescript
reader.readAsText(file, 'UTF-8');
```
**Warning signs:** Non-ASCII characters appear as `???` or `???`

## Code Examples

Verified patterns from official sources:

### Monaco Editor Setup with YAML
```typescript
// Source: https://github.com/remcohaszing/monaco-yaml
import * as monaco from 'monaco-editor';
import { configureMonacoYaml } from 'monaco-yaml';

// Import YAML syntax
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';

// Configure once at app startup
configureMonacoYaml(monaco, {
  validate: true,
  format: true,
  hover: true,
  completion: true,
  schemas: [{
    uri: 'bsl://schema',
    fileMatch: ['*'],
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        version: { type: 'string' },
        steps: { type: 'array' }
      },
      required: ['name', 'steps']
    }
  }]
});

// Create editor instance
const container = document.getElementById('editor')!;
const editor = monaco.editor.create(container, {
  value: '',
  language: 'yaml',
  automaticLayout: true
});

// Get/set content
const getContent = () => editor.getValue();
const setContent = (yaml: string) => editor.setValue(yaml);
```

### Chrome i18n Usage
```typescript
// Source: https://developer.chrome.com/docs/extensions/develop/ui/i18n

// _locales/en/messages.json
{
  "appName": {
    "message": "Browserlet",
    "description": "Extension name"
  },
  "scriptListTitle": {
    "message": "Scripts",
    "description": "Title for script list section"
  },
  "searchPlaceholder": {
    "message": "Search scripts...",
    "description": "Placeholder for search input"
  },
  "executionProgress": {
    "message": "Step $CURRENT$ of $TOTAL$",
    "description": "Progress indicator",
    "placeholders": {
      "current": { "content": "$1" },
      "total": { "content": "$2" }
    }
  }
}

// _locales/fr/messages.json
{
  "appName": { "message": "Browserlet" },
  "scriptListTitle": { "message": "Scripts" },
  "searchPlaceholder": { "message": "Rechercher..." },
  "executionProgress": {
    "message": "Etape $CURRENT$ sur $TOTAL$",
    "placeholders": {
      "current": { "content": "$1" },
      "total": { "content": "$2" }
    }
  }
}

// Usage in code
const title = chrome.i18n.getMessage('scriptListTitle');
const progress = chrome.i18n.getMessage('executionProgress', ['3', '10']);
```

### YAML Import/Export
```typescript
// Source: https://github.com/nodeca/js-yaml, https://github.com/eligrey/FileSaver.js
import yaml from 'js-yaml';
import { saveAs } from 'file-saver';

// Export script as YAML file
function exportScript(script: Script) {
  const yamlContent = yaml.dump(script, {
    indent: 2,
    lineWidth: -1, // No line wrapping
    noRefs: true   // No YAML anchors
  });
  const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
  saveAs(blob, `${script.name}.yaml`);
}

// Import script from YAML file
async function importScript(file: File): Promise<Script> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const script = yaml.load(content) as Script;
        // Validate required fields
        if (!script.name || !script.steps) {
          throw new Error('Invalid BSL script: missing name or steps');
        }
        resolve(script);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
}
```

### Copy Results to Clipboard
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
import { Parser } from '@json2csv/plainjs';

async function copyAsJSON(data: unknown) {
  const json = JSON.stringify(data, null, 2);
  await navigator.clipboard.writeText(json);
}

async function copyAsCSV(data: Record<string, unknown>[]) {
  const parser = new Parser();
  const csv = parser.parse(data);
  await navigator.clipboard.writeText(csv);
}
```

### Script Storage Operations
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/storage

interface Script {
  id: string;
  name: string;
  description?: string;
  version: string;
  target_app?: string;
  author?: string;
  tags?: string[];
  content: string; // YAML content
  createdAt: number;
  updatedAt: number;
}

interface ExecutionRecord {
  scriptId: string;
  startedAt: number;
  completedAt?: number;
  status: 'running' | 'completed' | 'failed';
  results?: unknown;
  error?: string;
}

// Save script
async function saveScript(script: Script): Promise<void> {
  const { scripts = [] } = await chrome.storage.local.get('scripts');
  const filtered = scripts.filter((s: Script) => s.id !== script.id);
  await chrome.storage.local.set({
    scripts: [...filtered, { ...script, updatedAt: Date.now() }]
  });
}

// Get all scripts
async function getScripts(): Promise<Script[]> {
  const { scripts = [] } = await chrome.storage.local.get('scripts');
  return scripts;
}

// Search scripts (in-memory filtering)
async function searchScripts(query: string): Promise<Script[]> {
  const scripts = await getScripts();
  const q = query.toLowerCase();
  return scripts.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description?.toLowerCase().includes(q) ||
    s.target_app?.toLowerCase().includes(q) ||
    s.tags?.some(t => t.toLowerCase().includes(q))
  );
}

// Execution history (capped at 50 per script)
async function addExecutionRecord(record: ExecutionRecord): Promise<void> {
  const key = `history_${record.scriptId}`;
  const { [key]: history = [] } = await chrome.storage.local.get(key);
  const updated = [record, ...history].slice(0, 50);
  await chrome.storage.local.set({ [key]: updated });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CodeMirror 5 | Monaco Editor | 2016+ | VS Code-quality editing in browser |
| Custom i18n | chrome.i18n API | Always | Browser handles locale detection |
| React/Vue for everything | VanJS or vanilla | 2023+ | Sub-1KB reactive UI without framework |
| Manifest V2 storage | Manifest V3 chrome.storage | 2021+ | Service worker compatible |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Use Clipboard API instead
- Manifest V2 `chrome.extension.getBackgroundPage()`: Use messaging
- Synchronous storage APIs: All storage is async in MV3

## Open Questions

Things that couldn't be fully resolved:

1. **Monaco bundle size in extension**
   - What we know: Monaco is large (~2MB minified), but can be tree-shaken
   - What's unclear: Exact impact on extension load time in side panel
   - Recommendation: Monitor load time; consider lazy-loading editor only when needed

2. **WXT + vite-plugin-monaco-editor compatibility**
   - What we know: WXT uses Vite, plugin should work
   - What's unclear: No specific WXT examples found; may need config tweaks
   - Recommendation: Test early, check WXT GitHub issues if problems arise

3. **YAML schema for BSL validation**
   - What we know: monaco-yaml supports JSON Schema
   - What's unclear: Exact BSL schema structure not defined yet
   - Recommendation: Start with basic schema, iterate as BSL spec solidifies

## Sources

### Primary (HIGH confidence)
- [Monaco Editor Official](https://microsoft.github.io/monaco-editor/) - Editor capabilities
- [monaco-yaml GitHub](https://github.com/remcohaszing/monaco-yaml) - YAML integration
- [Chrome i18n API](https://developer.chrome.com/docs/extensions/develop/ui/i18n) - Internationalization
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) - Storage patterns
- [WXT Vite Config](https://wxt.dev/guide/essentials/config/vite) - Vite plugin integration
- [WXT Project Structure](https://wxt.dev/guide/essentials/project-structure.html) - File organization

### Secondary (MEDIUM confidence)
- [vite-plugin-monaco-editor npm](https://www.npmjs.com/package/vite-plugin-monaco-editor) - Vite integration
- [VanJS](https://vanjs.org/) - Reactive UI framework
- [js-yaml GitHub](https://github.com/nodeca/js-yaml) - YAML parsing
- [FileSaver.js GitHub](https://github.com/eligrey/FileSaver.js) - File export
- [@json2csv/plainjs npm](https://www.npmjs.com/package/@json2csv/plainjs) - CSV conversion
- [Clipboard API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) - Copy functionality

### Tertiary (LOW confidence)
- [Monaco Editor Chrome Extension Discussion](https://github.com/microsoft/monaco-editor/discussions/3908) - Extension-specific challenges
- Framework comparison blog posts - General guidance on WXT vs alternatives

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Verified with npm/GitHub, but WXT+Monaco combo untested
- Architecture: MEDIUM - Based on WXT docs and VanJS patterns, not production examples
- Pitfalls: HIGH - Documented in GitHub issues and official docs
- i18n: HIGH - Chrome official documentation
- Storage: HIGH - Chrome official documentation

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - stable ecosystem)
