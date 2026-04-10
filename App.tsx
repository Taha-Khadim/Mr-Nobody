import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from '@/navigation/RootNavigator';
import { useProviderStore } from '@/stores/providerStore';

const queryClient = new QueryClient();

export default function App() {
  const hydrateFromSecureStore = useProviderStore((s) => s.hydrateFromSecureStore);

  useEffect(() => {
    void hydrateFromSecureStore();
  }, [hydrateFromSecureStore]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
