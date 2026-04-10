import * as SecureStore from 'expo-secure-store';

const K_ANTHROPIC = 'api_key_anthropic';
const K_OPENAI = 'api_key_openai';

export async function saveAnthropicKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(K_ANTHROPIC, key);
}

export async function saveOpenAIKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(K_OPENAI, key);
}

export async function loadAnthropicKey(): Promise<string | null> {
  return SecureStore.getItemAsync(K_ANTHROPIC);
}

export async function loadOpenAIKey(): Promise<string | null> {
  return SecureStore.getItemAsync(K_OPENAI);
}

export async function clearAllKeys(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(K_ANTHROPIC);
  } catch {
    /* missing */
  }
  try {
    await SecureStore.deleteItemAsync(K_OPENAI);
  } catch {
    /* missing */
  }
}
