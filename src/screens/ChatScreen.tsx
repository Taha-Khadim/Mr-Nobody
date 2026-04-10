import { useHeaderHeight } from '@react-navigation/elements';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarkdownBubble } from '@/components/MarkdownBubble';
import { ANTHROPIC_MODEL_CHOICES, labelForModelId } from '@/constants/models';
import { streamChatResponse } from '@/services/chatOrchestrator';
import { useChatStore } from '@/stores/chatStore';
import { useProviderStore } from '@/stores/providerStore';
import type { Message, MessageContent } from '@/types';
import type { PickedFile, PickedImage } from '@/utils/fileAttachments';
import {
  pickDocuments,
  pickReferenceImages,
  pickedImagesToMessageContent,
  pickedToMessageContent,
} from '@/utils/fileAttachments';
import type { ChatScreenProps } from '@/navigation/types';

function UserMessageBubble({ m }: { m: Message }) {
  return (
    <View style={[styles.bubble, styles.bubbleUser]}>
      {m.content.map((c, i) => {
        if (c.type === 'text') {
          return (
            <Text key={i} style={styles.bubbleText}>
              {c.text}
            </Text>
          );
        }
        if (c.type === 'image') {
          return (
            <Image
              key={i}
              source={{ uri: c.uri }}
              style={styles.msgImage}
              resizeMode="cover"
            />
          );
        }
        if (c.type === 'file') {
          return (
            <View key={i} style={styles.fileChip}>
              <Text style={styles.fileChipIcon}>📎</Text>
              <View style={styles.fileChipText}>
                <Text style={styles.fileChipName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.fileChipMeta} numberOfLines={1}>
                  {c.mimeType}
                  {c.sizeBytes != null ? ` · ${(c.sizeBytes / 1024).toFixed(1)} KB` : ''}
                </Text>
              </View>
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}

function AssistantMessageBubble({ m }: { m: Message }) {
  const textParts = m.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n\n');
  const media = m.content.filter((c) => c.type === 'image' || c.type === 'file');

  return (
    <View style={[styles.bubble, styles.bubbleAssistant]}>
      {textParts.length > 0 ? <MarkdownBubble>{textParts}</MarkdownBubble> : null}
      {media.map((c, i) => {
        if (c.type === 'image') {
          return (
            <Image
              key={`img-${i}`}
              source={{ uri: c.uri }}
              style={[styles.msgImage, { marginTop: 8 }]}
              resizeMode="cover"
            />
          );
        }
        if (c.type === 'file') {
          return (
            <View key={`f-${i}`} style={[styles.fileChip, { marginTop: 8 }]}>
              <Text style={styles.fileChipIcon}>📎</Text>
              <View style={styles.fileChipText}>
                <Text style={styles.fileChipName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.fileChipMeta} numberOfLines={1}>
                  {c.mimeType}
                </Text>
              </View>
            </View>
          );
        }
        return null;
      })}
    </View>
  );
}

export function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);

  const anthropicProvider = useProviderStore((s) => s.anthropicProvider);

  const messages = useChatStore((s) => s.messages);
  const chatMode = useChatStore((s) => s.chatMode);
  const activeModelId = useChatStore((s) => s.activeModelId);
  const init = useChatStore((s) => s.init);
  const openConversation = useChatStore((s) => s.openConversation);
  const leaveConversation = useChatStore((s) => s.leaveConversation);
  const setConversationModel = useChatStore((s) => s.setConversationModel);
  const streamingText = useChatStore((s) => s.streamingText);
  const loading = useChatStore((s) => s.loading);
  const error = useChatStore((s) => s.error);
  const appendUserMessage = useChatStore((s) => s.appendUserMessage);
  const appendAssistantMessage = useChatStore((s) => s.appendAssistantMessage);
  const setStreamingChunk = useChatStore((s) => s.setStreamingChunk);
  const clearStreaming = useChatStore((s) => s.clearStreaming);
  const setLoading = useChatStore((s) => s.setLoading);
  const setError = useChatStore((s) => s.setError);
  const setTitleFromFirstMessage = useChatStore((s) => s.setTitleFromFirstMessage);

  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<PickedFile[]>([]);
  const [pendingImages, setPendingImages] = useState<PickedImage[]>([]);
  const [modelModal, setModelModal] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRow}>
          <Pressable onPress={() => setModelModal(true)} hitSlop={8}>
            <Text style={styles.headerModel} numberOfLines={1}>
              {labelForModelId(activeModelId)}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
            <Text style={styles.headerLink}>Settings</Text>
          </Pressable>
        </View>
      ),
      title: chatMode === 'agentic' ? 'Agentic' : 'Chat',
    });
  }, [navigation, chatMode, activeModelId]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      }
    );
    return () => show.remove();
  }, []);

  useEffect(() => {
    void (async () => {
      await init();
      await openConversation(conversationId);
    })();
    return () => {
      leaveConversation();
    };
  }, [conversationId, init, openConversation, leaveConversation]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, streamingText, loading]);

  const bottomPad = Math.max(insets.bottom, 10);

  const attachFiles = useCallback(async () => {
    try {
      const picked = await pickDocuments();
      if (picked.length) setPendingFiles((prev) => [...prev, ...picked]);
    } catch {
      setError('Could not access files.');
    }
  }, [setError]);

  const attachImages = useCallback(async () => {
    try {
      const picked = await pickReferenceImages();
      if (picked.length) setPendingImages((prev) => [...prev, ...picked]);
    } catch {
      setError('Could not access photos.');
    }
  }, [setError]);

  const removePending = (uri: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.uri !== uri));
    setPendingImages((prev) => prev.filter((p) => p.uri !== uri));
  };

  const send = useCallback(async () => {
    const text = input.trim();
    const files = pendingFiles;
    const imgs = pendingImages;
    if ((!text && files.length === 0 && imgs.length === 0) || !anthropicProvider) return;

    const content: MessageContent[] = [
      ...pickedImagesToMessageContent(imgs),
      ...pickedToMessageContent(files),
    ];
    if (text) {
      content.push({ type: 'text', text });
    } else if (content.length > 0) {
      content.push({
        type: 'text',
        text: 'Use the attached reference image(s) and/or document(s) in your answer.',
      });
    }

    setInput('');
    setPendingFiles([]);
    setPendingImages([]);
    setError(null);
    clearStreaming();
    setLoading(true);
    Keyboard.dismiss();

    const prior = useChatStore.getState().messages;
    const userMsg = appendUserMessage(content);
    const mode = useChatStore.getState().chatMode;
    const modelId = useChatStore.getState().activeModelId;
    const titleSeed = text || [...imgs.map((i) => i.name), ...files.map((f) => f.name)].join(', ');

    try {
      const assistant = await streamChatResponse(
        {
          conversationId: userMsg.conversationId,
          history: prior,
          userMessage: userMsg,
          provider: anthropicProvider,
          modelId,
          chatMode: mode,
        },
        (delta) => setStreamingChunk(delta)
      );
      appendAssistantMessage(assistant);
      if (prior.length === 0) {
        await setTitleFromFirstMessage(userMsg.conversationId, titleSeed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
      clearStreaming();
    }
  }, [
    input,
    pendingFiles,
    pendingImages,
    anthropicProvider,
    appendUserMessage,
    appendAssistantMessage,
    setStreamingChunk,
    clearStreaming,
    setLoading,
    setError,
    setTitleFromFirstMessage,
  ]);

  const canSend =
    (input.trim().length > 0 || pendingFiles.length > 0 || pendingImages.length > 0) &&
    !loading &&
    !!anthropicProvider;

  const onPickModel = async (id: string) => {
    setModelModal(false);
    await setConversationModel(conversationId, id);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
      enabled={Platform.OS === 'ios'}
    >
      <View style={styles.modeBar}>
        <Text style={styles.modeLabel}>
          {chatMode === 'agentic' ? 'Agentic — step-by-step' : 'Standard'} · tap model name (top
          right) to switch
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={[styles.messagesInner, { paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {messages.map((m) =>
          m.role === 'user' ? (
            <UserMessageBubble key={m.id} m={m} />
          ) : (
            <AssistantMessageBubble key={m.id} m={m} />
          )
        )}
        {streamingText ? (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <Text style={styles.streamingText}>{streamingText}</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.composerBlock, { paddingBottom: bottomPad }]}>
        {(pendingFiles.length > 0 || pendingImages.length > 0) && (
          <View style={styles.pendingRow}>
            {pendingImages.map((f) => (
              <View key={f.uri} style={styles.pendingChip}>
                <Image source={{ uri: f.uri }} style={styles.pendingThumb} />
                <Text style={styles.pendingChipText} numberOfLines={1}>
                  {f.name}
                </Text>
                <Pressable onPress={() => removePending(f.uri)} hitSlop={8}>
                  <Text style={styles.pendingChipX}>×</Text>
                </Pressable>
              </View>
            ))}
            {pendingFiles.map((f) => (
              <View key={f.uri} style={styles.pendingChip}>
                <Text style={styles.pendingChipText} numberOfLines={1}>
                  📎 {f.name}
                </Text>
                <Pressable onPress={() => removePending(f.uri)} hitSlop={8}>
                  <Text style={styles.pendingChipX}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.inputRow}>
          <Pressable
            style={styles.attachBtn}
            onPress={attachImages}
            disabled={loading}
            accessibilityLabel="Attach reference images"
          >
            <Text style={styles.attachBtnText}>🖼</Text>
          </Pressable>
          <Pressable
            style={styles.attachBtn}
            onPress={attachFiles}
            disabled={loading}
            accessibilityLabel="Attach files"
          >
            <Text style={styles.attachBtnText}>📎</Text>
          </Pressable>
          <TextInput
            style={styles.textInput}
            placeholder={chatMode === 'agentic' ? 'Ask the agent…' : 'Message Claude…'}
            placeholderTextColor="#71717a"
            value={input}
            onChangeText={setInput}
            multiline
            editable={!loading}
          />
          <Pressable
            style={[styles.sendBtn, (!canSend || loading) && styles.btnDisabled]}
            onPress={send}
            disabled={!canSend || loading}
          >
            <Text style={styles.sendBtnText}>{loading ? '…' : 'Send'}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={modelModal} transparent animationType="fade" onRequestClose={() => setModelModal(false)}>
        <View style={styles.modelOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModelModal(false)} />
          <View style={styles.modelSheet}>
            <Text style={styles.modelSheetTitle}>Model for this chat</Text>
            <FlatList
              data={[...ANTHROPIC_MODEL_CHOICES]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modelRow, item.id === activeModelId && styles.modelRowActive]}
                  onPress={() => void onPickModel(item.id)}
                >
                  <Text style={styles.modelRowLabel}>{item.label}</Text>
                  <Text style={styles.modelRowId}>{item.id}</Text>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setModelModal(false)}>
              <Text style={styles.modelCancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090b' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 200 },
  headerModel: { color: '#c4b5fd', fontSize: 13, fontWeight: '600', maxWidth: 110 },
  modeBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272a',
  },
  modeLabel: { color: '#a1a1aa', fontSize: 12, lineHeight: 18 },
  messages: { flex: 1 },
  messagesInner: { padding: 16, gap: 10 },
  bubble: {
    maxWidth: '92%',
    padding: 12,
    borderRadius: 14,
  },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#27272a' },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  bubbleText: { color: '#e4e4e7', fontSize: 16, lineHeight: 22 },
  streamingText: {
    color: '#e4e4e7',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  msgImage: { width: 220, height: 220, borderRadius: 10, marginTop: 6 },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#27272a',
    maxWidth: '100%',
  },
  fileChipIcon: { fontSize: 18 },
  fileChipText: { flex: 1, minWidth: 0 },
  fileChipName: { color: '#fafafa', fontSize: 14, fontWeight: '600' },
  fileChipMeta: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  error: { color: '#f87171', paddingHorizontal: 4 },
  composerBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#27272a',
    backgroundColor: '#09090b',
  },
  pendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  pendingThumb: { width: 36, height: 36, borderRadius: 6 },
  pendingChipText: { color: '#e4e4e7', fontSize: 13, maxWidth: 160 },
  pendingChipX: { color: '#f87171', fontSize: 18, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 4,
  },
  attachBtn: {
    paddingBottom: 10,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  attachBtnText: { fontSize: 20 },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#18181b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fafafa',
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sendBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  headerLink: { color: '#a5b4fc', fontSize: 16, fontWeight: '600' },
  modelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 24,
  },
  modelSheet: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modelSheetTitle: { color: '#fafafa', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  modelRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272a',
  },
  modelRowActive: { backgroundColor: '#27272a' },
  modelRowLabel: { color: '#fafafa', fontSize: 16, fontWeight: '600' },
  modelRowId: { color: '#71717a', fontSize: 11, marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  modelCancel: { color: '#71717a', textAlign: 'center', marginTop: 12, fontSize: 16 },
});
