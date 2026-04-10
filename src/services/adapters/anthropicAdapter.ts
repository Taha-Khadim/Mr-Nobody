import { fetch } from 'expo/fetch';
import * as FileSystem from 'expo-file-system/legacy';

import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_MESSAGES_URL,
  PRIMARY_CHAT_MODEL_ID,
} from '@/constants/models';
import type { Message, MessageContent } from '@/types';
import { isProbablyTextMime, MAX_TEXT_FILE_CHARS } from '@/utils/fileAttachments';

import type { AnthropicAdapterConfig, ChatOptions, StreamChunk } from './adapterTypes';

async function readImageBase64(uri: string, mimeType: string): Promise<{ data: string; media_type: string }> {
  if (uri.startsWith('https://') || uri.startsWith('http://')) {
    const res = await fetch(uri);
    if (!res.ok) throw new Error(`Failed to load image URL: ${res.status}`);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    const ct = res.headers.get('content-type')?.split(';')[0]?.trim() ?? mimeType;
    return { data: b64, media_type: ct || 'image/png' };
  }
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { data: b64, media_type: mimeType };
}

async function contentToBlocks(parts: MessageContent[]): Promise<unknown[]> {
  const blocks: unknown[] = [];
  for (const c of parts) {
    if (c.type === 'text') {
      blocks.push({ type: 'text', text: c.text });
      continue;
    }
    if (c.type === 'image') {
      const { data, media_type } = await readImageBase64(c.uri, c.mimeType);
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type,
          data,
        },
      });
      continue;
    }
    if (c.type === 'audio') {
      blocks.push({
        type: 'text',
        text: c.transcript?.trim()
          ? `[Voice message, ${c.duration}s]: ${c.transcript}`
          : `[Voice message, ${c.duration}s — transcribe with OpenAI Whisper to attach text]`,
      });
      continue;
    }
    if (c.type === 'video') {
      blocks.push({
        type: 'text',
        text: `[Video ${c.duration}s — attach frames as images for vision]`,
      });
      continue;
    }
    if (c.type === 'file') {
      const mt = c.mimeType.toLowerCase();
      const nameLower = c.name.toLowerCase();
      const isPdf = mt === 'application/pdf' || nameLower.endsWith('.pdf');
      if (isPdf) {
        const b64 = await FileSystem.readAsStringAsync(c.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        blocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: b64,
          },
        });
        continue;
      }
      if (
        isProbablyTextMime(mt) ||
        /\.(txt|md|csv|json|ts|tsx|js|jsx|mjs|cjs|py|rs|go|ya?ml|html?|css|xml)$/i.test(c.name)
      ) {
        let text = await FileSystem.readAsStringAsync(c.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (text.length > MAX_TEXT_FILE_CHARS) {
          text = `${text.slice(0, MAX_TEXT_FILE_CHARS)}\n\n[…truncated for context limit]`;
        }
        blocks.push({
          type: 'text',
          text: `[File: ${c.name}]\n\n${text}`,
        });
        continue;
      }
      blocks.push({
        type: 'text',
        text: `[Attached: ${c.name} (${c.mimeType}) — send as PDF or a text-based file for full content.]`,
      });
    }
  }
  return blocks;
}

/** Extract incremental text from Anthropic SSE JSON lines. */
function deltaTextFromEvent(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const e = obj as Record<string, unknown>;
  if (e.type === 'content_block_delta' && e.delta && typeof e.delta === 'object') {
    const d = e.delta as Record<string, unknown>;
    if (d.type === 'text_delta' && typeof d.text === 'string') return d.text;
    if (typeof d.text === 'string') return d.text;
  }
  return null;
}

export class AnthropicAdapter {
  constructor(private readonly config: AnthropicAdapterConfig) {}

  async *chat(
    messages: Message[],
    options: ChatOptions,
    preparedContentByMessageId?: Map<string, unknown[]>
  ): AsyncIterable<StreamChunk> {
    const url = this.config.baseUrl
      ? `${this.config.baseUrl.replace(/\/$/, '')}/v1/messages`
      : ANTHROPIC_MESSAGES_URL;

    const apiMessages: { role: 'user' | 'assistant'; content: unknown }[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        continue;
      }
      const role = m.role === 'user' ? 'user' : 'assistant';
      let content: unknown;
      if (preparedContentByMessageId?.has(m.id)) {
        content = preparedContentByMessageId.get(m.id);
      } else if (role === 'user') {
        content = await contentToBlocks(m.content);
      } else {
        content = m.content
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => ({ type: 'text', text: p.text }));
      }
      apiMessages.push({ role, content });
    }

    let systemText = options.systemPrompt ?? '';
    for (const m of messages) {
      if (m.role !== 'system') continue;
      const t = m.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      systemText = systemText ? `${systemText}\n${t}` : t;
    }
    const system =
      systemText.length > 0 ? [{ type: 'text', text: systemText }] : undefined;

    const body = {
      model: options.model,
      max_tokens: options.maxTokens ?? 8192,
      stream: true,
      ...(system ? { system } : {}),
      messages: apiMessages,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('No response body — streaming may be unsupported. Try updating Expo / use a dev client.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let yielded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          const text = deltaTextFromEvent(evt);
          if (text) {
            yielded += text.length;
            yield { text };
          }
        } catch {
          /* incomplete line */
        }
      }
    }

    if (buffer.trim()) {
      const t = buffer.trim();
      if (t.startsWith('data:')) {
        try {
          const payload = t.slice(5).trim();
          const evt = JSON.parse(payload);
          const text = deltaTextFromEvent(evt);
          if (text) {
            yielded += text.length;
            yield { text };
          }
        } catch {
          /* ignore */
        }
      }
    }

    if (yielded === 0) {
      throw new Error(
        'No text received from Claude. Check PRIMARY_CHAT_MODEL_ID in src/constants/models.ts matches your Anthropic account.'
      );
    }
  }

  async validateKey(): Promise<boolean> {
    try {
      const url = this.config.baseUrl
        ? `${this.config.baseUrl.replace(/\/$/, '')}/v1/messages`
        : ANTHROPIC_MESSAGES_URL;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify({
          model: PRIMARY_CHAT_MODEL_ID,
          max_tokens: 8,
          stream: false,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Reply with OK only.' }] }],
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
