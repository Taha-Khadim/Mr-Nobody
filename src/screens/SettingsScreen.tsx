import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ANTHROPIC_MODEL_CHOICES, labelForModelId } from '@/constants/models';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useProviderStore } from '@/stores/providerStore';
import type { SettingsScreenProps } from '@/navigation/types';

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const openaiKey = useProviderStore((s) => s.openaiKey);
  const setOpenAIKey = useProviderStore((s) => s.setOpenAIKey);
  const clearKeys = useProviderStore((s) => s.clearKeys);

  const defaultModelId = usePreferencesStore((s) => s.defaultModelId);
  const setDefaultModelId = usePreferencesStore((s) => s.setDefaultModelId);

  const onLogout = () => {
    Alert.alert('Sign out', 'Remove stored API keys from this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await clearKeys();
          navigation.reset({ index: 0, routes: [{ name: 'Setup' }] });
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.inner}>
      <Text style={styles.section}>Chat (Claude)</Text>
      <Text style={styles.body}>
        Default model applies to <Text style={styles.em}>new</Text> conversations. You can override
        the model per chat from the chat header.
      </Text>
      <Text style={styles.caption}>Current default: {labelForModelId(defaultModelId)}</Text>
      <View style={styles.modelGrid}>
        {ANTHROPIC_MODEL_CHOICES.map((m) => (
          <Pressable
            key={m.id}
            style={[styles.modelChip, defaultModelId === m.id && styles.modelChipOn]}
            onPress={() => setDefaultModelId(m.id)}
          >
            <Text style={[styles.modelChipText, defaultModelId === m.id && styles.modelChipTextOn]}>
              {m.label}
            </Text>
            <Text style={styles.modelChipId}>{m.id}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Images (OpenAI)</Text>
      <Text style={styles.body}>
        DALL·E lives on the Images tab — not inside chat. Add an OpenAI key here to generate images
        there.
      </Text>

      <Text style={styles.section}>OpenAI API key (optional)</Text>
      <Text style={styles.caption}>Used only for image generation (and future audio tools).</Text>
      <OpenAIKeyField initialSaved={!!openaiKey} onSave={(k) => void setOpenAIKey(k)} />

      <Text style={styles.section}>Keyboard</Text>
      <Text style={styles.body}>
        On iOS, the composer moves with the keyboard. On Android, the window resizes (adjust resize)
        so the input stays visible. Pull down on the message list to dismiss the keyboard.
      </Text>

      <Pressable style={styles.danger} onPress={onLogout}>
        <Text style={styles.dangerText}>Remove all keys & sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function OpenAIKeyField({
  initialSaved,
  onSave,
}: {
  initialSaved: boolean;
  onSave: (key: string) => void;
}) {
  const [val, setVal] = useState('');
  return (
    <>
      <TextInput
        style={styles.input}
        placeholder={initialSaved ? '•••••• (enter new key to replace)' : 'sk-...'}
        placeholderTextColor="#71717a"
        secureTextEntry
        autoCapitalize="none"
        value={val}
        onChangeText={setVal}
      />
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => {
          const k = val.trim();
          if (k) onSave(k);
        }}
      >
        <Text style={styles.secondaryBtnText}>Save OpenAI key</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090b' },
  inner: { padding: 20, gap: 12, paddingBottom: 40 },
  section: { color: '#fafafa', fontSize: 17, fontWeight: '700', marginTop: 8 },
  body: { color: '#a1a1aa', fontSize: 15, lineHeight: 22 },
  em: { fontStyle: 'italic', color: '#e4e4e7' },
  caption: { color: '#71717a', fontSize: 13 },
  modelGrid: { gap: 10, marginTop: 4 },
  modelChip: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modelChipOn: { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  modelChipText: { color: '#fafafa', fontSize: 15, fontWeight: '600' },
  modelChipTextOn: { color: '#c4b5fd' },
  modelChipId: { color: '#71717a', fontSize: 11, marginTop: 4 },
  input: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 14,
    color: '#fafafa',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  secondaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  secondaryBtnText: { color: '#e4e4e7', fontWeight: '600' },
  danger: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerText: { color: '#f87171', fontWeight: '600' },
});
