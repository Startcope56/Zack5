import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { useGetMe, getGetMeQueryKey, setAuthTokenGetter } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem("bluemedia_token");
    // Register immediately on first render so queries fired before login also work
    setAuthTokenGetter(() => localStorage.getItem("bluemedia_token"));
    return saved;
  });

  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  const login = useCallback((newToken: string, newUserId: number) => {
    localStorage.setItem("bluemedia_token", newToken);
    localStorage.setItem("bluemedia_userId", newUserId.toString());
    setAuthTokenGetter(() => localStorage.getItem("bluemedia_token"));
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("bluemedia_token");
    localStorage.removeItem("bluemedia_userId");
    setAuthTokenGetter(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const isLoading = !!token && isUserLoading;

  return (
    <AuthContext.Provider value={{ user: user || null, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
