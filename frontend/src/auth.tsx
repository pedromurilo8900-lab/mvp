import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { ApiError, api, setToken } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  birth_date?: string | null;
  patient_id: string;
  role?: string;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, birth?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const t = await AsyncStorage.getItem("calen.token");
      if (!t) { setUser(null); return; }
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST", auth: false, body: JSON.stringify({ email, password }),
    });
    await setToken(res.token);
    setUser(res.user);
    router.replace("/(tabs)/home");
  };

  const register = async (email: string, password: string, name: string, birth?: string) => {
    const res = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST", auth: false,
      body: JSON.stringify({ email, password, name, birth_date: birth || null }),
    });
    await setToken(res.token);
    setUser(res.user);
    router.replace("/(tabs)/home");
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
    router.replace("/(auth)/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Ctx {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
