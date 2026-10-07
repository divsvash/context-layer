import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';

type Kind = 'goal' | 'decision' | 'constraint' | 'question' | 'technology' | 'note';
type EntryStatus = 'active' | 'superseded';

interface Project { id: string; name: string; createdAt: number; updatedAt: number }
interface Entry {
  id: string;
  projectId: string;
  interactionId: string | null;
  kind: Kind;
  content: string;
  reason: string | null;
  provenance: 'ai' | 'manual' | 'observed';
  status: EntryStatus;
  supersededById: string | null;
  createdAt: number;
  updatedAt: number;
}
interface RuntimeState {
  projects: Project[];
  activeProject: Project;
  entries: Entry[];
  observing: boolean;
  activity: string;
  aiConfigured: boolean;
}

declare global {
  interface Window {
    cortex: {
      ping: () => Promise<string>;
      quit: () => void;
      toggleOverlay: () => void;
      focusWindow: () => void;
      setExpanded: (expanded: boolean) => void;
      getState: () => Promise<RuntimeState>;
      generateContext: () => Promise<string>;
      createProject: (name: string) => Promise<void>;
      switchProject: (projectId: string) => Promise<void>;
      renameProject: (name: string) => Promise<void>;
      deleteProject: (projectId: string) => Promise<void>;
      addEntry: (kind: Kind, content: string) => Promise<void>;
      updateEntry: (entryId: string, kind: Kind, content: string) => Promise<void>;
      deleteEntry: (entryId: string) => Promise<void>;
      setObserving: (observing: boolean) => Promise<void>;
      setApiKey: (apiKey: string) => Promise<void>;
      clearApiKey: () => Promise<void>;
    };
  }
}

const kinds: Kind[] = ['goal', 'decision', 'constraint', 'question', 'technology', 'note'];
const labels: Record<Kind, string> = { goal: 'Goals', decision: 'Decisions', constraint: 'Constraints', question: 'Questions', technology: 'Technologies', note: 'Notes' };

export function App(): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<RuntimeState | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [manualKind, setManualKind] = useState<Kind>('note');
  const [manualText, setManualText] = useState('');
  const [projectDraft, setProjectDraft] = useState('');
  const [apiKey, setApiKey] = useState('');

  const refresh = useCallback(async () => {
    try {
      setState(await window.cortex.getState());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Cortex is unavailable');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const run = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      setNotice(success);
      setError('');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Operation failed');
    }
  };

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    window.cortex.setExpanded(next);
  };

  const activeEntries = useMemo(() => state?.entries.filter((entry) => entry.status === 'active') ?? [], [state]);
  const historicalEntries = useMemo(() => state?.entries.filter((entry) => entry.status === 'superseded') ?? [], [state]);

  if (!expanded) {
    return (
      <div className={styles.app}>
        <button className={styles.collapsed} onClick={toggleExpanded}>
          <span className={`${styles.statusDot} ${state?.observing ? '' : styles.paused}`} />
          <strong>Cortex</strong>
          <span className={styles.projectName}>{state?.activeProject.name ?? 'Starting…'}</span>
          <span className={styles.activity}>{state?.activity ?? 'Connecting'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.app}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div><strong>Cortex</strong><span className={styles.promise}>Persistent project understanding</span></div>
          <button className={styles.iconButton} onClick={toggleExpanded} aria-label="Collapse">×</button>
        </header>

        <main className={styles.content}>
          <section className={styles.projectBar}>
            <select value={state?.activeProject.id ?? ''} onChange={(event) => void run(() => window.cortex.switchProject(event.target.value), 'Project switched')}>
              {state?.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <span className={styles.status}>{state?.observing ? '● Observing' : '○ Paused'} · {state?.activity}</span>
            <button className={styles.secondaryButton} onClick={() => void run(() => window.cortex.setObserving(!state?.observing), state?.observing ? 'Observation paused' : 'Observation resumed')}>
              {state?.observing ? 'Pause' : 'Resume'}
            </button>
          </section>

          <section className={styles.primaryActions}>
            <button className={styles.primaryButton} onClick={() => void run(() => window.cortex.generateContext(), 'Context copied')}>Generate Context</button>
            <span>{notice}</span>
          </section>

          {error && <div className={styles.error}>{error}</div>}

          <details className={styles.disclosure}>
            <summary>Projects</summary>
            <div className={styles.formRow}>
              <input value={projectDraft} onChange={(event) => setProjectDraft(event.target.value)} placeholder="Project name" />
              <button onClick={() => void run(async () => { await window.cortex.createProject(projectDraft); setProjectDraft(''); }, 'Project created')}>Create</button>
              <button onClick={() => void run(async () => { await window.cortex.renameProject(projectDraft); setProjectDraft(''); }, 'Project renamed')}>Rename active</button>
            </div>
            <button className={styles.dangerButton} onClick={() => {
              if (state && window.confirm(`Delete “${state.activeProject.name}” and all of its Cortex data?`)) void run(() => window.cortex.deleteProject(state.activeProject.id), 'Project deleted');
            }}>Delete active project…</button>
          </details>

          <details className={styles.disclosure} open>
            <summary>Manual update</summary>
            <div className={styles.manualForm}>
              <select value={manualKind} onChange={(event) => setManualKind(event.target.value as Kind)}>
                {kinds.map((kind) => <option key={kind} value={kind}>{labels[kind]}</option>)}
              </select>
              <textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="Add project truth intentionally" rows={2} />
              <button onClick={() => void run(async () => { await window.cortex.addEntry(manualKind, manualText); setManualText(''); }, 'Knowledge saved')}>Add</button>
            </div>
          </details>

          <section className={styles.knowledge}>
            <h2>Project understanding <span>{activeEntries.length}</span></h2>
            {activeEntries.length === 0 && <p className={styles.empty}>No current knowledge yet. Add it manually or configure extraction, then copy useful project text.</p>}
            {kinds.map((kind) => {
              const entries = activeEntries.filter((entry) => entry.kind === kind);
              if (entries.length === 0) return null;
              return (
                <details className={styles.category} key={kind} open={kind !== 'note'}>
                  <summary>{labels[kind]} <span>{entries.length}</span></summary>
                  {entries.map((entry) => <KnowledgeRow key={entry.id} entry={entry} onRefresh={refresh} setError={setError} />)}
                </details>
              );
            })}
          </section>

          {historicalEntries.length > 0 && (
            <details className={styles.disclosure}>
              <summary>Superseded history ({historicalEntries.length})</summary>
              {historicalEntries.map((entry) => <p className={styles.history} key={entry.id}><strong>{entry.kind}</strong> · {entry.content}</p>)}
            </details>
          )}

          <details className={styles.disclosure}>
            <summary>Settings · AI extraction {state?.aiConfigured ? 'configured' : 'unavailable'}</summary>
            <p className={styles.help}>The key is encrypted with the operating system and is never shown again. `OPENAI_API_KEY` may also be used.</p>
            <div className={styles.formRow}>
              <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="OpenAI API key" />
              <button onClick={() => void run(async () => { await window.cortex.setApiKey(apiKey); setApiKey(''); }, 'API key saved')}>Save</button>
              <button onClick={() => void run(() => window.cortex.clearApiKey(), 'Stored API key removed')}>Remove</button>
            </div>
          </details>
        </main>

        <footer className={styles.footer}><button onClick={() => window.cortex.quit()}>Quit Cortex</button></footer>
      </div>
    </div>
  );
}

function KnowledgeRow({ entry, onRefresh, setError }: { entry: Entry; onRefresh: () => Promise<void>; setError: (value: string) => void }): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<Kind>(entry.kind);
  const [content, setContent] = useState(entry.content);

  const act = async (operation: () => Promise<unknown>) => {
    try { await operation(); setError(''); setEditing(false); await onRefresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Operation failed'); }
  };

  return (
    <article className={styles.entry}>
      {editing ? (
        <div className={styles.editForm}>
          <select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>{kinds.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select>
          <textarea rows={2} value={content} onChange={(event) => setContent(event.target.value)} />
          <button onClick={() => void act(() => window.cortex.updateEntry(entry.id, kind, content))}>Save correction</button>
          <button onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <>
          <p>{entry.content}</p>
          {entry.reason && <p className={styles.reason}>Reason: {entry.reason}</p>}
          <div className={styles.entryMeta}>
            <span>{entry.provenance === 'ai' ? 'AI extracted' : entry.provenance === 'manual' ? 'Manual' : 'Captured'}</span>
            <button onClick={() => setEditing(true)}>Edit</button>
            <button onClick={() => { if (window.confirm('Delete this knowledge entry?')) void act(() => window.cortex.deleteEntry(entry.id)); }}>Delete</button>
          </div>
        </>
      )}
    </article>
  );
}
