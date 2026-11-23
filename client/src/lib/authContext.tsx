import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AccountPublic, NotificationItem } from '@shared/types';
import { apiLogout, fetchConfig, fetchMe, fetchNotifications, type ServerConfig } from './api';

interface AuthContextValue {
  user: AccountPublic | null;
  config: ServerConfig;
  notifications: NotificationItem[];
  loading: boolean;
  setUser: (u: AccountPublic | null) => void;
  refresh: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
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
  notifications: [],
  loading: true,
  setUser: () => {},
  refresh: async () => {},
  refreshNotifications: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AccountPublic | null>(null);
  const [config, setConfig] = useState<ServerConfig>(defaultConfig);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications();
      setNotifications(data.items);
    } catch {
      setNotifications([]);
    }
  }, []);

  const setUser = useCallback(
    (u: AccountPublic | null) => {
      setUserState(u);
      if (u) {
        void refreshNotifications();
      } else {
        setNotifications([]);
      }
    },
    [refreshNotifications],
  );

  const refresh = useCallback(async () => {
    try {
      const cfg = await fetchConfig();
      setConfig(cfg);
      if (cfg.dbEnabled) {
        const me = await fetchMe();
        setUserState(me.user);
        if (me.user) {
          const n = await fetchNotifications().catch(() => ({ count: 0, items: [] as NotificationItem[] }));
          setNotifications(n.items);
        } else {
          setNotifications([]);
        }
      } else {
        setUserState(null);
        setNotifications([]);
      }
    } catch {
      setUserState(null);
      setNotifications([]);
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
    setUserState(null);
    setNotifications([]);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, config, notifications, loading, setUser, refresh, refreshNotifications, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
