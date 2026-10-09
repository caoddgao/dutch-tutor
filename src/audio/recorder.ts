// Microphone recording for shadowing (design §5.3), through the WebView's media APIs.

export type RecorderErrorCode = "denied" | "no_device" | "busy" | "unsupported";

export class RecorderError extends Error {
  constructor(readonly code: RecorderErrorCode) {
    super(code);
  }
}

export function recorderErrorMessage(code: RecorderErrorCode): string {
  switch (code) {
    case "denied":
      return "无法使用麦克风。请在 Windows 设置 → 隐私和安全性 → 麦克风 里，打开“允许桌面应用访问麦克风”，然后再试。";
    case "no_device":
      return "没有找到麦克风。请插上耳机麦克风或检查声音设置。";
    case "busy":
      return "麦克风正被其他程序占用，请关闭那个程序后再试。";
    default:
      return "这台电脑上暂时无法录音。";
  }
}

export interface Recording {
  blob: Blob;
  mime: string;
  /** seconds */
  duration: number;
}

export interface ActiveRecording {
  stop(): Promise<Recording>;
  cancel(): void;
}

function pickMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const c of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  return "";
}

export async function startRecording(): Promise<ActiveRecording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new RecorderError("unsupported");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === "NotAllowedError" || name === "SecurityError") throw new RecorderError("denied");
    if (name === "NotFoundError" || name === "OverconstrainedError") throw new RecorderError("no_device");
    if (name === "NotReadableError" || name === "AbortError") throw new RecorderError("busy");
    throw new RecorderError("unsupported");
  }
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };
  const started = performance.now();
  rec.start();
  const release = () => stream.getTracks().forEach((t) => t.stop());
  return {
    stop: () =>
      new Promise<Recording>((resolve) => {
        rec.onstop = () => {
          release();
          const type = rec.mimeType || mime || "audio/webm";
          resolve({ blob: new Blob(chunks, { type }), mime: type, duration: (performance.now() - started) / 1000 });
        };
        rec.stop();
      }),
    cancel: () => {
      rec.onstop = release;
      if (rec.state !== "inactive") rec.stop();
      else release();
    },
  };
}

export function extensionFor(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}
