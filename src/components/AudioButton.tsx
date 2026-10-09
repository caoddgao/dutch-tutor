import { Pause, Volume2 } from "lucide-react";
import { useAudio } from "../audio/context";
import { usePlayerState } from "../audio/hooks";
import { player } from "../audio/player";
import type { AudioRef } from "../content/model";

interface Props {
  audio: AudioRef | null | undefined;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Small round play button; greyed out when the item has no audio at all (design §5.1 step 4). */
export function AudioButton({ audio, label = "播放", size = "md", className = "" }: Props) {
  const { resolve, rate } = useAudio();
  const state = usePlayerState();
  const resolved = resolve(audio);
  const tag = audio ? `btn:${audio.id}` : "";
  const playing = state.playing && state.tag === tag;
  return (
    <button
      type="button"
      className={`audio-btn audio-btn-${size} ${className}`}
      disabled={!resolved}
      aria-label={resolved ? label : `${label}（暂无录音）`}
      title={resolved ? label : "暂无录音"}
      onClick={(e) => {
        e.stopPropagation();
        if (!resolved) return;
        if (playing) player.stop();
        else void player.play(resolved.url, { rate, tag });
      }}
    >
      {playing ? (
        <Pause size={size === "sm" ? 14 : 18} aria-hidden />
      ) : (
        <Volume2 size={size === "sm" ? 14 : 18} aria-hidden />
      )}
    </button>
  );
}
