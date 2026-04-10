import { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listConversations } from '@/db/database';
import { useProviderStore } from '@/stores/providerStore';
import { useChatStore } from '@/stores/chatStore';
import type { Conversation, ChatMode } from '@/types';
import type { HomeScreenProps } from '@/navigation/types';

const headerStyles = StyleSheet.create({
  link: { color: '#a5b4fc', fontSize: 16, fontWeight: '600' },
});

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const anthropicProvider = useProviderStore((s) => s.anthropicProvider);
  const createConversation = useChatStore((s) => s.createConversation);
  const init = useChatStore((s) => s.init);

  const [rows, setRows] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await init();
    const list = await listConversations();
    setRows(list);
  }, [init]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={() => navigation.navigate('ImageGen')} hitSlop={12} style={{ marginRight: 8 }}>
          <Text style={headerStyles.link}>Images</Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
          <Text style={headerStyles.link}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const startNew = (mode: ChatMode) => {
    if (!anthropicProvider) {
      Alert.alert('Setup required', 'Add your Anthropic API key in Settings first.');
      return;
    }
    if (busy) return;

    setBusy(true);
    setModal(false);

    void (async () => {
      try {
        const id = await createConversation(anthropicProvider.id, mode);
        InteractionManager.runAfterInteractions(() => {
          navigation.push('Chat', { conversationId: id });
        });
      } catch (e) {
        Alert.alert(
          'Could not open chat',
          e instanceof Error ? e.message : 'Something went wrong. Try again.'
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const openFab = () => {
    if (!anthropicProvider) {
      Alert.alert('Setup required', 'Add your Anthropic API key in Settings first.');
      return;
    }
    setModal(true);
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 72 }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a1a1aa" />
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>
              Tap + to start a standard chat or an agentic thread.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => navigation.push('Chat', { conversationId: item.id })}
          >
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowTime}>{formatTime(item.updatedAt)}</Text>
            </View>
            <View style={styles.rowMeta}>
              <View
                style={[
                  styles.pill,
                  item.metadata.chatMode === 'agentic' ? styles.pillAgent : styles.pillStd,
                ]}
              >
                <Text style={styles.pillText}>
                  {item.metadata.chatMode === 'agentic' ? 'Agentic' : 'Standard'}
                </Text>
              </View>
              <Text style={styles.rowSub}>{item.messageCount} messages</Text>
            </View>
          </Pressable>
        )}
      />

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={openFab}
        disabled={busy}
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      <Modal
        visible={modal}
        transparent
        animationType="fade"
        onRequestClose={() => setModal(false)}
        statusBarTranslucent
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <View style={[styles.modalCard, { marginBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.modalTitle}>New chat</Text>
            <Text style={styles.modalHint}>Choose how Claude should behave in this thread.</Text>
            <Pressable
              style={styles.modeBtn}
              onPress={() => startNew('standard')}
              disabled={busy}
            >
              <Text style={styles.modeBtnTitle}>Standard</Text>
              <Text style={styles.modeBtnSub}>Fast assistant — concise answers</Text>
            </Pressable>
            <Pressable
              style={[styles.modeBtn, styles.modeBtnAgent]}
              onPress={() => startNew('agentic')}
              disabled={busy}
            >
              <Text style={styles.modeBtnTitle}>Agentic</Text>
              <Text style={styles.modeBtnSub}>Plans, steps, explicit reasoning</Text>
            </Pressable>
            <Pressable onPress={() => setModal(false)} disabled={busy}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090b' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  row: {
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  rowPressed: { opacity: 0.92 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowTitle: { flex: 1, color: '#fafafa', fontSize: 16, fontWeight: '600' },
  rowTime: { color: '#71717a', fontSize: 12 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  rowSub: { color: '#71717a', fontSize: 12 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillStd: { backgroundColor: '#27272a' },
  pillAgent: { backgroundColor: '#422006' },
  pillText: { color: '#e4e4e7', fontSize: 11, fontWeight: '700' },
  empty: { paddingHorizontal: 32, alignItems: 'center' },
  emptyTitle: { color: '#fafafa', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#a1a1aa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    marginHorizontal: 16,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    zIndex: 2,
  },
  modalTitle: { color: '#fafafa', fontSize: 20, fontWeight: '700' },
  modalHint: { color: '#a1a1aa', fontSize: 14, marginTop: 6, marginBottom: 16 },
  modeBtn: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  modeBtnAgent: { backgroundColor: '#422006', borderWidth: 1, borderColor: '#78350f' },
  modeBtnTitle: { color: '#fafafa', fontSize: 16, fontWeight: '700' },
  modeBtnSub: { color: '#a1a1aa', fontSize: 13, marginTop: 4 },
  cancel: { color: '#71717a', textAlign: 'center', marginTop: 8, fontSize: 16 },
});
