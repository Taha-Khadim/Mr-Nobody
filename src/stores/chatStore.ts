import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

import { PRIMARY_CHAT_MODEL_ID } from '@/constants/models';
import {
  getConversation,
  initDatabase,
  insertConversation,
  insertMessage,
  listMessages,
  touchConversation,
  updateConversationModel,
} from '@/db/database';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { ChatMode, Conversation, Message, MessageContent } from '@/types';

type ChatState = {
  conversationId: string | null;
  chatMode: ChatMode;
  /** Model used for API calls in the active thread. */
  activeModelId: string;
  messages: Message[];
  streamingText: string;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  createConversation: (providerId: string, mode: ChatMode) => Promise<string>;
  openConversation: (id: string) => Promise<void>;
  leaveConversation: () => void;
  appendUserMessage: (content: MessageContent[]) => Message;
  appendAssistantMessage: (message: Message) => void;
  setStreamingChunk: (delta: string) => void;
  clearStreaming: () => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setTitleFromFirstMessage: (conversationId: string, text: string) => Promise<void>;
  setConversationModel: (conversationId: string, modelId: string) => Promise<void>;
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversationId: null,
  chatMode: 'standard',
  activeModelId: PRIMARY_CHAT_MODEL_ID,
  messages: [],
  streamingText: '',
  loading: false,
  error: null,

  init: async () => {
    await initDatabase();
  },

  createConversation: async (providerId: string, mode: ChatMode) => {
    await initDatabase();
    const defaultModel =
      usePreferencesStore.getState().defaultModelId ?? PRIMARY_CHAT_MODEL_ID;
    const id = uuidv4();
    const now = Date.now();
    const conv: Conversation = {
      id,
      title: mode === 'agentic' ? 'Agentic chat' : 'New chat',
      providerId,
      modelId: defaultModel,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      tokensUsed: 0,
      metadata: { isMultimodal: false, chatMode: mode },
    };
    await insertConversation(conv);
    set({
      conversationId: id,
      chatMode: mode,
      activeModelId: defaultModel,
      messages: [],
      streamingText: '',
      error: null,
    });
    return id;
  },

  openConversation: async (id: string) => {
    await initDatabase();
    const conv = await getConversation(id);
    if (!conv) {
      set({ error: 'Conversation not found', conversationId: null, messages: [] });
      return;
    }
    const rows = await listMessages(id);
    set({
      conversationId: id,
      chatMode: conv.metadata.chatMode ?? 'standard',
      activeModelId: conv.modelId || PRIMARY_CHAT_MODEL_ID,
      messages: rows,
      streamingText: '',
      error: null,
    });
  },

  leaveConversation: () =>
    set({
      conversationId: null,
      activeModelId: PRIMARY_CHAT_MODEL_ID,
      messages: [],
      streamingText: '',
      error: null,
    }),

  setConversationModel: async (conversationId: string, modelId: string) => {
    await updateConversationModel(conversationId, modelId);
    if (get().conversationId === conversationId) {
      set({ activeModelId: modelId });
    }
  },

  appendUserMessage: (content: MessageContent[]) => {
    const convId = get().conversationId;
    if (!convId) throw new Error('No conversation');
    const msg: Message = {
      id: uuidv4(),
      conversationId: convId,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: {},
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    void insertMessage(msg);
    return msg;
  },

  appendAssistantMessage: (message: Message) => {
    set((s) => ({ messages: [...s.messages, message], streamingText: '' }));
  },

  setStreamingChunk: (delta: string) =>
    set((s) => ({ streamingText: s.streamingText + delta })),

  clearStreaming: () => set({ streamingText: '' }),

  setLoading: (v: boolean) => set({ loading: v }),

  setError: (e: string | null) => set({ error: e }),

  setTitleFromFirstMessage: async (conversationId: string, text: string) => {
    const c = await getConversation(conversationId);
    if (!c) return;
    const generic = c.title === 'Chat' || c.title === 'New chat' || c.title === 'Agentic chat';
    if (!generic) return;
    const line = text.trim().split('\n')[0] ?? '';
    const t = line.slice(0, 56) + (line.length > 56 ? '…' : '');
    if (t.length < 2) return;
    await touchConversation(conversationId, { title: t, updatedAt: Date.now() });
  },
}));
