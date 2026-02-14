/**
 * HTTP client for requesting credentials from the bridge server.
 *
 * Uses Node.js global fetch() (stable since Node.js 21, available since 18).
 *
 * @see packages/cli/src/vault/bridge.ts (server implementation)
 */

/** Options for creating a BridgeClient */
export interface BridgeClientOptions {
  /** Bridge server host (default: '127.0.0.1') */
  host?: string;
  /** Bridge server port (default: 9876) */
  port?: number;
}

/**
 * Client for the credential bridge server.
 *
 * Usage:
 * 1. Create client pointing to the bridge server
 * 2. Call healthCheck() to verify server is running
 * 3. Call fetchCredential(token) with a one-time token
 */
export class BridgeClient {
  private readonly host: string;
  private readonly port: number;

  constructor(options?: BridgeClientOptions) {
    this.host = options?.host ?? '127.0.0.1';
    this.port = options?.port ?? 9876;
  }

  /** Base URL for the bridge server */
  private get baseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Fetch a decrypted credential value using a one-time bearer token.
   *
   * @param token - The one-time bearer token from BridgeServer.generateToken()
   * @returns The decrypted credential value
   * @throws Error if the request fails (invalid token, expired, server error)
   */
  async fetchCredential(token: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/credential`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `Bridge credential request failed (${response.status}): ${(body as { error?: string }).error ?? 'Unknown error'}`
      );
    }

    const body = (await response.json()) as { value: string };
    return body.value;
  }

  /**
   * Check if the bridge server is running and healthy.
   *
   * @returns true if server responds with 200 on /health, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
