import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.',
  );
}

/**
 * expo-secure-store caps values at ~2048 bytes on Android, too small for a
 * Supabase session (access + refresh token + user object). So: the session
 * blob lives in AsyncStorage encrypted with a random AES-256 key, and only
 * that small key is kept in SecureStore (Keychain/Keystore-backed) — the
 * disk-persisted blob is never plaintext, per AGENTS.md's credential-storage
 * requirement.
 */
// expo-router's web static rendering pre-renders screens on Node (no `window`,
// no native modules) — SecureStore/AsyncStorage don't work there and don't
// need to; there's no session to persist during a server-side render pass.
const isServerRenderEnvironment = typeof window === 'undefined';

class LargeSecureStore {
  private async getEncryptionKey(name: string) {
    const keyName = `${name}-key`;
    let key = await SecureStore.getItemAsync(keyName);
    if (!key) {
      key = aesjs.utils.hex.fromBytes(Crypto.getRandomBytes(32));
      await SecureStore.setItemAsync(keyName, key);
    }
    return aesjs.utils.hex.toBytes(key);
  }

  async getItem(name: string) {
    if (isServerRenderEnvironment) return null;
    const encrypted = await AsyncStorage.getItem(name);
    if (!encrypted) return null;
    const key = await this.getEncryptionKey(name);
    const [ivHex, dataHex] = encrypted.split(':');
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(aesjs.utils.hex.toBytes(ivHex)));
    const decrypted = cipher.decrypt(aesjs.utils.hex.toBytes(dataHex));
    return aesjs.utils.utf8.fromBytes(decrypted);
  }

  async setItem(name: string, value: string) {
    if (isServerRenderEnvironment) return;
    const key = await this.getEncryptionKey(name);
    const iv = Crypto.getRandomBytes(16);
    const cipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    const payload = `${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(encrypted)}`;
    await AsyncStorage.setItem(name, payload);
  }

  async removeItem(name: string) {
    if (isServerRenderEnvironment) return;
    await AsyncStorage.removeItem(name);
    await SecureStore.deleteItemAsync(`${name}-key`);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
