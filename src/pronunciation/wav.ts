const SAMPLE_RATE = 16_000;

/** Azure's short-audio REST endpoint accepts mono 16 kHz PCM WAV. */
export function encodePcmWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.min(1, Math.max(-1, samples[i]));
    view.setInt16(44 + i * 2, clipped < 0 ? clipped * 32768 : clipped * 32767, true);
  }
  return bytes;
}

export async function recordingToWav(blob: Blob): Promise<{ bytes: Uint8Array; duration: number }> {
  const Ctor = window.AudioContext;
  const OfflineCtor = window.OfflineAudioContext;
  if (!Ctor || !OfflineCtor) throw new Error("audio_unsupported");
  const context = new Ctor();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close();
  }
  if (decoded.duration < 0.1 || decoded.duration > 60) throw new Error("audio_length");
  const frames = Math.ceil(decoded.duration * SAMPLE_RATE);
  const offline = new OfflineCtor(1, frames, SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return { bytes: encodePcmWav(rendered.getChannelData(0)), duration: rendered.duration };
}
