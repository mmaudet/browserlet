import { describe, it, expect, vi } from 'vitest';
import { extractCredentialRefs, substituteCredentials, CREDENTIAL_PATTERN } from '../../../utils/passwords/substitution';
import type { StoredPassword } from '../../../utils/passwords/types';
import * as storage from '../../../utils/passwords/storage';

describe('extractCredentialRefs', () => {
  it('should extract single credential reference', () => {
    const text = '{{credential:github_pwd}}';
    const refs = extractCredentialRefs(text);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      original: '{{credential:github_pwd}}',
      name: 'github_pwd'
    });
  });

  it('should extract multiple credential references', () => {
    const text = 'hello {{credential:a}} world {{credential:b}}';
    const refs = extractCredentialRefs(text);

    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({
      original: '{{credential:a}}',
      name: 'a'
    });
    expect(refs[1]).toEqual({
      original: '{{credential:b}}',
      name: 'b'
    });
  });

  it('should return empty array for no matches', () => {
    const text = 'no credentials here';
    const refs = extractCredentialRefs(text);

    expect(refs).toEqual([]);
  });

  it('should return empty array for empty input', () => {
    const text = '';
    const refs = extractCredentialRefs(text);

    expect(refs).toEqual([]);
  });

  it('should support alphanumeric, dash, and underscore in names', () => {
    const text = '{{credential:valid-name_123}}';
    const refs = extractCredentialRefs(text);

    expect(refs).toHaveLength(1);
    expect(refs[0].name).toBe('valid-name_123');
  });

  it('should not match empty credential names', () => {
    const text = '{{credential:}}';
    const refs = extractCredentialRefs(text);

    expect(refs).toEqual([]);
  });

  it('should not match credential names with spaces', () => {
    const text = '{{credential:has space}}';
    const refs = extractCredentialRefs(text);

    expect(refs).toEqual([]);
  });
});

describe('substituteCredentials', () => {
  it('should replace credential reference with decrypted password', async () => {
    const text = 'pass={{credential:test}}';
    const passwords: StoredPassword[] = [{
      id: 'test',
      url: 'example.com',
      username: 'user',
      encryptedPassword: { iv: 'mockIv', ciphertext: 'mockData' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];

    // Mock getDecryptedPassword to return a known value
    const mockDecrypt = vi.spyOn(storage, 'getDecryptedPassword');
    mockDecrypt.mockResolvedValue('actualPassword');

    const result = await substituteCredentials(text, passwords);

    expect(result).toBe('pass=actualPassword');
    expect(mockDecrypt).toHaveBeenCalledWith(passwords[0]);

    mockDecrypt.mockRestore();
  });

  it('should return unchanged text when no references present', async () => {
    const text = 'no refs';
    const passwords: StoredPassword[] = [];

    const result = await substituteCredentials(text, passwords);

    expect(result).toBe('no refs');
  });

  it('should throw error for missing credential', async () => {
    const text = '{{credential:missing}}';
    const passwords: StoredPassword[] = [{
      id: 'other',
      url: 'example.com',
      username: 'user',
      encryptedPassword: { iv: 'mockIv', ciphertext: 'mockData' },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }];

    await expect(substituteCredentials(text, passwords))
      .rejects
      .toThrow('Credential not found: "missing"');
  });

  it('should substitute multiple credential references', async () => {
    const text = 'user={{credential:usr}} pass={{credential:pwd}}';
    const passwords: StoredPassword[] = [
      {
        id: 'usr',
        url: 'example.com',
        username: 'user',
        encryptedPassword: { iv: 'mockIv1', ciphertext: 'mockData1' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'pwd',
        url: 'example.com',
        username: 'user',
        encryptedPassword: { iv: 'mockIv2', ciphertext: 'mockData2' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    const mockDecrypt = vi.spyOn(storage, 'getDecryptedPassword');
    mockDecrypt.mockImplementation(async (entry) => {
      if (entry.id === 'usr') return 'testuser';
      if (entry.id === 'pwd') return 'testpass';
      return '';
    });

    const result = await substituteCredentials(text, passwords);

    expect(result).toBe('user=testuser pass=testpass');
    expect(mockDecrypt).toHaveBeenCalledTimes(2);

    mockDecrypt.mockRestore();
  });
});

describe('CREDENTIAL_PATTERN', () => {
  it('should be a global regex', () => {
    expect(CREDENTIAL_PATTERN.global).toBe(true);
  });

  it('should match valid credential syntax', () => {
    const pattern = new RegExp(CREDENTIAL_PATTERN.source, CREDENTIAL_PATTERN.flags);
    const match = pattern.exec('{{credential:test}}');

    expect(match).not.toBeNull();
    expect(match?.[1]).toBe('test');
  });
});
