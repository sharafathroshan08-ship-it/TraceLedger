"use client";

import * as React from "react";
import { ensureSession, getSessionInfo, resetDataset } from "@/lib/api";
import type { SessionInfo } from "@/types";

interface SessionContextValue {
  session: SessionInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  reset: () => Promise<void>;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<SessionInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setError(null);
      const info = await getSessionInfo();
      setSession(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the backend");
    }
  }, []);

  const reset = React.useCallback(async () => {
    const info = await resetDataset();
    setSession(info);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const info = await ensureSession();
        if (!cancelled) setSession(info);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to reach the backend");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, loading, error, refresh, reset }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
