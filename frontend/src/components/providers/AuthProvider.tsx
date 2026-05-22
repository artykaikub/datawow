"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/api";
import type { UserProfile } from "@/api";
import { forceLogout } from "@/lib/axios-instance";

interface AuthContextValue {
  /** Current user profile (null = not logged in) */
  user: UserProfile | null;
  /** True while initial auth check is in progress */
  isLoading: boolean;
  /** True if user is authenticated */
  isAuthenticated: boolean;
  /** Store token + user after login/register */
  setAuth: (accessToken: string, user: UserProfile) => void;
  /** Clear auth and redirect to login */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Public routes that don't require authentication */
const PUBLIC_PATHS = ["/", "/login", "/register"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}?`) || path.startsWith(`${p}/`)
  );
}

/**
 * Sync a lightweight 'auth_role' cookie for Next.js middleware.
 * This cookie only contains the role hint — NOT the actual JWT.
 */
function syncAuthCookie(role: string | null) {
  if (role) {
    document.cookie = `auth_role=${role}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  } else {
    document.cookie = 'auth_role=; path=/; max-age=0';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // C-3 fix: Load user from localStorage + verify with api.getProfile()
  // F-M1 fix: Skip verification if already verified this session
  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("accessToken");
      const savedUser = localStorage.getItem("user");

      if (!token || !savedUser) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Optimistic: show saved user immediately to avoid flash
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // Invalid JSON in localStorage
      }

      // Always verify token is still valid on refresh
      try {
        const profile = await api.getProfile();
        setUser(profile);
        localStorage.setItem("user", JSON.stringify(profile));
        syncAuthCookie(profile.role ?? "user");
        setIsLoading(false);
      } catch {
        // Token expired or invalid → forceLogout handles clear + redirect
        forceLogout();
      }
    }

    checkAuth();
  }, []);

  // C-1 fix: Route protection — redirect if not authenticated or wrong role
  useEffect(() => {
    if (isLoading) return;

    // Don't redirect on public paths
    if (isPublicPath(pathname)) return;

    // Not logged in → redirect to login
    if (!user) {
      router.replace("/login");
      return;
    }

    // Role-based protection
    if (pathname.startsWith("/admin") && user.role !== "admin") {
      router.replace("/user");
      return;
    }
  }, [isLoading, user, pathname, router]);

  // C-2 fix: Logout handler
  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    syncAuthCookie(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  const setAuth = useCallback(
    (accessToken: string, newUser: UserProfile) => {
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      syncAuthCookie(newUser.role ?? "user");
      setUser(newUser);
    },
    []
  );

  const isAuthenticated = !!user;

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated, setAuth, logout }),
    [user, isLoading, isAuthenticated, setAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
