import type { SettingsStore } from "../storage/settingsStore";

export function memoryStore(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const store: SettingsStore = {
    load: async () => ({ ...data }),
    save: async (key, value) => {
      data[key] = value;
    },
  };
  return { data, store };
}
