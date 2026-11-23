import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AccountPublic } from '@shared/types';
import { apiLogout, fetchConfig, fetchMe, type ServerConfig } from './api';

interface AuthContextValue {
  user: AccountPublic | null;
  config: ServerConfig;
  loading: boolean;
  setUser: (u: AccountPublic | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultConfig: ServerConfig = {
  dbEnabled: false,
  needsFirstTeacher: false,
  teacherInviteRequired: false,
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  config: defaultConfig,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountPublic | null>(null);
  const [config, setConfig] = useState<ServerConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const cfg = await fetchConfig();
      setConfig(cfg);
      if (cfg.dbEnabled) {
        const me = await fetchMe();
        setUser(me.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, config, loading, setUser, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
