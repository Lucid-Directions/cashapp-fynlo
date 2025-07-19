/**
 * Secure Storage Service
 * 
 * Provides a secure wrapper around AsyncStorage with:
 * - Encryption for sensitive data
 * - Key prefixing to prevent collisions
 * - Type safety with generics
 * - Automatic JSON serialization/deserialization
 * - Error handling and logging
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { info, error, warn } from './LoggingService';
import { IS_DEV } from '../env';

// Storage key prefixes
const STORAGE_PREFIX = '@fynlo_';
const SENSITIVE_PREFIX = '@fynlo_secure_';

// Keys that should always be encrypted
const SENSITIVE_KEYS = [
  'auth_token',
  'refresh_token',
  'user_credentials',
  'api_keys',
  'payment_tokens',
  'session_data',
  'bank_details',
  'card_information'
];

interface StorageOptions {
  encrypt?: boolean;
  expiresIn?: number; // milliseconds
}

interface StoredData<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
  encrypted: boolean;
}

class SecureStorageService {
  private static instance: SecureStorageService;
  private encryptionKey: string;

  private constructor() {
    // In production, this should be derived from a secure source
    // For now, using a device-specific key
    this.encryptionKey = this.generateDeviceKey();
  }

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  private generateDeviceKey(): string {
    // In a real implementation, this would use:
    // - Device unique ID
    // - Keychain/Keystore for additional security
    // - Possibly biometric authentication
    const baseKey = 'FynloPOS_2025_SecureStorage';
    
    // Add some entropy based on installation
    const installTime = Date.now().toString();
    return CryptoJS.SHA256(baseKey + installTime).toString();
  }

  private shouldEncrypt(key: string, options?: StorageOptions): boolean {
    if (options?.encrypt !== undefined) {
      return options.encrypt;
    }
    
    // Check if key contains sensitive patterns
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));
  }

  private encrypt(data: string): string {
    try {
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (err) {
      error('Encryption failed', err, 'SecureStorage');
      throw new Error('Failed to encrypt data');
    }
  }

  private decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      error('Decryption failed', err, 'SecureStorage');
      throw new Error('Failed to decrypt data');
    }
  }

  private getStorageKey(key: string, sensitive: boolean = false): string {
    const prefix = sensitive ? SENSITIVE_PREFIX : STORAGE_PREFIX;
    return `${prefix}${key}`;
  }

  async setItem<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    try {
      const shouldEncrypt = this.shouldEncrypt(key, options);
      const storageKey = this.getStorageKey(key, shouldEncrypt);
      
      const data: StoredData<T> = {
        value,
        timestamp: Date.now(),
        encrypted: shouldEncrypt
      };
      
      if (options?.expiresIn) {
        data.expiresAt = Date.now() + options.expiresIn;
      }
      
      let serializedData = JSON.stringify(data);
      
      if (shouldEncrypt) {
        serializedData = this.encrypt(serializedData);
      }
      
      await AsyncStorage.setItem(storageKey, serializedData);
      
      info(`Stored ${shouldEncrypt ? 'encrypted' : 'plain'} data for key: ${key}`, undefined, 'SecureStorage');
    } catch (err) {
      error(`Failed to store item: ${key}`, err, 'SecureStorage');
      throw err;
    }
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      // Try both encrypted and non-encrypted keys
      let storageKey = this.getStorageKey(key, true);
      let rawData = await AsyncStorage.getItem(storageKey);
      
      if (!rawData) {
        storageKey = this.getStorageKey(key, false);
        rawData = await AsyncStorage.getItem(storageKey);
      }
      
      if (!rawData) {
        return null;
      }
      
      let data: StoredData<T>;
      
      // Try to decrypt if it looks encrypted
      if (rawData.charAt(0) !== '{') {
        try {
          const decrypted = this.decrypt(rawData);
          data = JSON.parse(decrypted);
        } catch (err) {
          warn(`Failed to decrypt data for key: ${key}, attempting plain parse`, undefined, 'SecureStorage');
          data = JSON.parse(rawData);
        }
      } else {
        data = JSON.parse(rawData);
      }
      
      // Check expiration
      if (data.expiresAt && data.expiresAt < Date.now()) {
        await this.removeItem(key);
        return null;
      }
      
      return data.value;
    } catch (err) {
      error(`Failed to get item: ${key}`, err, 'SecureStorage');
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      // Remove both encrypted and non-encrypted versions
      const encryptedKey = this.getStorageKey(key, true);
      const plainKey = this.getStorageKey(key, false);
      
      await AsyncStorage.multiRemove([encryptedKey, plainKey]);
      
      info(`Removed item: ${key}`, undefined, 'SecureStorage');
    } catch (err) {
      error(`Failed to remove item: ${key}`, err, 'SecureStorage');
      throw err;
    }
  }

  async clear(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const fynloKeys = allKeys.filter(key => 
        key.startsWith(STORAGE_PREFIX) || key.startsWith(SENSITIVE_PREFIX)
      );
      
      if (fynloKeys.length > 0) {
        await AsyncStorage.multiRemove(fynloKeys);
        info(`Cleared ${fynloKeys.length} items from secure storage`, undefined, 'SecureStorage');
      }
    } catch (err) {
      error('Failed to clear storage', err, 'SecureStorage');
      throw err;
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      return allKeys
        .filter(key => key.startsWith(STORAGE_PREFIX) || key.startsWith(SENSITIVE_PREFIX))
        .map(key => key.replace(STORAGE_PREFIX, '').replace(SENSITIVE_PREFIX, ''));
    } catch (err) {
      error('Failed to get all keys', err, 'SecureStorage');
      return [];
    }
  }

  // Batch operations
  async multiSet(items: Array<[string, any, StorageOptions?]>): Promise<void> {
    try {
      const promises = items.map(([key, value, options]) => 
        this.setItem(key, value, options)
      );
      await Promise.all(promises);
    } catch (err) {
      error('Failed to set multiple items', err, 'SecureStorage');
      throw err;
    }
  }

  async multiGet<T>(keys: string[]): Promise<Array<[string, T | null]>> {
    try {
      const promises = keys.map(async key => {
        const value = await this.getItem<T>(key);
        return [key, value] as [string, T | null];
      });
      return Promise.all(promises);
    } catch (err) {
      error('Failed to get multiple items', err, 'SecureStorage');
      throw err;
    }
  }

  // Migration helper for existing AsyncStorage usage
  async migrateFromAsyncStorage(key: string, options?: StorageOptions): Promise<void> {
    try {
      const existingValue = await AsyncStorage.getItem(key);
      if (existingValue !== null) {
        const parsedValue = JSON.parse(existingValue);
        await this.setItem(key, parsedValue, options);
        await AsyncStorage.removeItem(key);
        info(`Migrated key to secure storage: ${key}`, undefined, 'SecureStorage');
      }
    } catch (err) {
      warn(`Failed to migrate key: ${key}`, err, 'SecureStorage');
    }
  }

  // Utility to check storage usage
  async getStorageInfo(): Promise<{
    totalKeys: number;
    encryptedKeys: number;
    plainKeys: number;
    approximateSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const fynloKeys = allKeys.filter(key => 
        key.startsWith(STORAGE_PREFIX) || key.startsWith(SENSITIVE_PREFIX)
      );
      
      const encryptedKeys = fynloKeys.filter(key => key.startsWith(SENSITIVE_PREFIX));
      const plainKeys = fynloKeys.filter(key => key.startsWith(STORAGE_PREFIX));
      
      // Calculate approximate size
      let totalSize = 0;
      for (const key of fynloKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }
      
      return {
        totalKeys: fynloKeys.length,
        encryptedKeys: encryptedKeys.length,
        plainKeys: plainKeys.length,
        approximateSize: totalSize
      };
    } catch (err) {
      error('Failed to get storage info', err, 'SecureStorage');
      return {
        totalKeys: 0,
        encryptedKeys: 0,
        plainKeys: 0,
        approximateSize: 0
      };
    }
  }
}

// Export singleton instance
const secureStorage = SecureStorageService.getInstance();

// Export convenience functions
export const setItem = <T>(key: string, value: T, options?: StorageOptions) =>
  secureStorage.setItem(key, value, options);

export const getItem = <T>(key: string) =>
  secureStorage.getItem<T>(key);

export const removeItem = (key: string) =>
  secureStorage.removeItem(key);

export const clear = () =>
  secureStorage.clear();

export const getAllKeys = () =>
  secureStorage.getAllKeys();

export const multiSet = (items: Array<[string, any, StorageOptions?]>) =>
  secureStorage.multiSet(items);

export const multiGet = <T>(keys: string[]) =>
  secureStorage.multiGet<T>(keys);

export const migrateFromAsyncStorage = (key: string, options?: StorageOptions) =>
  secureStorage.migrateFromAsyncStorage(key, options);

export const getStorageInfo = () =>
  secureStorage.getStorageInfo();

export default secureStorage;