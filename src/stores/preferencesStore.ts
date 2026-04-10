import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PRIMARY_CHAT_MODEL_ID } from '@/constants/models';

type Prefs = {
  defaultModelId: string;
  setDefaultModelId: (id: string) => void;
};

export const usePreferencesStore = create<Prefs>()(
  persist(
    (set) => ({
      defaultModelId: PRIMARY_CHAT_MODEL_ID,
      setDefaultModelId: (id: string) => set({ defaultModelId: id }),
    }),
    {
      name: 'app-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ defaultModelId: s.defaultModelId }),
    }
  )
);
