import { randomUUID } from 'node:crypto';
import type { Interaction } from '../interaction/normalize';

export type UnderstandingKind = 'goal' | 'decision' | 'constraint' | 'question' | 'technology' | 'note';
export type UnderstandingStatus = 'active' | 'superseded';
export type UnderstandingProvenance = 'ai' | 'manual' | 'observed';

export interface UnderstandingEntry {
  id: string;
  projectId: string;
  interactionId: string | null;
  kind: UnderstandingKind;
  content: string;
  reason: string | null;
  provenance: UnderstandingProvenance;
  status: UnderstandingStatus;
  supersededById: string | null;
  createdAt: number;
  updatedAt: number;
}

export function noteFromInteraction(interaction: Interaction, projectId: string, now = Date.now, createId: () => string = randomUUID): UnderstandingEntry {
  const timestamp = now();
  return {
    id: createId(),
    projectId,
    interactionId: interaction.id,
    kind: 'note',
    content: interaction.content,
    reason: null,
    provenance: 'observed',
    status: 'active',
    supersededById: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
