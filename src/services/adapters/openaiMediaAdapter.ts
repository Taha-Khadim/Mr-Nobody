import * as FileSystem from 'expo-file-system/legacy';

import {
  OPENAI_DEFAULT_BASE,
  OPENAI_IMAGE_MODEL_DEFAULT,
  OPENAI_TTS_MODEL_DEFAULT,
  OPENAI_WHISPER_MODEL,
} from '@/constants/models';

import type { ImageGenOptions, OpenAIMediaAdapterConfig, TTSOptions } from './adapterTypes';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // eslint-disable-next-line no-restricted-globals -- RN global
  return btoa(binary);
}

/**
 * OpenAI adapter limited to image generation and audio (Whisper + TTS).
 * Chat completions are intentionally not implemented — use Anthropic for chat.
 */
export class OpenAIMediaAdapter {
  constructor(private readonly config: OpenAIMediaAdapterConfig) {}

  private base(): string {
    return (this.config.baseUrl ?? OPENAI_DEFAULT_BASE).replace(/\/$/, '');
  }

  async generateImage(prompt: string, options: ImageGenOptions = {}): Promise<string> {
    const model = options.model ?? OPENAI_IMAGE_MODEL_DEFAULT;
    const res = await fetch(`${this.base()}/images/generations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: options.size ?? '1024x1024',
        ...(model === 'dall-e-3' ? { quality: options.quality ?? 'standard' } : {}),
        response_format: 'url',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI image ${res.status}: ${t}`);
    }
    const data = (await res.json()) as { data?: { url?: string }[] };
    const url = data.data?.[0]?.url;
    if (!url) throw new Error('OpenAI image: no URL in response');
    return url;
  }

  async transcribeAudio(audioUri: string): Promise<string> {
    const form = new FormData();
    const name = audioUri.split('/').pop() ?? 'audio.m4a';
    const blob = {
      uri: audioUri,
      name,
      type: 'audio/m4a',
    } as unknown as Blob;
    form.append('file', blob);
    form.append('model', OPENAI_WHISPER_MODEL);

    const res = await fetch(`${this.base()}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI transcription ${res.status}: ${t}`);
    }
    const json = (await res.json()) as { text?: string };
    return json.text ?? '';
  }

  /** Returns a local file URI for the synthesized speech (mp3). */
  async synthesizeSpeech(text: string, options: TTSOptions): Promise<string> {
    const model = options.model ?? OPENAI_TTS_MODEL_DEFAULT;
    const res = await fetch(`${this.base()}/audio/speech`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        voice: options.voice,
        input: text,
        response_format: 'mp3',
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI TTS ${res.status}: ${t}`);
    }
    const buf = await res.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    const out = `${FileSystem.cacheDirectory ?? ''}tts-${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(out, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return out;
  }

  async validateKey(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base()}/models`, {
        headers: { authorization: `Bearer ${this.config.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
