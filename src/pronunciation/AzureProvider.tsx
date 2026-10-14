import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AzureContext, type Assessment, type AzureStatus } from "./context";
import { recordingToWav } from "./wav";

export function AzureProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AzureStatus | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    invoke<AzureStatus>("azure_status")
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (region: string, key: string, enabled: boolean) => {
    const value = await invoke<AzureStatus>("save_azure_config", { region, key: key.trim() || null, enabled });
    setStatus(value);
  }, []);
  const clearKey = useCallback(async () => setStatus(await invoke<AzureStatus>("clear_azure_key")), []);
  const testConnection = useCallback(async () => {
    await invoke("test_azure_connection");
  }, []);
  const assess = useCallback(async (blob: Blob, reference: string): Promise<Assessment> => {
    const { bytes, duration } = await recordingToWav(blob);
    const result = await invoke<Assessment>("assess_pronunciation", {
      audio: Array.from(bytes),
      referenceText: reference,
      duration,
    });
    setStatus((previous) => (previous ? { ...previous, month_seconds: result.month_seconds } : previous));
    return result;
  }, []);

  const value = useMemo(
    () => ({ status, save, clearKey, testConnection, assess }),
    [status, save, clearKey, testConnection, assess],
  );
  return <AzureContext.Provider value={value}>{children}</AzureContext.Provider>;
}
