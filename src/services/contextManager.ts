import type { Message, MessageContent } from '@/types';

/** Rough token estimate (~4 chars per token for English). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Character weight for budgeting (images approximated). */
function messageCharWeight(m: Message): number {
  return m.content.reduce((acc, c) => {
    if (c.type === 'text') return acc + c.text.length;
    if (c.type === 'image') return acc + 50_000;
    if (c.type === 'file') return acc + Math.min(c.sizeBytes ?? 80_000, 500_000);
    return acc + 200;
  }, 0);
}

export interface ContextOptions {
  /** Approximate max input tokens to send (excludes reserved output). */
  maxContextTokens: number;
  /** Reserve for system prompt. */
  systemPromptTokens: number;
}

/**
 * Keeps the most recent turns that fit in the budget. Drops oldest first.
 */
export function truncateMessagesByBudget(
  messages: Message[],
  opts: ContextOptions
): Message[] {
  const budget = Math.max(1000, opts.maxContextTokens - opts.systemPromptTokens);
  let used = 0;
  const kept: Message[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'system') continue;
    const cost = Math.max(1, Math.ceil(messageCharWeight(m) / 4));
    if (used + cost > budget && kept.length > 0) break;
    used += cost;
    kept.push(m);
  }

  return kept.reverse();
}

/**
 * Anthropic expects alternating user / assistant. Merge consecutive same-role messages.
 */
export function mergeAlternatingRoles(messages: Message[]): Message[] {
  if (messages.length === 0) return [];

  const out: Message[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content = mergeContentParts(last.content, m.content);
      last.timestamp = Math.max(last.timestamp, m.timestamp);
    } else {
      out.push({
        ...m,
        content: [...m.content],
      });
    }
  }
  return out;
}

function mergeContentParts(a: MessageContent[], b: MessageContent[]): MessageContent[] {
  const lastA = a[a.length - 1];
  const firstB = b[0];
  if (
    lastA?.type === 'text' &&
    firstB?.type === 'text' &&
    lastA.text.length > 0 &&
    firstB.text.length > 0
  ) {
    return [...a.slice(0, -1), { type: 'text', text: `${lastA.text}\n\n${firstB.text}` }, ...b.slice(1)];
  }
  if (lastA?.type === 'file' && firstB?.type === 'file' && lastA.uri === firstB.uri) {
    return a;
  }
  return [...a, ...b];
}

/**
 * Full pipeline: truncate → merge for Claude Messages API.
 */
export function buildClaudeMessageWindow(
  history: Message[],
  userMessage: Message,
  opts: ContextOptions
): Message[] {
  const combined = [...history, userMessage];
  const truncated = truncateMessagesByBudget(combined, opts);
  return mergeAlternatingRoles(truncated);
}
