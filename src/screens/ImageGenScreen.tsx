import { useLayoutEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OPENAI_IMAGE_MODEL_DEFAULT } from '@/constants/models';
import { OpenAIMediaAdapter } from '@/services/adapters/openaiMediaAdapter';
import { useProviderStore } from '@/stores/providerStore';
import type { ImageGenScreenProps } from '@/navigation/types';

export function ImageGenScreen({ navigation }: ImageGenScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const openaiKey = useProviderStore((s) => s.openaiKey);

  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
          <Text style={styles.headerLink}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const generate = async () => {
    const p = prompt.trim();
    if (!p) return;
    if (!openaiKey) {
      Alert.alert('OpenAI key required', 'Add an OpenAI API key in Settings to use DALL·E.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const adapter = new OpenAIMediaAdapter({ apiKey: openaiKey });
      const url = await adapter.generateImage(p, { model: OPENAI_IMAGE_MODEL_DEFAULT });
      setLastUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingBottom: Math.max(insets.bottom, 20) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.lead}>
          Image generation uses OpenAI only (DALL·E). Chats use Claude on the Chats tab.
        </Text>

        {!openaiKey ? (
          <Text style={styles.warn}>Add an OpenAI key under Settings to generate images.</Text>
        ) : null}

        <Text style={styles.label}>Prompt</Text>
        <TextInput
          style={styles.prompt}
          placeholder="Describe the image you want…"
          placeholderTextColor="#71717a"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          editable={!busy}
        />

        <Pressable
          style={[styles.primary, (!prompt.trim() || busy) && styles.disabled]}
          onPress={generate}
          disabled={!prompt.trim() || busy}
        >
          <Text style={styles.primaryText}>{busy ? 'Generating…' : 'Generate with DALL·E'}</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {lastUrl ? (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>Result</Text>
            <Image source={{ uri: lastUrl }} style={styles.resultImg} resizeMode="contain" />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090b' },
  inner: { padding: 16, gap: 12 },
  lead: { color: '#a1a1aa', fontSize: 14, lineHeight: 20 },
  warn: { color: '#fbbf24', fontSize: 14 },
  label: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  prompt: {
    minHeight: 100,
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 14,
    color: '#fafafa',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    textAlignVertical: 'top',
  },
  primary: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: '#f87171', fontSize: 14 },
  result: { marginTop: 8, gap: 8 },
  resultLabel: { color: '#fafafa', fontWeight: '700', fontSize: 15 },
  resultImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#18181b',
  },
  headerLink: { color: '#a5b4fc', fontSize: 16, fontWeight: '600' },
});
