# Phase 5: LLM Integration - Research

**Researched:** 2026-01-29
**Domain:** LLM API integration, secure credential storage, rate limiting, BSL script generation
**Confidence:** HIGH

## Summary

This research covers the integration of LLM providers (Claude API and Ollama) into a Chrome extension for semantic BSL script generation. The phase requires secure API key storage, rate limiting with exponential backoff, graceful fallback when LLM is unavailable, and prompt engineering for converting captured user actions into BSL scripts.

The key architectural decision is that LLM calls MUST be made from the service worker (background script), not content scripts, to avoid CORS issues and properly leverage Chrome extension's `host_permissions`. API keys should be stored encrypted in `chrome.storage.local` using the Web Crypto API (AES-GCM), with the encryption key stored in `chrome.storage.session` (memory-only, cleared on browser restart).

**Primary recommendation:** Build a unified LLM service abstraction in the service worker that supports both Claude API and Ollama, with the provider selection and credentials managed through a settings UI. Use the official `@anthropic-ai/sdk` for Claude and the `ollama` npm package with browser bundle for Ollama.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | latest | Claude API client | Official Anthropic SDK, TypeScript support, streaming |
| ollama | latest | Ollama local LLM client | Official library, browser bundle available (`ollama/browser`) |
| Web Crypto API | Browser native | AES-GCM encryption | Built-in, no WASM issues with MV3, standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| exponential-backoff | latest | Retry with backoff | Rate limit handling (429 errors) |
| js-yaml | 4.1.1 (installed) | YAML generation | Converting LLM output to valid BSL YAML |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @anthropic-ai/sdk | Raw fetch | SDK handles auth, retries, types - raw fetch adds boilerplate |
| ollama npm package | OpenAI SDK with Ollama compat | Native package simpler, OpenAI compat layer adds indirection |
| Web Crypto API | libsodium-js | libsodium uses WASM, blocked in MV3 extensions |
| AES-GCM | AES-CBC | GCM provides authenticated encryption (integrity check) |

**Installation:**
```bash
npm install @anthropic-ai/sdk ollama exponential-backoff
```

## Architecture Patterns

### Recommended Project Structure
```
entrypoints/background/
  llm/
    index.ts           # LLM service facade (provider abstraction)
    providers/
      claude.ts        # Claude API provider
      ollama.ts        # Ollama provider
      types.ts         # Provider interface
    rateLimiter.ts     # Rate limiting with exponential backoff
    promptBuilder.ts   # BSL generation prompts
    fallback.ts        # Fallback selector generation

utils/
  crypto/
    encryption.ts      # AES-GCM encrypt/decrypt for API keys
    keyManager.ts      # Session key generation and management

entrypoints/sidepanel/
  components/
    LLMSettings.ts     # Settings UI for LLM configuration
  stores/
    llmConfig.ts       # LLM configuration state
```

### Pattern 1: Provider Abstraction
**What:** Unified interface for multiple LLM providers
**When to use:** All LLM calls go through this abstraction
**Example:**
```typescript
// Source: Anthropic SDK docs + custom abstraction
interface LLMProvider {
  name: 'claude' | 'ollama';
  generateBSL(actions: CapturedAction[]): Promise<string>;
  isAvailable(): Promise<boolean>;
}

interface LLMConfig {
  provider: 'claude' | 'ollama';
  claudeApiKey?: string; // Encrypted in storage
  ollamaHost?: string;   // Default: http://localhost:11434
  ollamaModel?: string;  // Default: llama3.1
}

class LLMService {
  private provider: LLMProvider | null = null;
  private config: LLMConfig | null = null;

  async initialize(config: LLMConfig): Promise<void> {
    this.config = config;
    if (config.provider === 'claude' && config.claudeApiKey) {
      this.provider = new ClaudeProvider(config.claudeApiKey);
    } else if (config.provider === 'ollama') {
      this.provider = new OllamaProvider(config.ollamaHost, config.ollamaModel);
    }
  }

  async generateBSL(actions: CapturedAction[]): Promise<string> {
    if (!this.provider) {
      return this.fallbackGeneration(actions);
    }

    try {
      const available = await this.provider.isAvailable();
      if (!available) {
        return this.fallbackGeneration(actions);
      }
      return await this.provider.generateBSL(actions);
    } catch (error) {
      console.error('[LLM] Provider failed, using fallback:', error);
      return this.fallbackGeneration(actions);
    }
  }

  private fallbackGeneration(actions: CapturedAction[]): string {
    // Basic BSL without LLM enhancement
    return generateBasicBSL(actions);
  }
}
```

### Pattern 2: Service Worker API Routing
**What:** All LLM API calls routed through service worker to avoid CORS
**When to use:** Content scripts or side panel need LLM features
**Example:**
```typescript
// In background/messaging.ts - add new message types
case 'GENERATE_BSL': {
  const { actions } = message.payload as { actions: CapturedAction[] };
  const llmService = getLLMService();
  try {
    const bsl = await llmService.generateBSL(actions);
    return { success: true, data: { bsl } };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

case 'CHECK_LLM_STATUS': {
  const llmService = getLLMService();
  const status = await llmService.getStatus();
  return { success: true, data: status };
}
```

### Pattern 3: Encrypted API Key Storage
**What:** Store API keys encrypted with session-bound key
**When to use:** Storing Claude API key in chrome.storage.local
**Example:**
```typescript
// Source: Web Crypto API MDN + Chrome extension best practices
interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string;         // Base64 encoded
}

// Session key - lives in memory-only storage
async function getOrCreateSessionKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.session.get('encryptionKey');
  if (stored.encryptionKey) {
    // Import from JWK
    return crypto.subtle.importKey(
      'jwk',
      JSON.parse(stored.encryptionKey),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Store as JWK in session storage
  const exported = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.session.set({ encryptionKey: JSON.stringify(exported) });

  return key;
}

async function encryptApiKey(apiKey: string): Promise<EncryptedData> {
  const key = await getOrCreateSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits for AES-GCM
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(apiKey)
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

async function decryptApiKey(data: EncryptedData): Promise<string> {
  const key = await getOrCreateSessionKey();
  const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(data.ciphertext), c => c.charCodeAt(0));

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
```

### Pattern 4: Rate Limiting with Exponential Backoff
**What:** Handle 429 errors gracefully with retry
**When to use:** All API calls to Claude/Ollama
**Example:**
```typescript
// Source: Anthropic rate limit docs + exponential-backoff library
import { backOff } from 'exponential-backoff';

interface RateLimitState {
  lastRequest: number;
  retryAfter: number | null;
  consecutiveErrors: number;
}

class RateLimiter {
  private state: RateLimitState = {
    lastRequest: 0,
    retryAfter: null,
    consecutiveErrors: 0
  };

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we're in a rate limit window
    if (this.state.retryAfter && Date.now() < this.state.retryAfter) {
      const waitMs = this.state.retryAfter - Date.now();
      throw new Error(`Rate limited. Retry after ${Math.ceil(waitMs / 1000)}s`);
    }

    return backOff(async () => {
      try {
        const result = await fn();
        this.state.consecutiveErrors = 0;
        this.state.retryAfter = null;
        return result;
      } catch (error: any) {
        if (error.status === 429) {
          // Parse retry-after header
          const retryAfter = error.headers?.['retry-after'];
          if (retryAfter) {
            this.state.retryAfter = Date.now() + (parseInt(retryAfter, 10) * 1000);
          }
          this.state.consecutiveErrors++;
          throw error; // Let backOff handle retry
        }
        throw error; // Don't retry non-429 errors
      }
    }, {
      numOfAttempts: 5,
      startingDelay: 1000,
      timeMultiple: 2,
      maxDelay: 30000,
      jitter: 'full', // Add randomness to avoid thundering herd
      retry: (error: any) => error.status === 429
    });
  }
}
```

### Pattern 5: BSL Generation Prompt
**What:** Structured prompt for converting actions to BSL
**When to use:** When calling LLM to generate script
**Example:**
```typescript
// Source: Anthropic prompt engineering best practices
function buildBSLPrompt(actions: CapturedAction[]): string {
  const actionsJson = JSON.stringify(actions, null, 2);

  return `You are a BSL (Browserlet Scripting Language) expert. Convert the following captured user actions into a valid BSL script.

## BSL Format
BSL is YAML-based with this structure:
\`\`\`yaml
name: Script Name
version: "1.0.0"
description: Brief description
steps:
  - action: click|type|select|navigate|wait_for|scroll|hover|extract
    target:
      intent: "Human-readable description of element"
      hints:
        - type: role|text_contains|aria_label|name|placeholder_contains|class_contains|data_attribute|id|near_label|type
          value: "hint value"
      fallback_selector: "css selector as backup"
    value: "for type/select actions"
    timeout: "10s"
\`\`\`

## Hint Types (ordered by reliability)
1. data_attribute: {"name": "data-testid", "value": "submit-btn"} - Most stable
2. role: "button", "textbox", "link" - ARIA roles
3. type: "submit", "text", "password" - Input types
4. aria_label: Accessibility label
5. name: Form field name attribute
6. text_contains: Visible text content
7. placeholder_contains: Placeholder text
8. near_label: Associated label text
9. class_contains: Semantic CSS classes (not utility classes)
10. id: Element ID (only if not auto-generated)

## Rules
1. Always include 2-3 hints per target for resilience
2. Put most reliable hints first (data_attribute, role, aria_label)
3. Use semantic intent descriptions
4. Add fallback_selector only when element has unique ID/data attribute
5. Use wait_for before actions on dynamically loaded elements
6. Group related actions logically

## Captured Actions
\`\`\`json
${actionsJson}
\`\`\`

Generate a complete, valid BSL script. Output ONLY the YAML, no explanations.`;
}
```

### Anti-Patterns to Avoid
- **API calls from content scripts:** CORS will block requests; always route through service worker
- **Storing API keys unencrypted:** Use AES-GCM with session-bound key
- **Hardcoding retry delays:** Use exponential backoff with jitter
- **Ignoring rate limit headers:** Parse `retry-after` header from 429 responses
- **Synchronous LLM calls:** Always use async/await, show loading state in UI
- **Large prompts without context limit:** Claude has token limits; chunk if needed

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API client | Raw fetch with auth | @anthropic-ai/sdk | Handles auth, retries, streaming, types |
| Ollama client | Custom HTTP wrapper | ollama npm package | Official, handles streaming, browser bundle |
| Exponential backoff | Custom retry loop | exponential-backoff npm | Handles jitter, max attempts, configurable |
| AES encryption | Custom crypto | Web Crypto API | Browser-native, no WASM issues in MV3 |
| YAML generation | String concatenation | js-yaml (installed) | Proper escaping, valid syntax |

**Key insight:** The official SDKs handle edge cases like streaming responses, proper error handling, and authentication headers. Raw fetch implementation would need to replicate all this logic.

## Common Pitfalls

### Pitfall 1: CORS Blocking API Requests
**What goes wrong:** Content script or side panel tries to call Claude/Ollama API directly and gets CORS error
**Why it happens:** External APIs don't whitelist `chrome-extension://` origins
**How to avoid:** Route ALL LLM API calls through the service worker (background script) with proper `host_permissions` in manifest
**Warning signs:** "Access-Control-Allow-Origin" errors in console

### Pitfall 2: Service Worker Termination During Long Requests
**What goes wrong:** LLM request times out because service worker is terminated mid-request
**Why it happens:** MV3 service workers are short-lived; Chrome may terminate them after ~30 seconds of inactivity
**How to avoid:** Use streaming responses to keep the connection active; implement request resumption; store partial results
**Warning signs:** Incomplete responses, random timeouts

### Pitfall 3: Session Key Lost on Browser Restart
**What goes wrong:** API keys become undecryptable after browser restart
**Why it happens:** `chrome.storage.session` is cleared when browser closes; encryption key is lost
**How to avoid:** This is INTENTIONAL for security. Prompt user to re-enter API key after restart. Store a "keyConfigured" flag to detect this state.
**Warning signs:** Decryption failures after restart

### Pitfall 4: Rate Limit Thundering Herd
**What goes wrong:** Multiple requests retry at the same time, causing more rate limits
**Why it happens:** Fixed retry delays cause synchronized retries
**How to avoid:** Use jitter in exponential backoff; implement per-provider rate limit tracking
**Warning signs:** Cascading 429 errors

### Pitfall 5: Ollama Not Running
**What goes wrong:** Extension assumes Ollama is available when it's not
**Why it happens:** User hasn't started Ollama, or it's running on non-default port
**How to avoid:** Health check before first request; clear error message with setup instructions; allow custom host/port
**Warning signs:** Connection refused errors to localhost:11434

### Pitfall 6: Invalid BSL Output from LLM
**What goes wrong:** LLM generates invalid YAML or uses non-existent hint types
**Why it happens:** LLM hallucination; insufficient prompt constraints
**How to avoid:** Validate LLM output with js-yaml parser; check hint types against whitelist; fall back to basic generation on parse error
**Warning signs:** YAML parse errors, unknown hint types

## Code Examples

Verified patterns from official sources:

### Claude API Integration
```typescript
// Source: https://github.com/anthropics/anthropic-sdk-typescript
import Anthropic from '@anthropic-ai/sdk';

class ClaudeProvider implements LLMProvider {
  name = 'claude' as const;
  private client: Anthropic;
  private rateLimiter: RateLimiter;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.rateLimiter = new RateLimiter();
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Quick test with minimal tokens
      await this.rateLimiter.execute(() =>
        this.client.messages.create({
          model: 'claude-haiku-4-5-20250929', // Cheapest/fastest
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async generateBSL(actions: CapturedAction[]): Promise<string> {
    const prompt = buildBSLPrompt(actions);

    const response = await this.rateLimiter.execute(() =>
      this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    );

    // Extract text content
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Validate YAML
    const bsl = textBlock.text;
    try {
      yaml.load(bsl); // Will throw if invalid
      return bsl;
    } catch (parseError) {
      console.error('[Claude] Invalid YAML response:', parseError);
      throw new Error('LLM generated invalid BSL');
    }
  }
}
```

### Ollama Integration
```typescript
// Source: https://github.com/ollama/ollama-js
import { Ollama } from 'ollama/browser';

class OllamaProvider implements LLMProvider {
  name = 'ollama' as const;
  private client: Ollama;
  private model: string;

  constructor(host: string = 'http://localhost:11434', model: string = 'llama3.1') {
    this.client = new Ollama({ host });
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  async generateBSL(actions: CapturedAction[]): Promise<string> {
    const prompt = buildBSLPrompt(actions);

    const response = await this.client.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false
    });

    const bsl = response.message.content;

    // Validate YAML
    try {
      yaml.load(bsl);
      return bsl;
    } catch (parseError) {
      console.error('[Ollama] Invalid YAML response:', parseError);
      throw new Error('LLM generated invalid BSL');
    }
  }
}
```

### Manifest Configuration
```typescript
// wxt.config.ts additions
manifest: {
  permissions: ['storage', 'sidePanel', 'tabs', 'activeTab'],
  host_permissions: [
    'https://api.anthropic.com/*',  // Claude API
    'http://localhost:11434/*',      // Ollama default
    'http://127.0.0.1:11434/*'       // Ollama alternative
  ]
}
```

### Fallback BSL Generation (No LLM)
```typescript
// Source: Existing codebase pattern
function generateBasicBSL(actions: CapturedAction[]): string {
  const steps = actions.map((action, index) => {
    const step: any = {
      action: mapActionType(action.type),
      target: {
        intent: `Step ${index + 1}: ${action.type} action`,
        hints: action.hints.slice(0, 3) // Top 3 hints
      }
    };

    if (action.value) {
      step.value = action.value;
    }

    return step;
  });

  const script = {
    name: 'Recorded Script',
    version: '1.0.0',
    description: 'Auto-generated from recording (basic mode)',
    steps
  };

  return yaml.dump(script, { indent: 2, lineWidth: -1, noRefs: true });
}

function mapActionType(type: ActionType): string {
  switch (type) {
    case 'click': return 'click';
    case 'input': return 'type';
    case 'navigate': return 'navigate';
    case 'submit': return 'click'; // Submit is a click on submit button
    default: return type;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store API keys in localStorage | Encrypted chrome.storage with session key | 2024+ | Better security, keys unreadable after restart |
| Raw API calls with fetch | Official TypeScript SDKs | 2024+ | Better typing, built-in retry, streaming |
| Fixed retry delays | Exponential backoff with jitter | Long-standing | Avoids rate limit cascades |
| libsodium for encryption | Web Crypto API | MV3 migration | WASM blocked in MV3, native API works |

**Deprecated/outdated:**
- libsodium-js in Chrome extensions: WASM disallowed in MV3
- localStorage in service workers: Not available, use chrome.storage
- Manifest V2 background pages: Deprecated, service workers required

## Open Questions

Things that couldn't be fully resolved:

1. **Claude Model Selection for Cost/Quality Trade-off**
   - What we know: Haiku is cheapest/fastest, Sonnet is balanced, Opus is most capable
   - What's unclear: Which model produces best BSL output for cost
   - Recommendation: Default to Sonnet for BSL generation; allow user to configure model; Haiku for health checks

2. **Ollama Model Recommendations**
   - What we know: llama3.1 is popular, codellama exists for code
   - What's unclear: Which local models produce good BSL output
   - Recommendation: Default to llama3.1; document recommended models; allow user configuration

3. **Token Budget for BSL Generation**
   - What we know: Complex recordings with many actions need more context
   - What's unclear: Optimal max_tokens setting, when to chunk prompts
   - Recommendation: Start with max_tokens: 4096; implement chunking if single scripts exceed context window

## Sources

### Primary (HIGH confidence)
- Anthropic TypeScript SDK: https://github.com/anthropics/anthropic-sdk-typescript
- Ollama JavaScript Library: https://github.com/ollama/ollama-js
- Claude API Rate Limits: https://platform.claude.com/docs/en/api/rate-limits
- Web Crypto API MDN: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt
- Chrome Extension Storage: https://developer.chrome.com/docs/extensions/reference/api/storage
- Chrome Cross-Origin Requests: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

### Secondary (MEDIUM confidence)
- exponential-backoff npm: https://www.npmjs.com/package/exponential-backoff
- KeyChain browser extension encryption pattern: https://github.com/jwjoel/KeyChain
- Addy Osmani LLM coding workflow 2026: https://addyosmani.com/blog/ai-coding-workflow/

### Tertiary (LOW confidence)
- Bitwarden MV3 migration (encryption patterns): https://bitwarden.com/blog/bitwarden-manifest-v3/
- Various Chrome extension CORS discussions on StackOverflow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official SDKs documented, Web Crypto API well-documented
- Architecture: HIGH - Follows established Chrome extension patterns
- Encryption: MEDIUM - Web Crypto API is solid, but session key management needs validation
- Rate limiting: HIGH - Anthropic provides clear retry-after headers
- BSL generation prompts: MEDIUM - Prompt engineering is iterative, needs testing

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - API changes possible, but SDKs are stable)
