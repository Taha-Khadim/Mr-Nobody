export type ProviderType = 'openai' | 'anthropic' | 'custom';

export type CapabilityType =
  | 'chat'
  | 'vision'
  | 'image-generation'
  | 'audio-transcription'
  | 'audio-generation'
  | 'embeddings'
  | 'function-calling';

export interface Capability {
  type: CapabilityType;
  models: string[];
  maxFileSize?: number;
  supportedFormats?: string[];
}

export interface RateLimitConfig {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
}

export interface Model {
  id: string;
  name: string;
  contextWindow: number;
  capabilities: CapabilityType[];
  maxTokens?: number;
  pricing?: { input: number; output: number };
}

export interface APIProvider {
  id: string;
  type: ProviderType;
  name: string;
  apiKey: string;
  baseUrl?: string;
  models: Model[];
  capabilities: Capability[];
  isActive: boolean;
  rateLimits?: RateLimitConfig;
}

/** Standard = default assistant; Agentic = planning / tool-oriented system prompt (tools can be wired later). */
export type ChatMode = 'standard' | 'agentic';

export interface Conversation {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  personaId?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tokensUsed: number;
  metadata: {
    isMultimodal: boolean;
    chatMode: ChatMode;
    lastCapabilityUsed?: string;
  };
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; uri: string; mimeType: string; caption?: string }
  | { type: 'audio'; uri: string; duration: number; transcript?: string }
  | { type: 'video'; uri: string; thumbnail?: string; duration: number }
  | { type: 'file'; uri: string; name: string; mimeType: string; sizeBytes?: number };

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: MessageContent[];
  timestamp: number;
  tokens?: number;
  metadata: {
    model?: string;
    provider?: string;
    latency?: number;
    finishReason?: string;
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Persona {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  systemPrompt: string;
  voice?: {
    provider: 'openai' | 'elevenlabs' | 'native';
    voiceId: string;
    settings?: object;
  };
  capabilities: CapabilityType[];
  memoryWindow?: number;
  tools?: Tool[];
  createdAt: number;
  isDefault: boolean;
}
