import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Setup: undefined;
  Home: undefined;
  Chat: { conversationId: string };
  ImageGen: undefined;
  Settings: undefined;
};

export type SetupScreenProps = NativeStackScreenProps<RootStackParamList, 'Setup'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;
export type ImageGenScreenProps = NativeStackScreenProps<RootStackParamList, 'ImageGen'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
