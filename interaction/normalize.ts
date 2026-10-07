import { randomUUID } from 'node:crypto';
import type { RawObservation } from '../observer/clipboard';

export interface Interaction {
  id: string;
  observationId: string;
  source: 'clipboard';
  content: string;
  occurredAt: number;
}

export function normalizeObservation(observation: RawObservation, createId: () => string = randomUUID): Interaction {
  return {
    id: createId(),
    observationId: observation.id,
    source: observation.source,
    content: observation.content,
    occurredAt: observation.observedAt,
  };
}
