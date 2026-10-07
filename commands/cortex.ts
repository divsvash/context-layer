import type { UnderstandingCandidate, UnderstandingExtractor } from '../ai/extraction/extractor';
import { compileProjectContext } from '../context/compiler/compile';
import { normalizeObservation } from '../interaction/normalize';
import { ClipboardObserver, type RawObservation } from '../observer/clipboard';
import type { CortexState, Project, ProjectEntryInput, ProjectState } from '../project/types';
import type { CredentialStore } from '../storage/credentials';
import type { SqliteStore } from '../storage/sqlite/database';
import type { UnderstandingEntry, UnderstandingKind } from '../understanding/entry';

export type ActivityStatus = 'Observing' | 'Paused' | 'Captured' | 'Understanding updated' | 'Context copied' | 'Extraction unavailable' | 'Extraction failed';

export interface CortexRuntimeState extends CortexState {
  observing: boolean;
  activity: ActivityStatus;
  aiConfigured: boolean;
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
  replaceEntry(entryId: string, input: ProjectEntryInput): UnderstandingEntry;
  deleteEntry(entryId: string): void;
  close(): void;
}

export class CortexCommands {
  readonly observer: ClipboardObserver;
  private activity: ActivityStatus = 'Observing';
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
        console.error('Clipboard observation failed:', error);
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
  }

  clearApiKey(): void {
    this.credentials.clearApiKey();
    this.activity = 'Extraction unavailable';
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
      this.activity = 'Extraction unavailable';
      return;
    }

    try {
      const state = this.store.getState(project.id);
      const candidates = await this.extractor.extract({
        interaction,
        project,
        activeEntries: state.entries.filter((entry) => entry.status === 'active'),
      });
      const created = this.store.applyExtractedEntries(project.id, interaction.id, candidates);
      this.activity = created.length > 0 ? 'Understanding updated' : 'Captured';
    } catch (error) {
      this.activity = 'Extraction failed';
      console.error('Understanding extraction failed:', error instanceof Error ? error.message : error);
    }
  }
}

export type SqliteCortexStore = Pick<SqliteStore, keyof CortexPersistence>;
