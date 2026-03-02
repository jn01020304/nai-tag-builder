import Dexie, { type EntityTable } from 'dexie';

export interface TagEntry {
    id?: number;
    keyword: string;
    category: string;
    weight: number;
    isEnabled: boolean;
    isNegative: boolean;
    description?: string;
    createdAt: number;
}

export interface PresetEntry {
    id: string; // UUID
    name: string;
    settings: string; // JSON string of generation params
    queueOrder?: number;
    createdAt: number;
}

export interface StateEntry {
    id: string; // Singleton "current"
    stateJson: string;
}

export class NaiDatabase extends Dexie {
    tags!: EntityTable<TagEntry, 'id'>;
    presets!: EntityTable<PresetEntry, 'id'>;
    appState!: EntityTable<StateEntry, 'id'>;

    constructor() {
        super('NaiTagBuilderDB');
        this.version(1).stores({
            tags: '++id, keyword, category, isEnabled, isNegative, createdAt',
            presets: 'id, name, queueOrder, createdAt',
        });
        this.version(2).stores({
            appState: 'id',
        });
    }
}

export const db = new NaiDatabase();
