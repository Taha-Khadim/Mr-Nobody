import * as SQLite from 'expo-sqlite';

import type { ChatMode, Conversation, Message } from '@/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('personal_ai.db');
  }
  return dbPromise;
}

function parseMetadata(raw: string | null): Conversation['metadata'] & {
  messageCount?: number;
  tokensUsed?: number;
} {
  if (!raw) return { isMultimodal: false, chatMode: 'standard', messageCount: 0, tokensUsed: 0 };
  try {
    const m = JSON.parse(raw) as Record<string, unknown>;
    const mode = m.chatMode === 'agentic' ? 'agentic' : 'standard';
    return {
      isMultimodal: Boolean(m.isMultimodal),
      chatMode: mode,
      lastCapabilityUsed:
        typeof m.lastCapabilityUsed === 'string' ? m.lastCapabilityUsed : undefined,
      messageCount: typeof m.messageCount === 'number' ? m.messageCount : 0,
      tokensUsed: typeof m.tokensUsed === 'number' ? m.tokensUsed : 0,
    };
  } catch {
    return { isMultimodal: false, chatMode: 'standard', messageCount: 0, tokensUsed: 0 };
  }
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      name TEXT,
      api_key_encrypted TEXT NOT NULL,
      capabilities TEXT,
      models TEXT,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT,
      model_id TEXT,
      persona_id TEXT,
      title TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      tokens INTEGER,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      system_prompt TEXT,
      voice_config TEXT,
      capabilities TEXT,
      is_default INTEGER DEFAULT 0
    );
  `);
}

export async function insertConversation(row: Conversation): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO conversations (id, provider_id, model_id, persona_id, title, created_at, updated_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.providerId,
      row.modelId,
      row.personaId ?? null,
      row.title,
      row.createdAt,
      row.updatedAt,
      JSON.stringify({
        messageCount: row.messageCount,
        tokensUsed: row.tokensUsed,
        ...row.metadata,
      }),
    ]
  );
}

export async function updateConversationModel(conversationId: string, modelId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE conversations SET model_id = ? WHERE id = ?`, [modelId, conversationId]);
}

export async function touchConversation(
  id: string,
  patch: { title?: string; messageCount?: number; tokensUsed?: number; updatedAt?: number }
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ metadata: string | null }>(
    `SELECT metadata FROM conversations WHERE id = ?`,
    [id]
  );
  if (!row) return;
  let meta: Record<string, unknown> = {};
  try {
    meta = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {};
  } catch {
    meta = {};
  }
  if (patch.messageCount != null) meta.messageCount = patch.messageCount;
  if (patch.tokensUsed != null) meta.tokensUsed = patch.tokensUsed;
  const updatedAt = patch.updatedAt ?? Date.now();
  await db.runAsync(
    `UPDATE conversations SET title = COALESCE(?, title), updated_at = ?, metadata = ? WHERE id = ?`,
    [patch.title ?? null, updatedAt, JSON.stringify(meta), id]
  );
}

export async function insertMessage(row: Message): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO messages (id, conversation_id, role, content, timestamp, tokens, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.conversationId,
      row.role,
      JSON.stringify(row.content),
      row.timestamp,
      row.tokens ?? null,
      JSON.stringify(row.metadata),
    ]
  );
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    timestamp: number;
    tokens: number | null;
    metadata: string | null;
  }>(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC`,
    [conversationId]
  );
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role as Message['role'],
    content: JSON.parse(r.content) as Message['content'],
    timestamp: r.timestamp,
    tokens: r.tokens ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata) : {},
  }));
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    provider_id: string | null;
    model_id: string | null;
    persona_id: string | null;
    title: string | null;
    created_at: number | null;
    updated_at: number | null;
    metadata: string | null;
  }>(`SELECT * FROM conversations ORDER BY updated_at DESC`);

  return rows.map((r) => {
    const meta = parseMetadata(r.metadata);
    return {
      id: r.id,
      title: r.title ?? 'Chat',
      providerId: r.provider_id ?? '',
      modelId: r.model_id ?? '',
      personaId: r.persona_id ?? undefined,
      createdAt: r.created_at ?? 0,
      updatedAt: r.updated_at ?? 0,
      messageCount: meta.messageCount ?? 0,
      tokensUsed: meta.tokensUsed ?? 0,
      metadata: {
        isMultimodal: meta.isMultimodal,
        chatMode: meta.chatMode,
        lastCapabilityUsed: meta.lastCapabilityUsed,
      },
    };
  });
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<{
    id: string;
    provider_id: string | null;
    model_id: string | null;
    persona_id: string | null;
    title: string | null;
    created_at: number | null;
    updated_at: number | null;
    metadata: string | null;
  }>(`SELECT * FROM conversations WHERE id = ?`, [id]);
  if (!r) return null;
  const meta = parseMetadata(r.metadata);
  return {
    id: r.id,
    title: r.title ?? 'Chat',
    providerId: r.provider_id ?? '',
    modelId: r.model_id ?? '',
    personaId: r.persona_id ?? undefined,
    createdAt: r.created_at ?? 0,
    updatedAt: r.updated_at ?? 0,
    messageCount: meta.messageCount ?? 0,
    tokensUsed: meta.tokensUsed ?? 0,
    metadata: {
      isMultimodal: meta.isMultimodal,
      chatMode: meta.chatMode,
      lastCapabilityUsed: meta.lastCapabilityUsed,
    },
  };
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM messages WHERE conversation_id = ?`, [id]);
  await db.runAsync(`DELETE FROM conversations WHERE id = ?`, [id]);
}
