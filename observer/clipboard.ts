import { randomUUID } from 'node:crypto';

export interface RawObservation {
  id: string;
  source: 'clipboard';
  content: string;
  observedAt: number;
}

export interface ClipboardObserverOptions {
  read: () => string;
  intervalMs?: number;
  now?: () => number;
  createId?: () => string;
  onObservation: (observation: RawObservation) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export class ClipboardObserver {
  private readonly read: () => string;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly onObservation: (observation: RawObservation) => void | Promise<void>;
  private readonly onError: (error: unknown) => void;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastContent: string | null = null;
  private pendingGeneratedContent: string | null = null;

  constructor(options: ClipboardObserverOptions) {
    this.read = options.read;
    this.intervalMs = options.intervalMs ?? 500;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? randomUUID;
    this.onObservation = options.onObservation;
    this.onError = options.onError ?? ((error) => console.error('Clipboard observation failed:', error));
  }

  start(): void {
    if (this.timer !== null) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  markGeneratedWrite(content: string): void {
    this.pendingGeneratedContent = content;
  }

  async poll(): Promise<void> {
    try {
      const content = this.read();
      if (this.pendingGeneratedContent === content) {
        this.pendingGeneratedContent = null;
        this.lastContent = content;
        return;
      }
      if (content === this.lastContent) return;
      this.lastContent = content;

      if (content.trim().length === 0) return;
      await this.onObservation({ id: this.createId(), source: 'clipboard', content, observedAt: this.now() });
    } catch (error) {
      this.onError(error);
    }
  }
}
