import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useContent } from "../content/context";
import { useServices } from "../servicesContext";
import { useSettings } from "../settings/context";
import { AudioCtx, type AudioContextValue } from "./context";
import { player } from "./player";
import { RecordingStore } from "./recordings";
import { resolveAudio } from "./resolve";

export function AudioProvider({ children }: { children: ReactNode }) {
  const services = useServices();
  const { backend, ttsUrl, packStatus } = useContent();
  const { settings } = useSettings();
  // the session speed starts from (and follows changes of) the default in settings
  const [chosen, setChosen] = useState({ base: settings.playbackRate, rate: settings.playbackRate });
  const rate = chosen.base === settings.playbackRate ? chosen.rate : settings.playbackRate;
  const setRate = useCallback(
    (r: number) => setChosen({ base: settings.playbackRate, rate: r }),
    [settings.playbackRate],
  );
  const [voice, setVoice] = useState<Map<string, string>>(new Map());
  const recordings = useMemo(() => new RecordingStore(services.db, services.recordingFiles), [services]);
  const refreshVoice = useCallback(async () => setVoice(await recordings.voiceUrls()), [recordings]);

  useEffect(() => player.setRate(rate), [rate]);

  useEffect(() => {
    let cancelled = false;
    recordings
      .voiceUrls()
      .then((m) => !cancelled && setVoice(m))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [recordings]);

  const value: AudioContextValue = useMemo(
    () => ({
      resolve: (ref) =>
        resolveAudio(ref, {
          voiceUrl: (id) => voice.get(id),
          packUrl: (rel) => (packStatus === "ready" ? backend.audioUrl(rel) : ""),
          ttsUrl,
        }),
      rate,
      setRate,
      recordings,
      refreshVoice,
    }),
    [voice, backend, packStatus, ttsUrl, rate, setRate, recordings, refreshVoice],
  );
  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}
