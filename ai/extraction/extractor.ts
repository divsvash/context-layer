import type { Interaction } from '../../interaction/normalize';
import type { Project } from '../../project/types';
import type { UnderstandingEntry, UnderstandingKind } from '../../understanding/entry';

export interface UnderstandingCandidate {
  kind: UnderstandingKind;
  content: string;
  reason: string | null;
  supersedesEntryId: string | null;
}

export interface ExtractionInput {
  interaction: Interaction;
  project: Project;
  activeEntries: UnderstandingEntry[];
}

export interface UnderstandingExtractor {
  isAvailable(): boolean;
  extract(input: ExtractionInput): Promise<UnderstandingCandidate[]>;
}

const kinds = new Set<UnderstandingKind>(['goal', 'decision', 'constraint', 'question', 'technology', 'note']);

export function validateExtractionOutput(value: unknown, activeEntries: UnderstandingEntry[]): UnderstandingCandidate[] {
  if (!isRecord(value) || !Array.isArray(value.entries)) {
    throw new Error('Extractor returned an invalid response shape');
  }
  if (value.entries.length > 8) throw new Error('Extractor returned too many entries');

  const activeById = new Map(activeEntries.filter((entry) => entry.status === 'active').map((entry) => [entry.id, entry]));
  return value.entries.map((item, index) => {
    if (!isRecord(item) || typeof item.kind !== 'string' || !kinds.has(item.kind as UnderstandingKind)) {
      throw new Error(`Extractor entry ${index} has an invalid kind`);
    }
    if (typeof item.content !== 'string' || item.content.trim().length === 0 || item.content.trim().length > 2000) {
      throw new Error(`Extractor entry ${index} has invalid content`);
    }
    if (item.reason !== null && (typeof item.reason !== 'string' || item.reason.length > 1000)) {
      throw new Error(`Extractor entry ${index} has an invalid reason`);
    }
    if (item.supersedesEntryId !== null && typeof item.supersedesEntryId !== 'string') {
      throw new Error(`Extractor entry ${index} has an invalid supersession reference`);
    }

    const referenced = typeof item.supersedesEntryId === 'string' ? activeById.get(item.supersedesEntryId) : undefined;
    return {
      kind: item.kind as UnderstandingKind,
      content: item.content.trim(),
      reason: typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : null,
      supersedesEntryId: referenced && referenced.provenance !== 'manual' ? referenced.id : null,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
