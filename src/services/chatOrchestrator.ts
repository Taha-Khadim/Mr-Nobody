import { systemPromptForMode } from '@/constants/prompts';
import { PRIMARY_CHAT_MODEL_ID } from '@/constants/models';
import { getConversation, insertMessage, touchConversation } from '@/db/database';
import { buildClaudeMessageWindow, estimateTokens } from '@/services/contextManager';
import type { APIProvider, ChatMode, Message, Persona } from '@/types';

import { AnthropicAdapter } from './adapters/anthropicAdapter';
import { assertChatUsesAnthropic } from './routing';

/** ~180k tokens budget for long context models (approximate). */
const MAX_CONTEXT_TOKENS = 180_000;

export interface SendChatParams {
  conversationId: string;
  history: Message[];
  userMessage: Message;
  provider: APIProvider;
  modelId?: string;
  chatMode: ChatMode;
  persona?: Persona;
  signal?: AbortSignal;
}

/**
 * Streams assistant text for a chat turn and persists the assistant message when complete.
 * Applies context windowing and alternating-role merge before calling Claude.
 */
export async function streamChatResponse(
  params: SendChatParams,
  onDelta: (text: string) => void
): Promise<Message> {
  assertChatUsesAnthropic(params.provider);

  const adapter = new AnthropicAdapter({
    apiKey: params.provider.apiKey,
    baseUrl: params.provider.baseUrl,
  });

  const modelId = params.modelId ?? PRIMARY_CHAT_MODEL_ID;
  const systemPrompt = systemPromptForMode(params.chatMode, params.persona?.systemPrompt);
  const systemPromptTokens = estimateTokens(systemPrompt ?? '');

  const windowed = buildClaudeMessageWindow(params.history, params.userMessage, {
    maxContextTokens: MAX_CONTEXT_TOKENS,
    systemPromptTokens,
  });

  let assistantText = '';
  const stream = adapter.chat(windowed, {
    model: modelId,
    maxTokens: 8192,
    systemPrompt,
    signal: params.signal,
  });

  for await (const chunk of stream) {
    assistantText += chunk.text;
    onDelta(chunk.text);
  }

  const assistantMessage: Message = {
    id: `${params.conversationId}-a-${Date.now()}`,
    conversationId: params.conversationId,
    role: 'assistant',
    content: [{ type: 'text', text: assistantText }],
    timestamp: Date.now(),
    metadata: { model: modelId, provider: 'anthropic' },
  };

  await insertMessage(assistantMessage);

  const conv = await getConversation(params.conversationId);
  const nextCount = (conv?.messageCount ?? 0) + 2;
  const nextTokens = (conv?.tokensUsed ?? 0) + estimateTokens(assistantText) * 2;
  await touchConversation(params.conversationId, {
    updatedAt: Date.now(),
    messageCount: nextCount,
    tokensUsed: nextTokens,
  });

  return assistantMessage;
}
