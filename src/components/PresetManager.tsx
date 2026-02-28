import { useState, useEffect, useRef } from 'react';
import type { MetadataState } from '../types/metadata';
import type { Preset, QueueMode } from '../types/preset';
import type { MetadataAction } from '../hooks/useMetadataState';
import { loadPresets, savePreset, deletePreset, exportPresets, importPresets } from '../model/presetStorage';
import { theme, inputStyle, smallBtnStyle } from '../styles/theme';
import CollapsibleSection from './CollapsibleSection';

interface Props {
    state: MetadataState;
    dispatch: React.Dispatch<MetadataAction>;
    queue: string[];
    setQueue: React.Dispatch<React.SetStateAction<string[]>>;
    queueMode: QueueMode;
    setQueueMode: React.Dispatch<React.SetStateAction<QueueMode>>;
}

export default function PresetManager({ state, dispatch, queue, setQueue, queueMode, setQueueMode }: Props) {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [saveName, setSaveName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reload presets from localStorage
    const refresh = () => setPresets(loadPresets());

    useEffect(() => { refresh(); }, []);

    const handleSave = () => {
        const name = saveName.trim() || `Preset ${presets.length + 1}`;
        savePreset(name, state);
        setSaveName('');
        refresh();
    };

    const handleExport = () => {
        const json = exportPresets();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nai-tb-presets.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const count = importPresets(reader.result as string);
                refresh();
                alert(`${count}개 프리셋 가져옴`);
            } catch {
                alert('잘못된 프리셋 파일입니다.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleDelete = (id: string) => {
        deletePreset(id);
        setQueue(q => q.filter(qid => qid !== id));
        refresh();
    };

    const handleLoad = (preset: Preset) => {
        dispatch({ type: 'LOAD_PRESET', state: preset.state });
    };

    const toggleQueue = (id: string) => {
        setQueue(q => q.includes(id) ? q.filter(qid => qid !== id) : [...q, id]);
    };

    const moveInQueue = (id: string, dir: -1 | 1) => {
        setQueue(q => {
            const idx = q.indexOf(id);
            if (idx < 0) return q;
            const target = idx + dir;
            if (target < 0 || target >= q.length) return q;
            const next = [...q];
            [next[idx], next[target]] = [next[target], next[idx]];
            return next;
        });
    };

    const queuedPresets = queue.map(id => presets.find(p => p.id === id)).filter(Boolean) as Preset[];

    const chipStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        border: `1px solid ${theme.surface1}`,
        background: theme.surface0,
        color: theme.text,
    };

    const tinyBtn: React.CSSProperties = {
        background: 'none',
        border: 'none',
        color: theme.subtext0,
        cursor: 'pointer',
        fontSize: '10px',
        padding: '0 2px',
    };

    return (
        <CollapsibleSection title="Presets &amp; Queue">
            {/* Save current state as preset */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                <input
                    type="text"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    placeholder="Preset name..."
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleSave} style={{ ...smallBtnStyle, color: theme.green }}>
                    Save
                </button>
            </div>

            {/* Import / Export */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                />
                <button onClick={() => fileInputRef.current?.click()} style={{ ...smallBtnStyle, flex: 1, color: theme.blue }}>
                    📥 Import
                </button>
                <button onClick={handleExport} style={{ ...smallBtnStyle, flex: 1, color: theme.yellow }}>
                    📤 Export
                </button>
            </div>

            {/* Preset list */}
            {presets.length === 0 && (
                <div style={{ fontSize: '11px', color: theme.overlay0, marginBottom: '6px' }}>
                    No presets saved yet.
                </div>
            )}
            {presets.map(p => {
                const inQueue = queue.includes(p.id);
                return (
                    <div
                        key={p.id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 0',
                            borderBottom: `1px solid ${theme.surface0}`,
                            fontSize: '12px',
                        }}
                    >
                        <span style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: theme.text,
                        }}>
                            {p.name}
                        </span>
                        <button
                            onClick={() => handleLoad(p)}
                            title="Load into editor"
                            style={{ ...smallBtnStyle, fontSize: '11px', padding: '2px 6px' }}
                        >
                            Load
                        </button>
                        <button
                            onClick={() => toggleQueue(p.id)}
                            title={inQueue ? 'Remove from queue' : 'Add to queue'}
                            style={{
                                ...smallBtnStyle,
                                fontSize: '11px',
                                padding: '2px 6px',
                                color: inQueue ? theme.yellow : theme.blue,
                                borderColor: inQueue ? theme.yellow : theme.surface1,
                            }}
                        >
                            {inQueue ? 'Q ✓' : 'Q +'}
                        </button>
                        <button
                            onClick={() => handleDelete(p.id)}
                            title="Delete"
                            style={{ ...smallBtnStyle, fontSize: '11px', padding: '2px 6px', color: theme.red }}
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            {/* Queue section */}
            {queue.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: theme.subtext0 }}>Queue Mode:</span>
                        <select
                            value={queueMode}
                            onChange={e => setQueueMode(e.target.value as QueueMode)}
                            style={{
                                ...inputStyle,
                                fontSize: '11px',
                                padding: '2px 4px',
                                width: 'auto',
                            }}
                        >
                            <option value="progression">Progression (순서대로)</option>
                            <option value="randomization">Random (랜덤)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {queuedPresets.map((p, idx) => (
                            <span key={p.id} style={chipStyle}>
                                <span style={{ color: theme.overlay0, fontSize: '10px' }}>{idx + 1}.</span>
                                {p.name}
                                <button onClick={() => moveInQueue(p.id, -1)} style={tinyBtn} title="Move up">▲</button>
                                <button onClick={() => moveInQueue(p.id, 1)} style={tinyBtn} title="Move down">▼</button>
                                <button onClick={() => toggleQueue(p.id)} style={{ ...tinyBtn, color: theme.red }} title="Remove">✕</button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </CollapsibleSection>
    );
}
