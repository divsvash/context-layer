import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClipboardObserver } from '../observer/clipboard';
import { normalizeObservation } from '../interaction/normalize';
import { noteFromInteraction } from '../understanding/entry';
import { compileProjectContext } from '../context/compiler/compile';
import { SqliteStore } from '../storage/sqlite/database';

describe('clipboard observer', () => {
  it('deduplicates unchanged values and allows A → B → A', async () => {
    let value = 'A';
    const observations: string[] = [];
    const observer = new ClipboardObserver({ read: () => value, intervalMs: 10_000, onObservation: (item) => { observations.push(item.content); } });
    await observer.poll(); await observer.poll();
    value = 'B'; await observer.poll();
    value = 'A'; await observer.poll();
    expect(observations).toEqual(['A', 'B', 'A']);
  });

  it('ignores whitespace, stops, and restarts without duplicate listeners', async () => {
    let value = '   '; const observations: string[] = [];
    const observer = new ClipboardObserver({ read: () => value, intervalMs: 10_000, onObservation: (item) => { observations.push(item.content); } });
    await observer.poll(); value = 'useful'; await observer.poll();
    observer.start(); observer.stop(); observer.start(); observer.stop();
    expect(observations).toEqual(['useful']);
  });

  it('does not re-ingest a generated clipboard value', async () => {
    let value = 'original'; const observations: string[] = [];
    const observer = new ClipboardObserver({ read: () => value, onObservation: (item) => { observations.push(item.content); } });
    await observer.poll(); observer.markGeneratedWrite('generated'); value = 'generated'; await observer.poll();
    expect(observations).toEqual(['original']);
  });

  it('contains a rejected observation callback and continues processing later changes', async () => {
    let value = 'first';
    let shouldReject = true;
    const observations: string[] = [];
    const errors: unknown[] = [];
    const observer = new ClipboardObserver({
      read: () => value,
      onObservation: async (item) => {
        if (shouldReject) {
          shouldReject = false;
          throw new Error('persistence failed');
        }
        observations.push(item.content);
      },
      onError: (error) => errors.push(error),
    });

    await expect(observer.poll()).resolves.toBeUndefined();
    value = 'second';
    await expect(observer.poll()).resolves.toBeUndefined();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(observations).toEqual(['second']);
  });
});

describe('pipeline primitives', () => {
  it('normalizes one observation to one note', () => {
    const interaction = normalizeObservation({ id: 'o1', source: 'clipboard', content: 'text', observedAt: 1 }, () => 'i1');
    const entry = noteFromInteraction(interaction, 'default-project', () => 2, () => 'e1');
    expect(entry).toMatchObject({ interactionId: 'i1', kind: 'note', content: 'text' });
  });

  it('generates interaction and understanding IDs through the real Node UUID path', () => {
    const interaction = normalizeObservation({ id: 'o1', source: 'clipboard', content: 'text', observedAt: 1 });
    const entry = noteFromInteraction(interaction, 'default-project');
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(interaction.id).toMatch(uuidPattern);
    expect(entry.id).toMatch(uuidPattern);
  });

  it('compiles stored information without mutating project state', () => {
    const state = { project: { id: 'p', name: 'Cortex', createdAt: 1, updatedAt: 1 }, entries: [{ id: 'e', projectId: 'p', interactionId: null, kind: 'note' as const, content: 'Human truth', reason: null, provenance: 'manual' as const, status: 'active' as const, supersededById: null, createdAt: 1, updatedAt: 1 }] };
    const before = JSON.stringify(state);
    expect(compileProjectContext(state)).toContain('Human truth');
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('sqlite project state and context', () => {
  it('persists entries through database reopen and compiles read-only context', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cortex-test-')); const filename = join(directory, 'cortex.sqlite');
    const first = new SqliteStore(filename); first.ensureProject('Cortex'); first.addManualEntry({ kind: 'goal', content: 'Preserve context' });
    const before = first.getState(); const context = compileProjectContext(before); first.close();
    const reopened = new SqliteStore(filename); const after = reopened.getState(); reopened.close(); rmSync(directory, { recursive: true, force: true });
    expect(context).toContain('Preserve context');
    expect(before.entries).toHaveLength(1); expect(after.entries).toHaveLength(1);
  });

  it('manual entries retain null interaction provenance', () => {
    const store = new SqliteStore(':memory:'); store.ensureProject();
    const entry = store.addManualEntry({ kind: 'note', content: 'Human truth' });
    expect(entry.interactionId).toBeNull(); store.close();
  });
});
