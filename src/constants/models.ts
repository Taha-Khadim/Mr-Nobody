/**
 * If requests fail with "model not found", use an id from:
 * https://docs.anthropic.com/en/docs/about-claude/models
 */
export const PRIMARY_CHAT_MODEL_ID = 'claude-opus-4-6';

/** Pickable Claude models (API id + label). */
export const ANTHROPIC_MODEL_CHOICES = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
] as const;

export function labelForModelId(id: string): string {
  return ANTHROPIC_MODEL_CHOICES.find((m) => m.id === id)?.label ?? id;
}

export const ANTHROPIC_API_VERSION = '2023-06-01';
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';

export const OPENAI_IMAGE_MODEL_DEFAULT = 'dall-e-3';
export const OPENAI_WHISPER_MODEL = 'whisper-1';
export const OPENAI_TTS_MODEL_DEFAULT = 'tts-1';
