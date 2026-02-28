import type { MetadataState } from '../types/metadata';
import type { Preset } from '../types/preset';

const STORAGE_KEY = 'nai-tb-presets';

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readAll(): Preset[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function writeAll(presets: Preset[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function loadPresets(): Preset[] {
    return readAll();
}

export function savePreset(name: string, state: MetadataState): Preset {
    const presets = readAll();
    const preset: Preset = {
        id: generateId(),
        name,
        state: structuredClone(state),
        createdAt: Date.now(),
    };
    presets.push(preset);
    writeAll(presets);
    return preset;
}

export function deletePreset(id: string): void {
    const presets = readAll().filter(p => p.id !== id);
    writeAll(presets);
}

export function getPresetById(id: string): Preset | undefined {
    return readAll().find(p => p.id === id);
}

export function reorderPresets(orderedIds: string[]): void {
    const presets = readAll();
    const map = new Map(presets.map(p => [p.id, p]));
    const reordered: Preset[] = [];
    for (const id of orderedIds) {
        const p = map.get(id);
        if (p) reordered.push(p);
    }
    writeAll(reordered);
}

export function exportPresets(): string {
    return JSON.stringify(readAll(), null, 2);
}

export function importPresets(json: string): number {
    const incoming: Preset[] = JSON.parse(json);
    if (!Array.isArray(incoming)) throw new Error('Invalid preset data');

    let existing = readAll();
    let importedCount = 0;

    for (const p of incoming) {
        if (p.id && p.name && p.state) {
            const existingIndex = existing.findIndex(ex => ex.id === p.id);
            if (existingIndex >= 0) {
                existing[existingIndex] = p; // Overwrite
            } else {
                existing.push(p); // Add new
            }
            importedCount++;
        }
    }

    if (importedCount > 0) {
        writeAll(existing);
    }
    return importedCount;
}
