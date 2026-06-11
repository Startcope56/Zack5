import React, { createContext, useContext, useCallback, useState, useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("bluemedia_token"));
  const [userId, setUserId] = useState<number | null>(() => {
    const id = localStorage.getItem("bluemedia_userId");
    return id ? parseInt(id, 10) : null;
  });
  
  const queryClient = useQueryClient();

  const { data: user, isLoading: isUserLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  // Automatically logout on unauth
  useEffect(() => {
    if (token && !isUserLoading && !user) {
       // logout();
    }
  }, [token, isUserLoading, user]);

  const login = useCallback((newToken: string, newUserId: number) => {
    localStorage.setItem("bluemedia_token", newToken);
    localStorage.setItem("bluemedia_userId", newUserId.toString());
    setToken(newToken);
    setUserId(newUserId);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("bluemedia_token");
    localStorage.removeItem("bluemedia_userId");
    setToken(null);
    setUserId(null);
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
