import type { SqliteStore } from './sqlite/database';

const API_KEY_SETTING = 'openai_api_key_encrypted';

export interface CredentialCipher {
  isAvailable(): boolean;
  encrypt(value: string): string;
  decrypt(value: string): string;
}

export class CredentialStore {
  constructor(private readonly store: Pick<SqliteStore, 'getSetting' | 'setSetting' | 'deleteSetting'>, private readonly cipher: CredentialCipher) {}

  hasApiKey(): boolean {
    return this.getApiKey() !== null;
  }

  getApiKey(): string | null {
    const environmentKey = process.env.OPENAI_API_KEY?.trim();
    if (environmentKey) return environmentKey;
    const encrypted = this.store.getSetting(API_KEY_SETTING);
    if (!encrypted) return null;
    try {
      return this.cipher.decrypt(encrypted);
    } catch {
      return null;
    }
  }

  setApiKey(value: string): void {
    const key = value.trim();
    if (!key) throw new Error('API key cannot be empty');
    if (!this.cipher.isAvailable()) throw new Error('Secure credential storage is unavailable on this system');
    this.store.setSetting(API_KEY_SETTING, this.cipher.encrypt(key));
  }

  clearApiKey(): void { this.store.deleteSetting(API_KEY_SETTING); }
}
