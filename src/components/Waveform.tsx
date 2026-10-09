import "./Waveform.css";

interface Props {
  peaks: number[] | null;
  /** 0–1, part already played */
  progress?: number;
  bars?: number;
  variant?: "original" | "mine" | "light";
  label?: string;
}

/** Bar waveform. While loading (or if the file cannot be decoded) it shows a flat line of bars. */
export function Waveform({ peaks, progress = 0, bars = 64, variant = "original", label }: Props) {
  const values = peaks ?? new Array<number>(bars).fill(0.08);
  const played = Math.round(progress * values.length);
  return (
    <div className={`waveform waveform-${variant}${peaks ? "" : " is-empty"}`} role="img" aria-label={label ?? "声波"}>
      {values.map((v, i) => (
        <span
          key={i}
          className={i < played ? "is-played" : undefined}
          style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
        />
      ))}
    </div>
  );
}
