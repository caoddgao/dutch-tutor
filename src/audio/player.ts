// One shared audio element for the whole app: starting a sound stops the previous one.
// Slow playback uses playbackRate with preservesPitch (speed changes, pitch does not; design §5.3).

export interface PlayerState {
  url: string | null;
  playing: boolean;
  /** 0–1 */
  progress: number;
  /** Seconds, once known */
  duration: number;
  /** Optional tag so a component knows the sound is "its" sound */
  tag: string | null;
}

type Listener = (s: PlayerState) => void;

export interface PlayOptions {
  rate?: number;
  tag?: string;
  /** Play only this part of the file, seconds */
  start?: number;
  end?: number;
}

export class AudioPlayer {
  private el: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private state: PlayerState = { url: null, playing: false, progress: 0, duration: 0, tag: null };
  private endAt: number | null = null;
  private startAt = 0;
  private resolveDone: (() => void) | null = null;
  private seq = 0;
  private stoppedSeq = -1;

  private audio(): HTMLAudioElement {
    if (this.el) return this.el;
    const el = new Audio();
    el.preload = "auto";
    el.preservesPitch = true;
    el.addEventListener("timeupdate", () => {
      if (this.endAt !== null && el.currentTime >= this.endAt) {
        el.pause();
        this.finish();
        return;
      }
      this.emit({ progress: this.progressOf(el) });
    });
    el.addEventListener("loadedmetadata", () => this.emit({ duration: el.duration }));
    el.addEventListener("ended", () => this.finish());
    el.addEventListener("error", () => this.finish());
    this.el = el;
    return el;
  }

  private progressOf(el: HTMLAudioElement): number {
    const end = this.endAt ?? el.duration;
    const len = end - this.startAt;
    if (!Number.isFinite(len) || len <= 0) return 0;
    return Math.min(1, Math.max(0, (el.currentTime - this.startAt) / len));
  }

  private emit(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  private finish() {
    this.emit({ playing: false, progress: this.state.url ? 1 : 0 });
    const done = this.resolveDone;
    this.resolveDone = null;
    done?.();
  }

  getState(): PlayerState {
    return this.state;
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** Plays a URL; resolves when it ends or is stopped. */
  play(url: string, opts: PlayOptions = {}): Promise<void> {
    this.halt();
    const el = this.audio();
    const seq = ++this.seq;
    this.startAt = opts.start ?? 0;
    this.endAt = opts.end ?? null;
    if (el.src !== url) el.src = url;
    el.playbackRate = opts.rate ?? 1;
    el.preservesPitch = true;
    try {
      el.currentTime = this.startAt;
    } catch {
      // not seekable yet; starts from 0
    }
    this.emit({ url, playing: true, progress: 0, tag: opts.tag ?? null });
    return new Promise<void>((resolve) => {
      this.resolveDone = resolve;
      const started = el.play() as Promise<void> | undefined;
      started?.catch(() => {
        if (seq === this.seq) this.finish();
      });
    });
  }

  /** Plays several URLs one after another (e.g. original, then the learner's own). */
  async playSequence(items: { url: string; opts?: PlayOptions }[]): Promise<void> {
    for (const item of items) {
      const done = this.play(item.url, item.opts);
      const mine = this.seq;
      await done;
      // another sound was started, or the user pressed stop
      if (this.seq !== mine || this.stoppedSeq === mine) return;
    }
  }

  /** Stops playback (a running sequence ends too). */
  stop() {
    this.stoppedSeq = this.seq;
    this.halt();
  }

  private halt() {
    if (!this.el) return;
    this.el.pause();
    if (this.state.playing) this.finish();
  }

  setRate(rate: number) {
    if (this.el) this.el.playbackRate = rate;
  }
}

export const player = new AudioPlayer();
