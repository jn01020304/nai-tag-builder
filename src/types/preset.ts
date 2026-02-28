import type { MetadataState } from './metadata';

export interface Preset {
  id: string;
  name: string;
  state: MetadataState;
  createdAt: number;
}

export type QueueMode = 'progression' | 'randomization';
