/**
 * HTTP bridge server for secure credential exchange between CLI and extension.
 *
 * Security properties:
 * - Binds to 127.0.0.1 ONLY (prevents remote access)
 * - One-time bearer tokens (invalidated immediately after single use)
 * - 60-second token expiry (configurable for testing)
 * - Tokens are 32-byte (256-bit) random hex strings
 * - NEVER logs or exposes credential values in error responses
 *
 * The bridge is decoupled from vault storage via the getDecryptedCredential callback.
 *
 * @see packages/cli/src/vault/encryption.ts (encryption primitives)
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';

/** Token data stored in the active tokens map */
export interface TokenData {
  /** The credential ID this token is authorized to retrieve */
  credentialId: string;
  /** Timestamp (ms) when this token expires */
  expiresAt: number;
}

/** Options for creating a BridgeServer */
export interface BridgeServerOptions {
  /** Port to listen on (default: 9876) */
  port?: number;
  /** Callback to retrieve a decrypted credential by ID */
  getDecryptedCredential: (id: string) => Promise<string>;
}

/**
 * HTTP bridge server with one-time token authentication.
 *
 * Usage:
 * 1. Create server with getDecryptedCredential callback
 * 2. Call start() to begin listening
 * 3. Generate tokens with generateToken(credentialId)
 * 4. Client uses token once to GET /credential
 * 5. Token is invalidated immediately after use
 */
export class BridgeServer {
  private readonly port: number;
  private readonly getDecryptedCredential: (id: string) => Promise<string>;
  private readonly activeTokens: Map<string, TokenData> = new Map();
  private server: Server | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: BridgeServerOptions) {
    this.port = options.port ?? 9876;
    this.getDecryptedCredential = options.getDecryptedCredential;
  }

  /**
   * Generate a one-time bearer token for a credential.
   *
   * @param credentialId - The credential this token authorizes access to
   * @param expiresInMs - Token lifetime in ms (default: 60000 = 60 seconds). Override for testing.
   * @returns 64-character hex string (32 random bytes)
   */
  generateToken(credentialId: string, expiresInMs: number = 60_000): string {
    const token = randomBytes(32).toString('hex');
    this.activeTokens.set(token, {
      credentialId,
      expiresAt: Date.now() + expiresInMs,
    });
    return token;
  }

  /**
   * Validate and consume a token (single-use).
   *
   * Token is deleted from the map immediately upon lookup, before any other checks.
   * This ensures the token can never be reused even if subsequent operations fail.
   *
   * @param providedToken - The token string from the Authorization header
   * @returns The credentialId if valid, null if invalid/expired/already-used
   */
  private validateAndConsumeToken(providedToken: string): string | null {
    const stored = this.activeTokens.get(providedToken);
    if (!stored) {
      return null;
    }

    // Delete immediately -- single-use, no matter what happens next
    this.activeTokens.delete(providedToken);

    // Check expiry
    if (stored.expiresAt < Date.now()) {
      return null;
    }

    return stored.credentialId;
  }

  /**
   * Handle incoming HTTP requests.
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS headers for extension communication
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '/';

    // Route: GET /health
    if (url === '/health' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Route: GET /credential
    if (url === '/credential' && req.method === 'GET') {
      await this.handleCredentialRequest(req, res);
      return;
    }

    // 404 for everything else
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * Handle GET /credential -- requires valid Bearer token.
   */
  private async handleCredentialRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const authHeader = req.headers.authorization;

    // Check for Authorization header with Bearer scheme
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Missing authorization' }));
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (!token) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Missing authorization' }));
      return;
    }

    // Validate and consume the one-time token
    const credentialId = this.validateAndConsumeToken(token);

    if (credentialId === null) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid or expired token' }));
      return;
    }

    // Retrieve the decrypted credential value
    try {
      const value = await this.getDecryptedCredential(credentialId);
      res.writeHead(200);
      res.end(JSON.stringify({ value }));
    } catch {
      // NEVER include credential values or error details in the response
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to retrieve credential' }));
    }
  }

  /**
   * Start the bridge server, binding to 127.0.0.1 ONLY.
   *
   * IMPORTANT: Uses '127.0.0.1' explicitly, NOT 'localhost' (which could
   * resolve to IPv6 ::1 on some systems) and NOT '0.0.0.0' (which would
   * accept remote connections).
   */
  async start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server = createServer((req, res) => {
        // Fire-and-forget the async handler; errors are caught inside handleRequest
        this.handleRequest(req, res).catch(() => {
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      });

      this.server.on('error', reject);

      // CRITICAL: Bind to 127.0.0.1 only
      this.server.listen(this.port, '127.0.0.1', () => {
        this.startTokenCleanup();
        resolve();
      });
    });
  }

  /**
   * Stop the bridge server and clean up resources.
   */
  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.activeTokens.clear();

    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        this.server = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the underlying HTTP server (for testing/inspection).
   */
  getServer(): Server | null {
    return this.server;
  }

  /**
   * Start periodic cleanup of expired tokens (every 60 seconds).
   */
  private startTokenCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [token, data] of this.activeTokens) {
        if (data.expiresAt < now) {
          this.activeTokens.delete(token);
        }
      }
    }, 60_000);

    // Don't keep the process alive just for cleanup
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

/**
 * Convenience factory for creating a BridgeServer.
 *
 * @param options - Server configuration with getDecryptedCredential callback
 * @returns A new BridgeServer instance (not yet started)
 */
export function createBridgeServer(options: BridgeServerOptions): BridgeServer {
  return new BridgeServer(options);
}
