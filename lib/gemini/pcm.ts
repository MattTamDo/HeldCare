export function floatTo16BitPcm(
  input: Float32Array,
  inputRate: number,
  outputRate = 16_000,
): Int16Array {
  const ratio = inputRate / outputRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(length);

  for (let i = 0; i < length; i++) {
    const sample = input[Math.min(input.length - 1, Math.round(i * ratio))] ?? 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  return output;
}

export function pcm16ToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export class PcmPlayer {
  private context: AudioContext | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  private readonly sampleRate = 24_000;
  private idleTimer: number | undefined;
  private listener?: (playing: boolean) => void;

  onPlayback(listener: (playing: boolean) => void) {
    this.listener = listener;
  }

  isPlaying(): boolean {
    return this.remaining() > 0.04 || this.sources.size > 0;
  }

  remaining(): number {
    if (!this.context) return 0;
    return Math.max(0, this.nextTime - this.context.currentTime);
  }

  async resume() {
    const context = this.ensureContext();
    if (context.state === "suspended") await context.resume();
  }

  play(base64: string) {
    const context = this.ensureContext();
    const pcm = base64ToInt16(base64);
    if (pcm.length === 0) return;

    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) floats[i] = (pcm[i] ?? 0) / 0x8000;

    const buffer = context.createBuffer(1, floats.length, this.sampleRate);
    buffer.copyToChannel(floats, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      this.sources.delete(source);
      this.armIdleCheck();
    };
    this.sources.add(source);

    const now = context.currentTime;
    if (this.nextTime < now) this.nextTime = now;
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
    this.listener?.(true);
    this.armIdleCheck();
  }

  interrupt() {
    window.clearTimeout(this.idleTimer);
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    if (this.context) this.nextTime = this.context.currentTime;
    this.listener?.(false);
  }

  close() {
    this.interrupt();
    void this.context?.close();
    this.context = null;
  }

  private armIdleCheck() {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (!this.isPlaying()) this.listener?.(false);
    }, this.remaining() * 1000 + 50);
  }

  private ensureContext(): AudioContext {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: this.sampleRate });
      this.nextTime = 0;
    }
    return this.context;
  }
}
