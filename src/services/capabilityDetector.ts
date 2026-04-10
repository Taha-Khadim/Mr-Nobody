import type { APIProvider, Capability, Model } from '@/types';

import { filterOpenAiCapabilities } from './routing';

const VISION_HINTS = ['vision', 'claude-3', 'claude-4', 'gpt-4', 'gemini'];

function hasVisionModels(models: Model[]): boolean {
  return models.some((m) =>
    VISION_HINTS.some((v) => m.id.toLowerCase().includes(v))
  );
}

function getVisionModels(models: Model[]): string[] {
  return models
    .filter((m) => VISION_HINTS.some((v) => m.id.toLowerCase().includes(v)))
    .map((m) => m.id);
}

function hasImageGenModels(models: Model[]): boolean {
  return models.some((m) =>
    ['dall-e', 'gpt-image', 'image'].some((v) => m.id.toLowerCase().includes(v))
  );
}

/**
 * Lightweight capability inference from a model list + provider type.
 * Full probing (live vision test) can be added later.
 */
export class CapabilityDetector {
  async detectCapabilities(provider: APIProvider): Promise<Capability[]> {
    const models = provider.models;
    const capabilities: Capability[] = [];

    capabilities.push({
      type: 'chat',
      models: models.map((m) => m.id),
    });

    if (hasVisionModels(models)) {
      capabilities.push({
        type: 'vision',
        models: getVisionModels(models),
        supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      });
    }

    if (provider.type === 'openai') {
      capabilities.push(
        { type: 'audio-transcription', models: ['whisper-1'] },
        { type: 'audio-generation', models: ['tts-1', 'tts-1-hd'] }
      );
    }

    if (provider.type === 'openai' && hasImageGenModels(models)) {
      capabilities.push({
        type: 'image-generation',
        models: ['dall-e-3', 'dall-e-2'],
        supportedFormats: ['png', 'jpeg'],
      });
    }

    if (provider.type === 'openai') {
      return filterOpenAiCapabilities(capabilities);
    }

    return capabilities;
  }
}
