import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppSettingsState {
  adBlock: boolean;
  webrtcBlock: boolean;
  dnsOverProxy: boolean;
  incognito: boolean;
  quicDisabled: boolean;
  // When true, the browser refuses to load pages until a proxy is connected.
  // When false, the user can browse unprotected (with a warning banner shown).
  requireProxy: boolean;
  desktopSiteDefault: boolean;
}

const DEFAULTS: AppSettingsState = {
  adBlock: true,
  webrtcBlock: true,
  dnsOverProxy: true,
  incognito: true,
  quicDisabled: true,
  requireProxy: true,
  desktopSiteDefault: false,
};

const STORAGE_KEY = 'phantom_app_settings';

interface AppSettingsContextType extends AppSettingsState {
  loaded: boolean;
  update: <K extends keyof AppSettingsState>(key: K, value: AppSettingsState[K]) => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export function AppSettingsProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<AppSettingsState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState({...DEFAULTS, ...JSON.parse(raw)});
        }
      } catch {
        // fall back to defaults silently
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = useCallback(<K extends keyof AppSettingsState>(key: K, value: AppSettingsState[K]) => {
    setState(prev => {
      const next = {...prev, [key]: value};
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <AppSettingsContext.Provider value={{...state, loaded, update}}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppSettingsProvider');
  return ctx;
}
