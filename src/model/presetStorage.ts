import { db, type PresetEntry } from './db';
import type { MetadataState } from '../types/metadata';
import type { Preset } from '../types/preset';
import { normalizeMetadataState } from './defaults';

const STORAGE_KEY_OLD = 'nai-tb-presets';

function createPresetId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function migrateOldLocalStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_OLD);
        if (!raw) return;
        const oldPresets: Preset[] = JSON.parse(raw);

        if (oldPresets && Array.isArray(oldPresets) && oldPresets.length > 0) {
            const newEntries: PresetEntry[] = oldPresets.map((p, index) => ({
                id: p.id,
                name: p.name,
                settings: JSON.stringify(p.state),
                queueOrder: index,
                createdAt: p.createdAt || Date.now(),
            }));

            await db.presets.bulkPut(newEntries);
            localStorage.removeItem(STORAGE_KEY_OLD);
            console.log('Migrated old presets to IndexedDB');
        }
    } catch (e) {
        console.error('Migration failed:', e);
    }
}

export async function loadPresets(): Promise<Preset[]> {
    await migrateOldLocalStorage();
    const entries = await db.presets.orderBy('queueOrder').toArray();
    return entries.map(e => ({
        id: e.id,
        name: e.name,
        state: normalizeMetadataState(JSON.parse(e.settings)),
        createdAt: e.createdAt,
    }));
}

export async function savePreset(name: string, state: MetadataState): Promise<Preset> {
    const newPreset: PresetEntry = {
        id: createPresetId(),
        name,
        settings: JSON.stringify(state),
        queueOrder: await db.presets.count(),
        createdAt: Date.now(),
    };
    await db.presets.add(newPreset);

    return {
        id: newPreset.id,
        name: newPreset.name,
        state,
        createdAt: newPreset.createdAt,
    };
}

export async function savePresetsBatch(items: Array<{ name: string; state: MetadataState }>): Promise<Preset[]> {
    if (items.length === 0) return [];

    const currentCount = await db.presets.count();
    const now = Date.now();
    const entries: PresetEntry[] = items.map((item, index) => ({
        id: createPresetId(),
        name: item.name,
        settings: JSON.stringify(item.state),
        queueOrder: currentCount + index,
        createdAt: now + index,
    }));

    await db.presets.bulkAdd(entries);

    return entries.map((entry, index) => ({
        id: entry.id,
        name: entry.name,
        state: items[index].state,
        createdAt: entry.createdAt,
    }));
}

export async function deletePreset(id: string): Promise<void> {
    await db.presets.delete(id);
}

export async function getPresetById(id: string): Promise<Preset | undefined> {
    const e = await db.presets.get(id);
    if (!e) return undefined;
    return {
        id: e.id,
        name: e.name,
        state: normalizeMetadataState(JSON.parse(e.settings)),
        createdAt: e.createdAt,
    };
}

export async function reorderPresets(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.presets, async () => {
        for (let i = 0; i < orderedIds.length; i++) {
            await db.presets.update(orderedIds[i], { queueOrder: i });
        }
    });
}

export async function exportPresets(): Promise<string> {
    const presets = await loadPresets();
    return JSON.stringify(presets, null, 2);
}

export async function importPresets(json: string): Promise<number> {
    const incoming: Preset[] = JSON.parse(json);
    if (!Array.isArray(incoming)) throw new Error('Invalid preset data');

    let importedCount = 0;
    const newEntries: PresetEntry[] = [];
    const currentCount = await db.presets.count();

    for (const p of incoming) {
        if (p.id && p.name && p.state) {
            newEntries.push({
                id: p.id,
                name: p.name,
                settings: JSON.stringify(p.state),
                queueOrder: currentCount + importedCount,
                createdAt: p.createdAt || Date.now()
            });
            importedCount++;
        }
    }

    if (importedCount > 0) {
        await db.presets.bulkPut(newEntries);
    }
    return importedCount;
}
