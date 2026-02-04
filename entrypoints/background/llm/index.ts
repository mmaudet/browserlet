/**
 * LLM Service facade with provider abstraction and fallback
 * Provides unified interface for BSL generation across different providers
 */

import type { LLMProvider, LLMConfig } from './providers/types';
import { ClaudeProvider } from './providers/claude';
import { OllamaProvider } from './providers/ollama';
import { OpenAIProvider } from './providers/openai';
import { generateBasicBSL } from './fallback';
import { normalizeYAML } from '../../../utils/yaml/parser';
import type { CapturedAction } from '../../content/recording/types';

/**
 * Result of BSL generation
 */
export interface GenerateBSLResult {
  /** Generated BSL YAML string */
  bsl: string;
  /** Whether an LLM was used (false = fallback generator) */
  usedLLM: boolean;
}

/**
 * LLM service status
 */
export interface LLMServiceStatus {
  /** Current provider name or null if not configured */
  provider: string | null;
  /** Whether provider credentials are configured */
  configured: boolean;
  /** Whether service is initialized */
  initialized: boolean;
}

/**
 * LLM Service class providing unified BSL generation interface
 *
 * Features:
 * - Provider abstraction (Claude, Ollama)
 * - Automatic fallback to basic generation on provider failure
 * - Lazy provider initialization
 * - Status reporting
 */
export class LLMService {
  private provider: LLMProvider | null = null;
  private config: LLMConfig | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the LLM service with configuration
   * Creates the appropriate provider based on config
   * @param config - LLM configuration
   */
  async initialize(config: LLMConfig): Promise<void> {
    console.log('[LLM Service] Initialize called with:', {
      provider: config.provider,
      hasApiKey: !!config.claudeApiKey,
      apiKeyLength: config.claudeApiKey?.length ?? 0,
      model: config.provider === 'claude' ? config.claudeModel :
             config.provider === 'openai' ? config.openaiModel : config.ollamaModel,
      ollamaHost: config.provider === 'ollama' ? config.ollamaHost : undefined,
      openaiEndpoint: config.provider === 'openai' ? config.openaiEndpoint : undefined
    });

    this.config = config;

    if (config.provider === 'claude' && config.claudeApiKey) {
      console.log('[LLM Service] Creating Claude provider');
      this.provider = new ClaudeProvider(config.claudeApiKey, config.claudeModel);
    } else if (config.provider === 'ollama') {
      console.log('[LLM Service] Creating Ollama provider');
      this.provider = new OllamaProvider(config.ollamaHost, config.ollamaModel);
    } else if (config.provider === 'openai' && config.openaiApiKey && config.openaiEndpoint) {
      console.log('[LLM Service] Creating OpenAI provider');
      this.provider = new OpenAIProvider(config.openaiEndpoint, config.openaiApiKey, config.openaiModel);
    } else {
      console.warn('[LLM Service] No provider created - missing API key or invalid config');
    }

    this.initialized = true;
    console.log('[LLM Service] Initialized, provider:', this.provider?.name ?? 'none');
  }

  /**
   * Generate raw text response from a prompt
   * Used for non-BSL generation tasks like extraction suggestions
   *
   * @param prompt - The prompt to send to the LLM
   * @returns Promise resolving to raw text response
   * @throws Error if provider not configured or fails
   */
  async generate(prompt: string): Promise<string> {
    console.log('[LLM Service] generate called with prompt length:', prompt.length);

    if (!this.provider || !this.initialized) {
      throw new Error('LLM not configured');
    }

    const available = await this.provider.isAvailable();
    if (!available) {
      throw new Error('LLM provider not available');
    }

    return this.provider.generate(prompt);
  }

  /**
   * Generate BSL script from captured actions
   * Falls back to basic generation if provider unavailable or fails
   *
   * @param actions - Array of captured user actions
   * @param startUrl - Optional URL to navigate to at script start
   * @returns Promise resolving to BSL string and whether LLM was used
   */
  async generateBSL(actions: CapturedAction[], startUrl?: string): Promise<GenerateBSLResult> {
    console.log('[LLM Service] generateBSL called with', actions.length, 'actions', startUrl ? `and startUrl: ${startUrl}` : '');
    console.log('[LLM Service] State: provider=', this.provider?.name ?? 'none', 'initialized=', this.initialized);

    // No provider configured - use fallback
    if (!this.provider || !this.initialized) {
      console.warn('[LLM Service] No provider or not initialized, using fallback');
      const rawBsl = generateBasicBSL(actions, startUrl);
      const normalized = normalizeYAML(rawBsl);
      return {
        bsl: normalized.success ? normalized.content : rawBsl,
        usedLLM: false,
      };
    }

    try {
      // Check provider availability
      console.log('[LLM Service] Checking provider availability...');
      const available = await this.provider.isAvailable();
      console.log('[LLM Service] Provider available:', available);

      if (!available) {
        console.warn('[LLM Service] Provider not available, using fallback');
        const rawBsl = generateBasicBSL(actions, startUrl);
        const normalized = normalizeYAML(rawBsl);
        return {
          bsl: normalized.success ? normalized.content : rawBsl,
          usedLLM: false,
        };
      }

      // Generate with LLM
      console.log('[LLM Service] Generating BSL with LLM...');
      const rawBsl = await this.provider.generateBSL(actions, startUrl);

      // Normalize YAML indentation
      const normalized = normalizeYAML(rawBsl);
      const bsl = normalized.success ? normalized.content : rawBsl;
      if (normalized.success && normalized.changed) {
        console.log('[LLM Service] YAML normalized (fixed indentation)');
      }

      console.log('[LLM Service] BSL generated successfully with LLM');
      return {
        bsl,
        usedLLM: true,
      };
    } catch (error) {
      console.error('[LLM Service] Provider failed, using fallback:', error);
      const rawBsl = generateBasicBSL(actions, startUrl);
      const normalized = normalizeYAML(rawBsl);
      return {
        bsl: normalized.success ? normalized.content : rawBsl,
        usedLLM: false,
      };
    }
  }

  /**
   * Get current service status
   * @returns Service status object
   */
  getStatus(): LLMServiceStatus {
    return {
      provider: this.provider?.name ?? null,
      configured: this.isConfigured(),
      initialized: this.initialized,
    };
  }

  /**
   * Check if service is configured with valid credentials
   * @returns True if configuration has required credentials for selected provider
   */
  isConfigured(): boolean {
    if (!this.config) {
      return false;
    }

    if (this.config.provider === 'claude') {
      return !!this.config.claudeApiKey;
    }

    if (this.config.provider === 'ollama') {
      // Ollama doesn't require credentials, just needs to be selected
      return true;
    }

    if (this.config.provider === 'openai') {
      return !!this.config.openaiApiKey && !!this.config.openaiEndpoint;
    }

    return false;
  }
}

// Singleton instance
let instance: LLMService | null = null;

/**
 * Get the singleton LLM service instance
 * @returns LLMService singleton
 */
export function getLLMService(): LLMService {
  if (!instance) {
    instance = new LLMService();
  }
  return instance;
}

/**
 * Storage key for LLM configuration
 * Must match the key used in sidepanel/stores/llmConfig.ts
 */
const STORAGE_KEY = 'browserlet_llm_config';

/**
 * Initialize LLM service from stored configuration
 * Called at service worker startup to restore LLM state
 *
 * This handles the case where the service worker restarts and loses
 * the in-memory LLM configuration. It reloads from chrome.storage.local
 * and re-initializes the service.
 */
export async function initializeLLMFromStorage(): Promise<void> {
  console.log('[LLM Service] Initializing from storage...');

  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as {
      provider: 'claude' | 'ollama' | 'openai';
      claudeModel?: string;
      ollamaHost?: string;
      ollamaModel?: string;
      encryptedApiKey?: { ciphertext: string; iv: string };
      openaiEndpoint?: string;
      openaiModel?: string;
      encryptedOpenaiApiKey?: { ciphertext: string; iv: string };
    } | undefined;

    if (!stored) {
      console.log('[LLM Service] No stored config found');
      return;
    }

    console.log('[LLM Service] Found stored config for provider:', stored.provider);

    // Import decryption function dynamically to avoid circular dependencies
    const { decryptApiKey } = await import('../../../utils/crypto/encryption');

    const config: LLMConfig = {
      provider: stored.provider,
      claudeModel: stored.claudeModel ?? 'claude-sonnet-4-5-20250514',
      ollamaHost: stored.ollamaHost ?? 'http://localhost:11434',
      ollamaModel: stored.ollamaModel ?? 'llama3.1',
      openaiEndpoint: stored.openaiEndpoint ?? 'https://api.openai.com/v1/chat/completions',
      openaiModel: stored.openaiModel ?? 'gpt-4o',
    };

    // Decrypt API keys based on provider
    if (stored.provider === 'claude' && stored.encryptedApiKey) {
      try {
        config.claudeApiKey = await decryptApiKey(stored.encryptedApiKey);
        console.log('[LLM Service] Claude API key decrypted successfully');
      } catch (error) {
        console.warn('[LLM Service] Failed to decrypt Claude API key:', error);
        // Continue without key - isConfigured() will return false
      }
    } else if (stored.provider === 'openai' && stored.encryptedOpenaiApiKey) {
      try {
        config.openaiApiKey = await decryptApiKey(stored.encryptedOpenaiApiKey);
        console.log('[LLM Service] OpenAI API key decrypted successfully');
      } catch (error) {
        console.warn('[LLM Service] Failed to decrypt OpenAI API key:', error);
        // Continue without key - isConfigured() will return false
      }
    }
    // Ollama doesn't need API key

    // Initialize the service
    const service = getLLMService();
    await service.initialize(config);

    console.log('[LLM Service] Initialized from storage, configured:', service.isConfigured());
  } catch (error) {
    console.error('[LLM Service] Failed to initialize from storage:', error);
  }
}

// Re-export types for convenience
export type { LLMConfig, LLMProvider } from './providers/types';
