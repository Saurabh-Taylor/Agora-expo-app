import 'react-native-get-random-values';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY  -  copy .env.example to .env and fill them in.',
  );
}

const SECURE_STORE_CHUNK_SIZE = 1800;
const MAX_SECURE_STORE_CHUNKS = 32;
const SECURE_STORE_VERSION = 2;
const isServerRenderEnvironment = typeof window === 'undefined';

type SecureStoreManifest = {
  version: number;
  chunkCount: number;
};

function getManifestKey(name: string) {
  return `${name}-manifest-v2`;
}

function getChunkKey(name: string, index: number) {
  return `${name}-chunk-v2-${index}`;
}

/**
 * Supabase sessions can exceed a single SecureStore value. Split the session
 * across small Keychain/Keystore-backed entries and commit a manifest only
 * after every chunk is written. Legacy AES-CTR sessions are deliberately
 * cleared because they did not include an authentication tag.
 */
class ChunkedSecureStore {
  private async readManifest(name: string): Promise<SecureStoreManifest | null> {
    const value = await SecureStore.getItemAsync(getManifestKey(name));
    if (!value) return null;

    const manifest = JSON.parse(value) as Partial<SecureStoreManifest>;
    if (
      manifest.version !== SECURE_STORE_VERSION ||
      !Number.isInteger(manifest.chunkCount) ||
      !manifest.chunkCount ||
      manifest.chunkCount < 1 ||
      manifest.chunkCount > MAX_SECURE_STORE_CHUNKS
    ) {
      throw new Error('Stored session manifest is invalid');
    }

    return manifest as SecureStoreManifest;
  }

  private async removeLegacySession(name: string) {
    await Promise.all([
      AsyncStorage.removeItem(name),
      SecureStore.deleteItemAsync(`${name}-key`),
    ]);
  }

  async getItem(name: string) {
    if (isServerRenderEnvironment) return null;

    try {
      const manifest = await this.readManifest(name);
      if (!manifest) {
        await this.removeLegacySession(name);
        return null;
      }

      const chunks: string[] = [];
      for (let index = 0; index < manifest.chunkCount; index += 1) {
        const chunk = await SecureStore.getItemAsync(getChunkKey(name, index));
        if (chunk === null) throw new Error('Stored session is incomplete');
        chunks.push(chunk);
      }
      return chunks.join('');
    } catch {
      await this.removeItem(name);
      return null;
    }
  }

  async setItem(name: string, value: string) {
    if (isServerRenderEnvironment) return;

    const chunks = Array.from(
      { length: Math.ceil(value.length / SECURE_STORE_CHUNK_SIZE) },
      (_, index) => value.slice(index * SECURE_STORE_CHUNK_SIZE, (index + 1) * SECURE_STORE_CHUNK_SIZE),
    );
    if (!chunks.length || chunks.length > MAX_SECURE_STORE_CHUNKS) {
      throw new Error('Supabase session is too large for protected storage');
    }

    const previousManifest = await this.readManifest(name).catch(() => null);
    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(getChunkKey(name, index), chunks[index]);
    }
    await SecureStore.setItemAsync(
      getManifestKey(name),
      JSON.stringify({ version: SECURE_STORE_VERSION, chunkCount: chunks.length }),
    );

    const previousCount = previousManifest?.chunkCount ?? 0;
    for (let index = chunks.length; index < previousCount; index += 1) {
      await SecureStore.deleteItemAsync(getChunkKey(name, index));
    }
    await this.removeLegacySession(name);
  }

  async removeItem(name: string) {
    if (isServerRenderEnvironment) return;

    const manifest = await this.readManifest(name).catch(() => null);
    const chunkCount = manifest?.chunkCount ?? MAX_SECURE_STORE_CHUNKS;
    const removals: Promise<void>[] = [
      SecureStore.deleteItemAsync(getManifestKey(name)),
      AsyncStorage.removeItem(name),
      SecureStore.deleteItemAsync(`${name}-key`),
    ];
    for (let index = 0; index < chunkCount; index += 1) {
      removals.push(SecureStore.deleteItemAsync(getChunkKey(name, index)));
    }
    await Promise.all(removals);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new ChunkedSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
