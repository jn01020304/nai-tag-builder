import type { MetadataState } from './metadata';

export interface Preset {
  id: string;
  name: string;
  state: MetadataState;
  createdAt: number;
}

export type SeedRule = 'none' | 'random' | 'decrement' | 'increment';
export type QueueMode = 'batched' | 'randomized';
