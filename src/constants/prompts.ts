import type { ChatMode } from '@/types';

const STANDARD = `You are a helpful, accurate assistant. Be concise unless the user asks for detail.`;

const AGENTIC = `You are an autonomous agent-style assistant. Break problems into steps, state assumptions, and reason explicitly before conclusions. When uncertain, ask a clarifying question. Prefer structured answers (numbered steps, bullets). If the user asks for actions that require tools you do not have in this chat, explain what you would do and offer a concrete plan.`;

export function systemPromptForMode(mode: ChatMode, personaSystem?: string): string | undefined {
  const base = mode === 'agentic' ? AGENTIC : STANDARD;
  if (personaSystem?.trim()) {
    return `${base}\n\n${personaSystem.trim()}`;
  }
  return base;
}
