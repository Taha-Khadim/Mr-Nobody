import type { APIProvider, Capability, CapabilityType, ProviderType } from '@/types';

/** All conversational LLM traffic must use Anthropic (Claude Opus primary). OpenAI must not handle chat. */
export function assertChatUsesAnthropic(provider: APIProvider): void {
  if (provider.type !== 'anthropic') {
    throw new Error(
      'Chat is restricted to Anthropic. OpenAI is only used for image generation and audio (Whisper/TTS).'
    );
  }
}

export function isOpenAIChatAttempt(providerType: ProviderType): boolean {
  return providerType === 'openai';
}

export function openAiCapabilityAllowlist(): CapabilityType[] {
  return ['image-generation', 'audio-transcription', 'audio-generation'];
}

export function filterOpenAiCapabilities(raw: Capability[]): Capability[] {
  const allow = new Set(openAiCapabilityAllowlist());
  return raw.filter((c) => allow.has(c.type));
}
