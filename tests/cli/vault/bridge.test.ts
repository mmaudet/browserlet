import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BridgeServer, createBridgeServer } from '../../../packages/cli/src/vault/bridge.js';
import { BridgeClient } from '../../../packages/cli/src/vault/bridgeClient.js';
import type { AddressInfo } from 'node:net';

/**
 * Bridge server security tests.
 *
 * Verifies:
 * - Localhost-only binding (127.0.0.1)
 * - One-time token invalidation
 * - Token expiry enforcement
 * - Authentication enforcement (401 for missing/invalid tokens)
 * - No credential leaks in error responses
 * - Bridge client communication
 */

// Use a random high port to avoid conflicts in CI
const TEST_PORT = 49152 + Math.floor(Math.random() * 16000);

// Known credentials for testing
const KNOWN_CREDENTIALS: Record<string, string> = {
  'cred-1': 'test_secret_value',
  'cred-2': 'another_secret_password',
};

/**
 * Mock getDecryptedCredential that returns known values.
 * Throws for unknown credential IDs.
 */
async function mockGetDecryptedCredential(id: string): Promise<string> {
  const value = KNOWN_CREDENTIALS[id];
  if (!value) {
    throw new Error(`Credential not found: ${id}`);
  }
  return value;
}

describe('Bridge Server Security', () => {
  let server: BridgeServer;
  let client: BridgeClient;
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  beforeAll(async () => {
    server = createBridgeServer({
      port: TEST_PORT,
      getDecryptedCredential: mockGetDecryptedCredential,
    });
    await server.start();

    client = new BridgeClient({
      host: '127.0.0.1',
      port: TEST_PORT,
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Token lifecycle', () => {
    it('generateToken returns a 64-char hex string (32 bytes)', () => {
      const token = server.generateToken('cred-1');
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generated token can be used once to fetch credential', async () => {
      const token = server.generateToken('cred-1');

      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.value).toBe('test_secret_value');
    });

    it('same token fails on second use (one-time)', async () => {
      const token = server.generateToken('cred-1');

      // First use: success
      const response1 = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response1.status).toBe(200);

      // Second use: failure
      const response2 = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response2.status).toBe(401);
      const body = await response2.json();
      expect(body.error).toBe('Invalid or expired token');
    });

    it('each generated token is unique', () => {
      const token1 = server.generateToken('cred-1');
      const token2 = server.generateToken('cred-1');
      expect(token1).not.toBe(token2);
    });
  });

  describe('Authentication', () => {
    it('request without Authorization header returns 401', async () => {
      const response = await fetch(`${baseUrl}/credential`);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Missing authorization');
    });

    it('request with "Bearer " (empty token) returns 401', async () => {
      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: 'Bearer ' },
      });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Missing authorization');
    });

    it('request with invalid token returns 401', async () => {
      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: 'Bearer invalid_token_value_here' },
      });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Invalid or expired token');
    });

    it('request with expired token returns 401', async () => {
      // Generate token with 1ms expiry
      const token = server.generateToken('cred-1', 1);

      // Wait for it to expire
      await new Promise((r) => setTimeout(r, 10));

      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Invalid or expired token');
    });

    it('request with non-Bearer auth scheme returns 401', async () => {
      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Missing authorization');
    });
  });

  describe('Server binding', () => {
    it('server address is 127.0.0.1', () => {
      const httpServer = server.getServer();
      expect(httpServer).not.toBeNull();
      const address = httpServer!.address() as AddressInfo;
      expect(address.address).toBe('127.0.0.1');
    });

    it('port is the configured port', () => {
      const httpServer = server.getServer();
      const address = httpServer!.address() as AddressInfo;
      expect(address.port).toBe(TEST_PORT);
    });
  });

  describe('Credential retrieval', () => {
    it('valid token returns decrypted credential value', async () => {
      const token = server.generateToken('cred-2');

      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.value).toBe('another_secret_password');
    });

    it('getDecryptedCredential error returns 500 without error details', async () => {
      const token = server.generateToken('unknown-cred-id');

      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to retrieve credential');
      // Must NOT contain credential values or stack traces
      expect(JSON.stringify(body)).not.toContain('Credential not found');
      expect(JSON.stringify(body)).not.toContain('stack');
      expect(JSON.stringify(body)).not.toContain('Error');
    });

    it('response never contains error stack traces on server error', async () => {
      const token = server.generateToken('unknown-cred-id');

      const response = await fetch(`${baseUrl}/credential`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await response.text();
      expect(text).not.toContain('at ');
      expect(text).not.toContain('.ts:');
      expect(text).not.toContain('.js:');
    });
  });

  describe('Health check', () => {
    it('GET /health returns { status: "ok" }', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    it('BridgeClient.healthCheck() returns true when server running', async () => {
      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it('BridgeClient.healthCheck() returns false when server not running', async () => {
      const deadClient = new BridgeClient({ port: TEST_PORT + 1 });
      const healthy = await deadClient.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('Bridge client', () => {
    it('BridgeClient.fetchCredential with valid token returns credential value', async () => {
      const token = server.generateToken('cred-1');
      const value = await client.fetchCredential(token);
      expect(value).toBe('test_secret_value');
    });

    it('BridgeClient.fetchCredential with invalid token throws', async () => {
      await expect(client.fetchCredential('invalid_token')).rejects.toThrow(
        /Bridge credential request failed \(401\)/
      );
    });

    it('BridgeClient.fetchCredential with used token throws', async () => {
      const token = server.generateToken('cred-1');

      // Use the token
      await client.fetchCredential(token);

      // Second use should throw
      await expect(client.fetchCredential(token)).rejects.toThrow(
        /Bridge credential request failed \(401\)/
      );
    });
  });

  describe('Routing', () => {
    it('unknown route returns 404', async () => {
      const response = await fetch(`${baseUrl}/unknown`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not found');
    });

    it('OPTIONS preflight returns 204', async () => {
      const response = await fetch(`${baseUrl}/credential`, {
        method: 'OPTIONS',
      });
      expect(response.status).toBe(204);
    });
  });

  describe('createBridgeServer factory', () => {
    it('creates a BridgeServer instance', () => {
      const s = createBridgeServer({
        getDecryptedCredential: mockGetDecryptedCredential,
      });
      expect(s).toBeInstanceOf(BridgeServer);
    });
  });
});
