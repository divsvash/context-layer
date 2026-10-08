import type { UnderstandingCandidate, UnderstandingExtractor } from '../ai/extraction/extractor';
import { compileProjectContext } from '../context/compiler/compile';
import { normalizeObservation } from '../interaction/normalize';
import { ClipboardObserver, type RawObservation } from '../observer/clipboard';
import type { CortexState, Project, ProjectEntryInput, ProjectEvidenceSummary, ProjectState } from '../project/types';
import type { CredentialStore } from '../storage/credentials';
import type { SqliteStore } from '../storage/sqlite/database';
import type { UnderstandingEntry, UnderstandingKind } from '../understanding/entry';

export type ActivityStatus = 'Observing' | 'Paused' | 'Captured' | 'Processing evidence' | 'Understanding updated' | 'No project knowledge found' | 'Context copied' | 'Extraction unavailable' | 'Extraction failed';

export interface CortexRuntimeState extends CortexState {
  observing: boolean;
  activity: ActivityStatus;
  aiConfigured: boolean;
  evidence: ProjectEvidenceSummary;
  lastError: string | null;
}

export interface CortexPersistence {
  getCortexState(): CortexState;
  getActiveProject(): Project;
  getState(projectId?: string): ProjectState;
  createProject(name: string): Project;
  setActiveProject(projectId: string): Project;
  renameProject(name: string, projectId?: string): Project;
  deleteProject(projectId: string): void;
  recordInteraction(observation: RawObservation, interaction: ReturnType<typeof normalizeObservation>, projectId: string): void;
  addManualEntry(input: ProjectEntryInput, projectId?: string): UnderstandingEntry;
  applyExtractedEntries(projectId: string, interactionId: string, candidates: UnderstandingCandidate[]): UnderstandingEntry[];
  getEvidenceSummary(projectId?: string): ProjectEvidenceSummary;
  getProcessableInteractions(projectId: string, limit?: number): ReturnType<typeof normalizeObservation>[];
  markInteractionExtraction(interactionId: string, status: 'processed' | 'empty' | 'failed' | 'unavailable', error?: string | null): void;
  replaceEntry(entryId: string, input: ProjectEntryInput): UnderstandingEntry;
  deleteEntry(entryId: string): void;
  close(): void;
}

export class CortexCommands {
  readonly observer: ClipboardObserver;
  private activity: ActivityStatus = 'Observing';
  private lastError: string | null = null;
  private readonly writeClipboard: (content: string) => void;

  constructor(
    private readonly store: CortexPersistence,
    private readonly extractor: UnderstandingExtractor,
    private readonly credentials: Pick<CredentialStore, 'hasApiKey' | 'setApiKey' | 'clearApiKey'>,
    readClipboard: () => string,
    writeClipboard: (content: string) => void,
    intervalMs = 500,
  ) {
    this.observer = new ClipboardObserver({
      read: readClipboard,
      intervalMs,
      onObservation: (observation) => this.processObservation(observation),
      onError: (error) => {
        this.activity = 'Extraction failed';
        this.lastError = safeError(error);
        console.error('Clipboard observation failed:', this.lastError);
      },
    });
    this.writeClipboard = (content) => {
      this.observer.markGeneratedWrite(content);
      writeClipboard(content);
    };
  }

  start(): void {
    this.observer.start();
    this.activity = this.extractor.isAvailable() ? 'Observing' : 'Extraction unavailable';
  }

  stop(): void {
    this.observer.stop();
    this.activity = 'Paused';
  }

  state(): CortexRuntimeState {
    return {
      ...this.store.getCortexState(),
      observing: this.observer.isRunning(),
      activity: this.activity,
      aiConfigured: this.credentials.hasApiKey(),
      evidence: this.store.getEvidenceSummary(),
      lastError: this.lastError,
    };
  }

  createProject(name: string): Project { return this.store.createProject(name); }
  switchProject(projectId: string): Project { return this.store.setActiveProject(projectId); }
  renameProject(name: string): Project { return this.store.renameProject(name); }
  deleteProject(projectId: string): void { this.store.deleteProject(projectId); }
  addManualEntry(kind: UnderstandingKind, content: string): UnderstandingEntry { return this.store.addManualEntry({ kind, content }); }
  updateEntry(entryId: string, kind: UnderstandingKind, content: string): UnderstandingEntry { return this.store.replaceEntry(entryId, { kind, content }); }
  deleteEntry(entryId: string): void { this.store.deleteEntry(entryId); }

  setApiKey(apiKey: string): void {
    this.credentials.setApiKey(apiKey);
    this.activity = 'Observing';
    this.lastError = null;
  }

  clearApiKey(): void {
    this.credentials.clearApiKey();
    this.activity = 'Extraction unavailable';
    this.lastError = null;
  }

  async processPendingEvidence(limit = 20): Promise<number> {
    if (!this.extractor.isAvailable()) {
      this.activity = 'Extraction unavailable';
      this.lastError = 'Configure an API key before processing captured evidence.';
      return 0;
    }
    const project = this.store.getActiveProject();
    const interactions = this.store.getProcessableInteractions(project.id, limit);
    let updated = 0;
    this.activity = 'Processing evidence';
    for (const interaction of interactions) updated += await this.extractInteraction(project, interaction);
    if (interactions.length === 0) this.activity = 'Observing';
    return updated;
  }

  generateContext(): string {
    const context = compileProjectContext(this.store.getState());
    this.writeClipboard(context);
    this.activity = 'Context copied';
    return context;
  }

  close(): void {
    this.stop();
    this.store.close();
  }

  private async processObservation(observation: RawObservation): Promise<void> {
    const project = this.store.getActiveProject();
    const interaction = normalizeObservation(observation);
    this.store.recordInteraction(observation, interaction, project.id);
    this.activity = 'Captured';

    if (!this.extractor.isAvailable()) {
      this.store.markInteractionExtraction(interaction.id, 'unavailable');
      this.activity = 'Extraction unavailable';
      return;
    }

    await this.extractInteraction(project, interaction);
  }

  private async extractInteraction(project: Project, interaction: ReturnType<typeof normalizeObservation>): Promise<number> {
    try {
      const state = this.store.getState(project.id);
      const candidates = await this.extractor.extract({
        interaction,
        project,
        activeEntries: state.entries.filter((entry) => entry.status === 'active'),
      });
      const created = this.store.applyExtractedEntries(project.id, interaction.id, candidates);
      this.store.markInteractionExtraction(interaction.id, created.length > 0 ? 'processed' : 'empty');
      this.lastError = null;
      this.activity = created.length > 0 ? 'Understanding updated' : 'No project knowledge found';
      return created.length;
    } catch (error) {
      const message = safeError(error);
      this.store.markInteractionExtraction(interaction.id, 'failed', message);
      this.activity = 'Extraction failed';
      this.lastError = message;
      console.error('Understanding extraction failed:', message);
      return 0;
    }
  }
}

export type SqliteCortexStore = Pick<SqliteStore, keyof CortexPersistence>;

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/sk-[A-Za-z0-9_-]{4,}/gi, '[redacted]').slice(0, 300);
}
