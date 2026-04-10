import { create } from 'zustand';

import { PRIMARY_CHAT_MODEL_ID } from '@/constants/models';
import * as SecureKeys from '@/storage/secureKeys';
import type { APIProvider } from '@/types';

type ProviderState = {
  anthropicKey: string | null;
  openaiKey: string | null;
  hydrated: boolean;
  /** In-memory provider used for Anthropic chat */
  anthropicProvider: APIProvider | null;
  setAnthropicKey: (key: string) => Promise<void>;
  setOpenAIKey: (key: string) => Promise<void>;
  hydrateFromSecureStore: () => Promise<void>;
  buildAnthropicProvider: () => APIProvider | null;
  clearKeys: () => Promise<void>;
};

function makeAnthropicProvider(apiKey: string): APIProvider {
  return {
    id: 'anthropic-primary',
    type: 'anthropic',
    name: 'Anthropic',
    apiKey,
    models: [
      {
        id: PRIMARY_CHAT_MODEL_ID,
        name: 'Claude Opus 4.6',
        contextWindow: 200000,
        capabilities: ['chat', 'vision', 'function-calling'],
      },
    ],
    capabilities: [
      { type: 'chat', models: [PRIMARY_CHAT_MODEL_ID] },
      {
        type: 'vision',
        models: [PRIMARY_CHAT_MODEL_ID],
        supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      },
    ],
    isActive: true,
  };
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  anthropicKey: null,
  openaiKey: null,
  hydrated: false,
  anthropicProvider: null,

  setAnthropicKey: async (key: string) => {
    await SecureKeys.saveAnthropicKey(key);
    set({
      anthropicKey: key,
      anthropicProvider: makeAnthropicProvider(key),
    });
  },

  setOpenAIKey: async (key: string) => {
    await SecureKeys.saveOpenAIKey(key);
    set({ openaiKey: key });
  },

  hydrateFromSecureStore: async () => {
    const [a, o] = await Promise.all([
      SecureKeys.loadAnthropicKey(),
      SecureKeys.loadOpenAIKey(),
    ]);
    set({
      anthropicKey: a,
      openaiKey: o,
      anthropicProvider: a ? makeAnthropicProvider(a) : null,
      hydrated: true,
    });
  },

  buildAnthropicProvider: () => get().anthropicProvider,

  clearKeys: async () => {
    await SecureKeys.clearAllKeys();
    set({
      anthropicKey: null,
      openaiKey: null,
      anthropicProvider: null,
    });
  },
}));
