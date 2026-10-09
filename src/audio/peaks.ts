// Waveform data: peak amplitude per bar, decoded with the Web Audio API and cached per URL.

const cache = new Map<string, Promise<number[] | null>>();
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/** Max |sample| per bucket, scaled so the loudest bar is 1. */
export function computePeaks(samples: Float32Array, bars: number): number[] {
  const out = new Array<number>(bars).fill(0);
  if (samples.length === 0) return out;
  const size = samples.length / bars;
  for (let b = 0; b < bars; b++) {
    const from = Math.floor(b * size);
    const to = Math.max(from + 1, Math.floor((b + 1) * size));
    let max = 0;
    for (let i = from; i < to && i < samples.length; i++) {
      const v = Math.abs(samples[i]);
      if (v > max) max = v;
    }
    out[b] = max;
  }
  const top = Math.max(...out);
  return top > 0 ? out.map((v) => v / top) : out;
}

export async function decodePeaks(
  data: ArrayBuffer,
  bars: number,
  start?: number,
  end?: number,
): Promise<number[] | null> {
  const ac = audioContext();
  if (!ac) return null;
  const buffer = await ac.decodeAudioData(data);
  let samples = buffer.getChannelData(0);
  if (start !== undefined || end !== undefined) {
    const s = Math.floor((start ?? 0) * buffer.sampleRate);
    const e = Math.min(samples.length, Math.floor((end ?? buffer.duration) * buffer.sampleRate));
    samples = samples.subarray(s, e);
  }
  return computePeaks(samples, bars);
}

export function loadPeaks(url: string, bars: number, start?: number, end?: number): Promise<number[] | null> {
  const key = `${url}|${bars}|${start ?? ""}|${end ?? ""}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => decodePeaks(buf, bars, start, end))
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}
