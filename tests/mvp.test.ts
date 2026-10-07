import { describe, expect, it, vi } from 'vitest';
import { validateExtractionOutput, type UnderstandingExtractor } from '../ai/extraction/extractor';
import { OpenAIUnderstandingExtractor } from '../ai/providers/openai/extractor';
import { CortexCommands, type CortexPersistence } from '../commands/cortex';
import { compileProjectContext } from '../context/compiler/compile';
import type { Interaction } from '../interaction/normalize';
import type { Project, ProjectEntryInput, ProjectState } from '../project/types';
import type { RawObservation } from '../observer/clipboard';
import { CredentialStore } from '../storage/credentials';
import type { UnderstandingEntry } from '../understanding/entry';

const project: Project = { id: 'p1', name: 'Project A', createdAt: 1, updatedAt: 1 };

function entry(overrides: Partial<UnderstandingEntry> = {}): UnderstandingEntry {
  return {
    id: 'e1', projectId: 'p1', interactionId: 'i1', kind: 'decision', content: 'Use Tauri', reason: null,
    provenance: 'ai', status: 'active', supersededById: null, createdAt: 1, updatedAt: 1, ...overrides,
  };
}

describe('AI extraction validation', () => {
  it('accepts an explicit zero-result extraction', () => {
    expect(validateExtractionOutput({ entries: [] }, [])).toEqual([]);
  });

  it('rejects malformed output before it reaches project state', () => {
    expect(() => validateExtractionOutput({ entries: [{ kind: 'fact', content: 'bad', reason: null, supersedesEntryId: null }] }, [])).toThrow(/invalid kind/);
  });

  it('allows supersession of active AI knowledge but not manual truth', () => {
    const ai = entry();
    const manual = entry({ id: 'manual', provenance: 'manual' });
    const parsed = validateExtractionOutput({ entries: [
      { kind: 'decision', content: 'Use Electron', reason: 'Desktop compatibility', supersedesEntryId: ai.id },
      { kind: 'constraint', content: 'Must remain offline', reason: null, supersedesEntryId: manual.id },
    ] }, [ai, manual]);
    expect(parsed[0].supersedesEntryId).toBe(ai.id);
    expect(parsed[1].supersedesEntryId).toBeNull();
  });

  it('parses strict structured provider output through the validated contract', async () => {
    let requestBody = '';
    const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body ?? '');
      return new Response(JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: JSON.stringify({ entries: [{ kind: 'constraint', content: 'Works offline', reason: null, supersedesEntryId: null }] }) }] }],
      }), { status: 200 });
    });
    const extractor = new OpenAIUnderstandingExtractor(() => 'test-key', 'test-model', request as typeof fetch);
    const result = await extractor.extract({ interaction: { id: 'i1', observationId: 'o1', source: 'clipboard', content: 'Must work offline', occurredAt: 1 }, project, activeEntries: [] });
    expect(result).toEqual([{ kind: 'constraint', content: 'Works offline', reason: null, supersedesEntryId: null }]);
    expect(JSON.parse(requestBody).text.format.strict).toBe(true);
  });
});

describe('context projection', () => {
  it('excludes superseded truth, preserves concise history, and does not mutate state', () => {
    const state: ProjectState = {
      project,
      entries: [
        entry({ status: 'superseded', supersededById: 'e2' }),
        entry({ id: 'e2', content: 'Use Electron', reason: 'Better ecosystem' }),
        entry({ id: 'e3', kind: 'constraint', content: 'Works offline', interactionId: null, provenance: 'manual' }),
      ],
    };
    const before = structuredClone(state);
    const output = compileProjectContext(state);
    expect(output).toContain('Use Electron');
    expect(output).toContain('Reason: Better ecosystem');
    expect(output).toContain('Previously decision: Use Tauri');
    expect(output.indexOf('Use Tauri')).toBeGreaterThan(output.indexOf('IMPORTANT HISTORICAL CONTEXT'));
    expect(state).toEqual(before);
  });
});

describe('credential storage', () => {
  it('stores only encrypted API-key material and can clear it', () => {
    const values = new Map<string, string>();
    const settings = {
      getSetting: (key: string) => values.get(key) ?? null,
      setSetting: (key: string, value: string) => { values.set(key, value); },
      deleteSetting: (key: string) => { values.delete(key); },
    };
    const credentials = new CredentialStore(settings, {
      isAvailable: () => true,
      encrypt: (value) => Buffer.from(value).toString('base64'),
      decrypt: (value) => Buffer.from(value, 'base64').toString(),
    });
    credentials.setApiKey('secret-value');
    expect([...values.values()]).not.toContain('secret-value');
    expect(credentials.getApiKey()).toBe('secret-value');
    credentials.clearApiKey();
    expect(credentials.getApiKey()).toBeNull();
  });
});

describe('Cortex coordination', () => {
  it('attributes each capture to the project active at capture time', async () => {
    let clipboard = 'A knowledge';
    const persistence = createPersistence();
    const extractor: UnderstandingExtractor = { isAvailable: () => false, extract: vi.fn(async () => []) };
    const commands = new CortexCommands(persistence.store, extractor, credentials(false), () => clipboard, () => undefined, 10_000);
    await commands.observer.poll();
    persistence.active = 'p2';
    clipboard = 'B knowledge';
    await commands.observer.poll();
    expect(persistence.recordedProjects).toEqual(['p1', 'p2']);
  });

  it('contains extraction failure and processes a later clipboard change', async () => {
    let clipboard = 'first';
    let call = 0;
    const persistence = createPersistence();
    const extractor: UnderstandingExtractor = {
      isAvailable: () => true,
      extract: async () => {
        call += 1;
        if (call === 1) throw new Error('provider unavailable');
        return [{ kind: 'goal', content: 'Ship the MVP', reason: null, supersedesEntryId: null }];
      },
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const commands = new CortexCommands(persistence.store, extractor, credentials(true), () => clipboard, () => undefined, 10_000);
    await expect(commands.observer.poll()).resolves.toBeUndefined();
    expect(commands.state().activity).toBe('Extraction failed');
    clipboard = 'second';
    await expect(commands.observer.poll()).resolves.toBeUndefined();
    expect(commands.state().activity).toBe('Understanding updated');
    expect(persistence.applied).toHaveLength(1);
    error.mockRestore();
  });
});

function credentials(configured: boolean) {
  return { hasApiKey: () => configured, setApiKey: vi.fn(), clearApiKey: vi.fn() };
}

function createPersistence() {
  const projects = [project, { id: 'p2', name: 'Project B', createdAt: 2, updatedAt: 2 }];
  const states = new Map(projects.map((item) => [item.id, { project: item, entries: [] as UnderstandingEntry[] }]));
  const result = { active: 'p1', recordedProjects: [] as string[], applied: [] as string[] };
  const store: CortexPersistence = {
    getCortexState: () => ({ projects, activeProject: projects.find((item) => item.id === result.active)!, entries: states.get(result.active)!.entries }),
    getActiveProject: () => projects.find((item) => item.id === result.active)!,
    getState: (projectId = result.active) => states.get(projectId)!,
    createProject: vi.fn(),
    setActiveProject: (projectId) => { result.active = projectId; return projects.find((item) => item.id === projectId)!; },
    renameProject: vi.fn(), deleteProject: vi.fn(), close: vi.fn(),
    recordInteraction: (_observation: RawObservation, _interaction: Interaction, projectId: string) => { result.recordedProjects.push(projectId); },
    addManualEntry: vi.fn(), replaceEntry: vi.fn(), deleteEntry: vi.fn(),
    applyExtractedEntries: (projectId, _interactionId, candidates) => {
      result.applied.push(projectId);
      return candidates.map((candidate, index) => entry({ id: `new-${index}`, projectId, kind: candidate.kind, content: candidate.content, reason: candidate.reason }));
    },
  };
  return Object.assign(result, { store });
}
