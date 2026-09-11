import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const SETTINGS_KEY_BASE = '@susej_settings';

function getSettingsKey(username?: string | null): string {
  return username ? `${SETTINGS_KEY_BASE}:${username}` : SETTINGS_KEY_BASE;
}

interface Settings {
  privateAccount: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  privateAccount: true,
  pushNotifications: true,
  emailNotifications: false,
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const settingsKey = getSettingsKey(user?.username);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    const key = settingsKey;
    AsyncStorage.getItem(key)
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(data) }); return; }
          catch { /* reset */ }
        }
        if (key !== SETTINGS_KEY_BASE) {
          const legacy = await AsyncStorage.getItem(SETTINGS_KEY_BASE);
          if (cancelled) return;
          if (legacy) {
            try {
              setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(legacy) });
              try { await AsyncStorage.setItem(key, legacy); } catch {}
              return;
            } catch {}
          }
        }
        setSettings(DEFAULT_SETTINGS);
      })
      .catch(() => { if (!cancelled) setSettings(DEFAULT_SETTINGS); });
    return () => { cancelled = true; };
  }, [settingsKey, authLoading]);

  const persist = useCallback((updated: Settings) => {
    AsyncStorage.setItem(getSettingsKey(user?.username), JSON.stringify(updated)).catch(() => {});
  }, [user?.username]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
