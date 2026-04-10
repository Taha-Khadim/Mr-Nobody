export interface ChatOptions {
  model: string;
  maxTokens?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
}

export interface StreamChunk {
  text: string;
}

export interface ImageGenOptions {
  model?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface TTSOptions {
  model?: string;
  voice: string;
}

export interface AnthropicAdapterConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface OpenAIMediaAdapterConfig {
  apiKey: string;
  baseUrl?: string;
}
