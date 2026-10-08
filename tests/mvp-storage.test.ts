import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileProjectContext } from '../context/compiler/compile';
import { SqliteStore } from '../storage/sqlite/database';

describe('MVP SQLite project state', () => {
  it('persists active project selection and isolates knowledge between projects', () => {
    withDatabase((filename) => {
      const first = new SqliteStore(filename);
      const projectA = first.renameProject('Project A');
      first.addManualEntry({ kind: 'goal', content: 'Goal A' });
      const projectB = first.createProject('Project B');
      first.addManualEntry({ kind: 'constraint', content: 'Constraint B' });
      expect(first.getState(projectA.id).entries.map((item) => item.content)).toEqual(['Goal A']);
      expect(first.getState(projectB.id).entries.map((item) => item.content)).toEqual(['Constraint B']);
      first.setActiveProject(projectA.id);
      first.close();

      const reopened = new SqliteStore(filename);
      expect(reopened.getActiveProject().id).toBe(projectA.id);
      expect(reopened.listProjects()).toHaveLength(2);
      reopened.close();
    });
  });

  it('preserves corrected knowledge as superseded history while projecting only current truth', () => {
    const store = new SqliteStore(':memory:');
    const original = store.addManualEntry({ kind: 'decision', content: 'Use Tauri' });
    const replacement = store.replaceEntry(original.id, { kind: 'decision', content: 'Use Electron' });
    const state = store.getState();
    expect(state.entries.find((item) => item.id === original.id)).toMatchObject({ status: 'superseded', supersededById: replacement.id });
    expect(state.entries.find((item) => item.id === replacement.id)).toMatchObject({ status: 'active', provenance: 'manual' });
    const context = compileProjectContext(state);
    expect(context).toContain('KEY DECISIONS\n- Use Electron');
    expect(context).toContain('IMPORTANT HISTORICAL CONTEXT\n- Previously decision: Use Tauri');
    store.close();
  });

  it('deletes a confirmed project payload and selects a remaining project', () => {
    const store = new SqliteStore(':memory:');
    const original = store.getActiveProject();
    const removable = store.createProject('Temporary');
    store.addManualEntry({ kind: 'note', content: 'Temporary knowledge' });
    store.deleteProject(removable.id);
    expect(store.getActiveProject().id).toBe(original.id);
    expect(store.listProjects()).toHaveLength(1);
    store.close();
  });

  it('tracks captured evidence processing state for recovery and visibility', () => {
    const store = new SqliteStore(':memory:');
    const project = store.getActiveProject();
    store.recordInteraction(
      { id: 'o1', source: 'clipboard', content: 'Useful evidence', observedAt: 10 },
      { id: 'i1', observationId: 'o1', source: 'clipboard', content: 'Useful evidence', occurredAt: 10 },
      project.id,
    );
    expect(store.getEvidenceSummary()).toMatchObject({ total: 1, pending: 1, processed: 0, failed: 0 });
    expect(store.getProcessableInteractions(project.id)).toHaveLength(1);
    store.markInteractionExtraction('i1', 'processed');
    expect(store.getEvidenceSummary()).toMatchObject({ total: 1, pending: 0, processed: 1 });
    store.close();
  });
});

function withDatabase(run: (filename: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'cortex-mvp-'));
  try { run(join(directory, 'cortex.sqlite')); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}
