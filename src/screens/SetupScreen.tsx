import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnthropicAdapter } from '@/services/adapters/anthropicAdapter';
import { OpenAIMediaAdapter } from '@/services/adapters/openaiMediaAdapter';
import { useProviderStore } from '@/stores/providerStore';
import type { SetupScreenProps } from '@/navigation/types';

export function SetupScreen({ navigation }: SetupScreenProps) {
  const setAnthropicKey = useProviderStore((s) => s.setAnthropicKey);
  const setOpenAIKey = useProviderStore((s) => s.setOpenAIKey);

  const [anthropic, setAnthropic] = useState('');
  const [openai, setOpenai] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onSave = async () => {
    const trimmed = anthropic.trim();
    if (!trimmed) {
      setStatus('Anthropic API key is required for chat (Claude Opus).');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const a = new AnthropicAdapter({ apiKey: trimmed });
      const ok = await a.validateKey();
      if (!ok) {
        setStatus('Anthropic key validation failed. Check the key and model id in constants.');
        setBusy(false);
        return;
      }
      await setAnthropicKey(trimmed);
      const o = openai.trim();
      if (o) {
        const media = new OpenAIMediaAdapter({ apiKey: o });
        const openOk = await media.validateKey();
        if (!openOk) {
          setStatus('OpenAI key did not validate; Anthropic was saved. Fix OpenAI or skip it.');
          setBusy(false);
          navigation.replace('Home');
          return;
        }
        await setOpenAIKey(o);
      }
      navigation.replace('Home');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Chat uses Anthropic with Claude Opus as the primary model. OpenAI is optional and only
          used for image generation (DALL·E) and audio (Whisper / TTS).
        </Text>
        <Text style={styles.label}>Anthropic API key (required)</Text>
        <TextInput
          style={styles.input}
          placeholder="sk-ant-..."
          placeholderTextColor="#71717a"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={anthropic}
          onChangeText={setAnthropic}
        />
        <Text style={styles.label}>OpenAI API key (optional — images & audio only)</Text>
        <TextInput
          style={styles.input}
          placeholder="sk-..."
          placeholderTextColor="#71717a"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          value={openai}
          onChangeText={setOpenai}
        />
        {status ? <Text style={styles.error}>{status}</Text> : null}
        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={onSave}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? 'Validating…' : 'Save & continue'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0c0e' },
  scroll: { padding: 20, paddingTop: 24, gap: 12 },
  lead: { color: '#a1a1aa', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  label: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 14,
    color: '#fafafa',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  error: { color: '#f87171', fontSize: 14 },
  button: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
