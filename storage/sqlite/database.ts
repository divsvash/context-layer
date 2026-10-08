import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import type { UnderstandingCandidate } from '../../ai/extraction/extractor';
import type { Interaction } from '../../interaction/normalize';
import type { CortexState, Project, ProjectEntryInput, ProjectEvidenceSummary, ProjectState } from '../../project/types';
import type { UnderstandingEntry, UnderstandingKind } from '../../understanding/entry';
import type { RawObservation } from '../../observer/clipboard';

export const SINGLE_PROJECT_ID = 'default-project';

const ENTRY_SELECT = `SELECT id, project_id as projectId, interaction_id as interactionId, kind, content, reason,
  provenance, status, superseded_by_id as supersededById, created_at as createdAt, updated_at as updatedAt
  FROM understanding_entries`;

export class SqliteStore {
  private readonly db: Database.Database;

  constructor(filename: string) {
    this.db = new Database(filename);
    this.db.pragma('foreign_keys = ON');
    this.createSchema();
    this.migrateLegacySchema();
    this.ensureProject();
    this.backfillProjectOwnership();
    this.db.pragma('user_version = 3');
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source TEXT NOT NULL, content TEXT NOT NULL, observed_at INTEGER NOT NULL, metadata_json TEXT);
      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, observation_id TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL, content TEXT NOT NULL, occurred_at INTEGER NOT NULL, metadata_json TEXT,
        extraction_status TEXT NOT NULL DEFAULT 'pending', extraction_error TEXT, extracted_at INTEGER,
        FOREIGN KEY (observation_id) REFERENCES observations(id)
      );
      CREATE TABLE IF NOT EXISTS understanding_entries (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, interaction_id TEXT,
        kind TEXT NOT NULL CHECK (kind IN ('goal','decision','constraint','question','technology','note')),
        content TEXT NOT NULL, reason TEXT, provenance TEXT NOT NULL DEFAULT 'observed',
        status TEXT NOT NULL DEFAULT 'active', superseded_by_id TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id), FOREIGN KEY (interaction_id) REFERENCES interactions(id)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  private migrateLegacySchema(): void {
    this.addColumnIfMissing('observations', 'project_id', 'TEXT');
    this.addColumnIfMissing('interactions', 'project_id', 'TEXT');
    this.addColumnIfMissing('interactions', 'extraction_status', "TEXT NOT NULL DEFAULT 'pending'");
    this.addColumnIfMissing('interactions', 'extraction_error', 'TEXT');
    this.addColumnIfMissing('interactions', 'extracted_at', 'INTEGER');
    this.addColumnIfMissing('understanding_entries', 'reason', 'TEXT');
    this.addColumnIfMissing('understanding_entries', 'provenance', "TEXT NOT NULL DEFAULT 'observed'");
    this.addColumnIfMissing('understanding_entries', 'status', "TEXT NOT NULL DEFAULT 'active'");
    this.addColumnIfMissing('understanding_entries', 'superseded_by_id', 'TEXT');
    this.db.exec('CREATE INDEX IF NOT EXISTS understanding_project_status ON understanding_entries(project_id, status)');
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!columns.some((item) => item.name === column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private backfillProjectOwnership(): void {
    const projectId = this.getActiveProject().id;
    this.db.prepare('UPDATE observations SET project_id = ? WHERE project_id IS NULL').run(projectId);
    this.db.prepare('UPDATE interactions SET project_id = ? WHERE project_id IS NULL').run(projectId);
  }

  ensureProject(name = 'Cortex'): Project {
    const projects = this.listProjects();
    if (projects.length > 0) {
      if (!this.getSetting('active_project_id')) this.setSetting('active_project_id', projects[0].id);
      return this.getActiveProject();
    }
    const now = Date.now();
    const project = { id: SINGLE_PROJECT_ID, name, createdAt: now, updatedAt: now };
    this.db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(project.id, project.name, now, now);
    this.setSetting('active_project_id', project.id);
    return project;
  }

  createProject(name: string): Project {
    const value = name.trim();
    if (!value) throw new Error('Project name cannot be empty');
    const now = Date.now();
    const project = { id: randomUUID(), name: value, createdAt: now, updatedAt: now };
    this.db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(project.id, project.name, now, now);
    this.setActiveProject(project.id);
    return project;
  }

  listProjects(): Project[] {
    return this.db.prepare('SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM projects ORDER BY updated_at DESC, created_at ASC').all() as Project[];
  }

  getProject(projectId: string): Project | null {
    return (this.db.prepare('SELECT id, name, created_at as createdAt, updated_at as updatedAt FROM projects WHERE id = ?').get(projectId) as Project | undefined) ?? null;
  }

  getActiveProject(): Project {
    const activeId = this.getSetting('active_project_id');
    const active = activeId ? this.getProject(activeId) : null;
    if (active) return active;
    const fallback = this.listProjects()[0];
    if (!fallback) throw new Error('Cortex requires at least one project');
    this.setSetting('active_project_id', fallback.id);
    return fallback;
  }

  setActiveProject(projectId: string): Project {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');
    this.setSetting('active_project_id', project.id);
    return project;
  }

  renameProject(name: string, projectId = this.getActiveProject().id): Project {
    const value = name.trim();
    if (!value) throw new Error('Project name cannot be empty');
    const now = Date.now();
    const result = this.db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(value, now, projectId);
    if (result.changes === 0) throw new Error('Project not found');
    return this.getProject(projectId) as Project;
  }

  deleteProject(projectId: string): void {
    if (!this.getProject(projectId)) throw new Error('Project not found');
    if (this.listProjects().length === 1) throw new Error('Create another project before deleting the last project');
    const remove = this.db.transaction(() => {
      this.db.prepare('DELETE FROM understanding_entries WHERE project_id = ?').run(projectId);
      this.db.prepare('DELETE FROM interactions WHERE project_id = ?').run(projectId);
      this.db.prepare('DELETE FROM observations WHERE project_id = ?').run(projectId);
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
      if (this.getSetting('active_project_id') === projectId) this.setSetting('active_project_id', this.listProjects()[0].id);
    });
    remove();
  }

  recordInteraction(observation: RawObservation, interaction: Interaction, projectId: string): void {
    if (!this.getProject(projectId)) throw new Error('Project not found');
    this.db.transaction(() => {
      this.db.prepare('INSERT INTO observations (id, project_id, source, content, observed_at) VALUES (?, ?, ?, ?, ?)').run(observation.id, projectId, observation.source, observation.content, observation.observedAt);
      this.db.prepare('INSERT INTO interactions (id, project_id, observation_id, source, content, occurred_at) VALUES (?, ?, ?, ?, ?, ?)').run(interaction.id, projectId, interaction.observationId, interaction.source, interaction.content, interaction.occurredAt);
    })();
  }

  addObservation(observation: RawObservation, projectId = this.getActiveProject().id): void {
    this.db.prepare('INSERT INTO observations (id, project_id, source, content, observed_at) VALUES (?, ?, ?, ?, ?)').run(observation.id, projectId, observation.source, observation.content, observation.observedAt);
  }

  addInteraction(interaction: Interaction, projectId = this.getActiveProject().id): void {
    this.db.prepare('INSERT INTO interactions (id, project_id, observation_id, source, content, occurred_at) VALUES (?, ?, ?, ?, ?, ?)').run(interaction.id, projectId, interaction.observationId, interaction.source, interaction.content, interaction.occurredAt);
  }

  addEntry(entry: UnderstandingEntry): void {
    this.insertEntry(entry);
    this.touchProject(entry.projectId, entry.updatedAt);
  }

  addManualEntry(input: ProjectEntryInput, projectId = this.getActiveProject().id): UnderstandingEntry {
    const content = input.content.trim();
    if (!content) throw new Error('Entry content cannot be empty');
    const now = Date.now();
    const entry = this.makeEntry(projectId, null, input.kind, content, input.reason ?? null, 'manual', now);
    this.addEntry(entry);
    return entry;
  }

  applyExtractedEntries(projectId: string, interactionId: string, candidates: UnderstandingCandidate[]): UnderstandingEntry[] {
    const created: UnderstandingEntry[] = [];
    this.db.transaction(() => {
      for (const candidate of candidates) {
        const duplicate = this.db.prepare("SELECT id FROM understanding_entries WHERE project_id = ? AND status = 'active' AND kind = ? AND lower(content) = lower(?)").get(projectId, candidate.kind, candidate.content) as { id: string } | undefined;
        if (duplicate) continue;
        const now = Date.now();
        const entry = this.makeEntry(projectId, interactionId, candidate.kind, candidate.content, candidate.reason, 'ai', now);
        this.insertEntry(entry);
        if (candidate.supersedesEntryId) {
          this.db.prepare("UPDATE understanding_entries SET status = 'superseded', superseded_by_id = ?, updated_at = ? WHERE id = ? AND project_id = ? AND status = 'active' AND provenance != 'manual'").run(entry.id, now, candidate.supersedesEntryId, projectId);
        }
        created.push(entry);
      }
      if (created.length > 0) this.touchProject(projectId, Date.now());
    })();
    return created;
  }

  replaceEntry(entryId: string, input: ProjectEntryInput): UnderstandingEntry {
    const existing = this.getEntry(entryId);
    if (!existing || existing.status !== 'active') throw new Error('Active knowledge entry not found');
    const content = input.content.trim();
    if (!content) throw new Error('Entry content cannot be empty');
    const now = Date.now();
    const replacement = this.makeEntry(existing.projectId, null, input.kind, content, input.reason ?? null, 'manual', now);
    this.db.transaction(() => {
      this.insertEntry(replacement);
      this.db.prepare("UPDATE understanding_entries SET status = 'superseded', superseded_by_id = ?, updated_at = ? WHERE id = ?").run(replacement.id, now, existing.id);
      this.touchProject(existing.projectId, now);
    })();
    return replacement;
  }

  deleteEntry(entryId: string): void {
    const existing = this.getEntry(entryId);
    if (!existing) throw new Error('Knowledge entry not found');
    this.db.prepare('UPDATE understanding_entries SET superseded_by_id = NULL WHERE superseded_by_id = ?').run(entryId);
    this.db.prepare('DELETE FROM understanding_entries WHERE id = ?').run(entryId);
    this.touchProject(existing.projectId, Date.now());
  }

  getEntry(entryId: string): UnderstandingEntry | null {
    return (this.db.prepare(`${ENTRY_SELECT} WHERE id = ?`).get(entryId) as UnderstandingEntry | undefined) ?? null;
  }

  getState(projectId = this.getActiveProject().id): ProjectState {
    const project = this.getProject(projectId);
    if (!project) throw new Error('Project not found');
    const entries = this.db.prepare(`${ENTRY_SELECT} WHERE project_id = ? ORDER BY created_at ASC`).all(projectId) as UnderstandingEntry[];
    return { project, entries };
  }

  getCortexState(): CortexState {
    const activeProject = this.getActiveProject();
    return { projects: this.listProjects(), activeProject, entries: this.getState(activeProject.id).entries };
  }

  getEvidenceSummary(projectId = this.getActiveProject().id): ProjectEvidenceSummary {
    const row = this.db.prepare(`
      SELECT
        count(*) as total,
        sum(CASE WHEN extraction_status IN ('pending', 'unavailable') THEN 1 ELSE 0 END) as pending,
        sum(CASE WHEN extraction_status = 'processed' THEN 1 ELSE 0 END) as processed,
        sum(CASE WHEN extraction_status = 'empty' THEN 1 ELSE 0 END) as empty,
        sum(CASE WHEN extraction_status = 'failed' THEN 1 ELSE 0 END) as failed,
        max(occurred_at) as lastCapturedAt
      FROM interactions WHERE project_id = ?
    `).get(projectId) as Record<string, number | null>;
    return {
      total: row.total ?? 0,
      pending: row.pending ?? 0,
      processed: row.processed ?? 0,
      empty: row.empty ?? 0,
      failed: row.failed ?? 0,
      lastCapturedAt: row.lastCapturedAt ?? null,
    };
  }

  getProcessableInteractions(projectId: string, limit = 20): Interaction[] {
    return this.db.prepare(`
      SELECT id, observation_id as observationId, source, content, occurred_at as occurredAt
      FROM interactions
      WHERE project_id = ? AND extraction_status IN ('pending', 'unavailable', 'failed')
      ORDER BY occurred_at ASC LIMIT ?
    `).all(projectId, limit) as Interaction[];
  }

  markInteractionExtraction(interactionId: string, status: 'processed' | 'empty' | 'failed' | 'unavailable', error: string | null = null): void {
    this.db.prepare('UPDATE interactions SET extraction_status = ?, extraction_error = ?, extracted_at = ? WHERE id = ?')
      .run(status, error, status === 'unavailable' ? null : Date.now(), interactionId);
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  deleteSetting(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  close(): void { this.db.close(); }

  private makeEntry(projectId: string, interactionId: string | null, kind: UnderstandingKind, content: string, reason: string | null, provenance: UnderstandingEntry['provenance'], now: number): UnderstandingEntry {
    return { id: randomUUID(), projectId, interactionId, kind, content, reason, provenance, status: 'active', supersededById: null, createdAt: now, updatedAt: now };
  }

  private insertEntry(entry: UnderstandingEntry): void {
    this.db.prepare('INSERT INTO understanding_entries (id, project_id, interaction_id, kind, content, reason, provenance, status, superseded_by_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(entry.id, entry.projectId, entry.interactionId, entry.kind, entry.content, entry.reason, entry.provenance, entry.status, entry.supersededById, entry.createdAt, entry.updatedAt);
  }

  private touchProject(projectId: string, timestamp: number): void {
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(timestamp, projectId);
  }
}
