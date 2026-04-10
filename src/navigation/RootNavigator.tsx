import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useProviderStore } from '@/stores/providerStore';
import { ChatScreen } from '@/screens/ChatScreen';
import { ImageGenScreen } from '@/screens/ImageGenScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { SetupScreen } from '@/screens/SetupScreen';

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const hydrated = useProviderStore((s) => s.hydrated);
  const anthropicKey = useProviderStore((s) => s.anthropicKey);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={anthropicKey ? 'Home' : 'Setup'}
        screenOptions={{
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#09090b' },
          headerStyle: { backgroundColor: '#09090b' },
          headerTintColor: '#fafafa',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="Setup"
          component={SetupScreen}
          options={{ title: 'Connect', headerShown: true }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Chats', headerLargeTitle: false }}
        />
        <Stack.Screen
          name="ImageGen"
          component={ImageGenScreen}
          options={{ title: 'Images (DALL·E)' }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
