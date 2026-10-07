import type { ProjectState } from '../../project/types';
import type { UnderstandingEntry, UnderstandingKind } from '../../understanding/entry';

const sectionTitles: Record<UnderstandingKind, string> = {
  goal: 'CURRENT GOALS',
  decision: 'KEY DECISIONS',
  constraint: 'CONSTRAINTS',
  technology: 'TECHNOLOGIES',
  question: 'OPEN QUESTIONS',
  note: 'RECENT RELEVANT DEVELOPMENTS',
};

const sectionOrder: UnderstandingKind[] = ['goal', 'decision', 'constraint', 'technology', 'question', 'note'];

export function compileProjectContext(state: ProjectState): string {
  const active = deduplicate(state.entries.filter((entry) => entry.status === 'active'));
  const output = ['PROJECT', state.project.name];

  for (const kind of sectionOrder) {
    const entries = active.filter((entry) => entry.kind === kind);
    if (entries.length === 0) continue;
    output.push('', sectionTitles[kind]);
    for (const entry of entries) {
      output.push(`- ${entry.content}`);
      if (entry.reason) output.push(`  Reason: ${entry.reason}`);
    }
  }

  const replacements = new Map(active.map((entry) => [entry.id, entry.content]));
  const historical = state.entries.filter((entry) => entry.status === 'superseded').slice(-5);
  if (historical.length > 0) {
    output.push('', 'IMPORTANT HISTORICAL CONTEXT');
    for (const entry of historical) {
      const replacement = entry.supersededById ? replacements.get(entry.supersededById) : null;
      output.push(`- Previously ${entry.kind}: ${entry.content}${replacement ? ` (superseded by: ${replacement})` : ' (superseded)'}`);
    }
  }

  return output.join('\n');
}

function deduplicate(entries: UnderstandingEntry[]): UnderstandingEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.kind}:${entry.content.trim().toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
