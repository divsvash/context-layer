import type { UnderstandingEntry, UnderstandingKind } from '../understanding/entry';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectEntryInput {
  kind: UnderstandingKind;
  content: string;
  reason?: string | null;
}

export interface ProjectState {
  project: Project;
  entries: UnderstandingEntry[];
}

export interface CortexState {
  projects: Project[];
  activeProject: Project;
  entries: UnderstandingEntry[];
}

export interface ProjectEvidenceSummary {
  total: number;
  pending: number;
  processed: number;
  empty: number;
  failed: number;
  lastCapturedAt: number | null;
}
