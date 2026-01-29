/**
 * LLM Service facade with provider abstraction and fallback
 * Provides unified interface for BSL generation across different providers
 */

import type { LLMProvider, LLMConfig } from './providers/types';
import { ClaudeProvider } from './providers/claude';
import { OllamaProvider } from './providers/ollama';
import { generateBasicBSL } from './fallback';
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
    this.config = config;

    if (config.provider === 'claude' && config.claudeApiKey) {
      this.provider = new ClaudeProvider(config.claudeApiKey, config.claudeModel);
    } else if (config.provider === 'ollama') {
      this.provider = new OllamaProvider(config.ollamaHost, config.ollamaModel);
    }

    this.initialized = true;
  }

  /**
   * Generate BSL script from captured actions
   * Falls back to basic generation if provider unavailable or fails
   *
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL string and whether LLM was used
   */
  async generateBSL(actions: CapturedAction[]): Promise<GenerateBSLResult> {
    // No provider configured - use fallback
    if (!this.provider || !this.initialized) {
      return {
        bsl: generateBasicBSL(actions),
        usedLLM: false,
      };
    }

    try {
      // Check provider availability
      const available = await this.provider.isAvailable();
      if (!available) {
        console.warn('[LLM] Provider not available, using fallback');
        return {
          bsl: generateBasicBSL(actions),
          usedLLM: false,
        };
      }

      // Generate with LLM
      const bsl = await this.provider.generateBSL(actions);
      return {
        bsl,
        usedLLM: true,
      };
    } catch (error) {
      console.error('[LLM] Provider failed, using fallback:', error);
      return {
        bsl: generateBasicBSL(actions),
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

// Re-export types for convenience
export type { LLMConfig, LLMProvider } from './providers/types';
