import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import type { MessageContent } from '@/types';

export const MAX_TEXT_FILE_CHARS = 400_000;

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

export type PickedImage = { uri: string; mimeType: string; name: string };

export async function pickReferenceImages(): Promise<PickedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.88,
    selectionLimit: 6,
  });
  if (r.canceled || !r.assets?.length) return [];
  return r.assets.map((a, i) => ({
    uri: a.uri,
    mimeType: a.mimeType ?? 'image/jpeg',
    name: a.fileName ?? `image-${i + 1}.jpg`,
  }));
}

export function pickedImagesToMessageContent(images: PickedImage[]): MessageContent[] {
  return images.map((img) => ({
    type: 'image' as const,
    uri: img.uri,
    mimeType: img.mimeType,
    caption: img.name,
  }));
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  const assets = res.assets;
  if (!assets?.length) return [];
  return assets.map((a) => ({
    uri: a.uri,
    name: a.name ?? 'file',
    mimeType: a.mimeType ?? 'application/octet-stream',
    size: a.size,
  }));
}

export function pickedToMessageContent(files: PickedFile[]): MessageContent[] {
  return files.map((f) => ({
    type: 'file' as const,
    uri: f.uri,
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: f.size,
  }));
}

/** Read plain text for preview in UI (short). */
export async function readTextPreview(uri: string, max = 800): Promise<string> {
  try {
    const t = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return t.length > max ? `${t.slice(0, max)}…` : t;
  } catch {
    return '';
  }
}

export function isProbablyTextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith('text/') ||
    m === 'application/json' ||
    m === 'application/xml' ||
    m === 'application/javascript' ||
    m === 'application/typescript' ||
    m.endsWith('+xml')
  );
}

