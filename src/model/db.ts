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

export class NaiDatabase extends Dexie {
    tags!: EntityTable<TagEntry, 'id'>;
    presets!: EntityTable<PresetEntry, 'id'>;

    constructor() {
        super('NaiTagBuilderDB');
        this.version(1).stores({
            tags: '++id, keyword, category, isEnabled, isNegative, createdAt', // Indexed fields
            presets: 'id, name, queueOrder, createdAt',
        });
    }
}

export const db = new NaiDatabase();
