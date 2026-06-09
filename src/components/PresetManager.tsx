import { useState, useEffect, useRef } from 'react';
import type { MetadataState } from '../types/metadata';
import type { Preset } from '../types/preset';
import type { MetadataAction } from '../hooks/useMetadataState';
import type { ShowFeedback } from '../types/feedback';
import { loadPresets, savePreset, savePresetsBatch, deletePreset, exportPresets, importPresets } from '../model/presetStorage';
import { useThemeStyles } from '../contexts/themeContextCore';
import CollapsibleSection from './CollapsibleSection';
import { parseNovelAIImageFiles } from '../utils/pngParser';

interface Props {
    state: MetadataState;
    dispatch: React.Dispatch<MetadataAction>;
    queue: string[];
    setQueue: React.Dispatch<React.SetStateAction<string[]>>;
    onImportRequest: (state: MetadataState) => void;
    onFeedback: ShowFeedback;
}

export default function PresetManager({ state, dispatch, queue, setQueue, onImportRequest, onFeedback }: Props) {
    const { theme, inputStyle, smallBtnStyle } = useThemeStyles();
    const [presets, setPresets] = useState<Preset[]>([]);
    const [saveName, setSaveName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pngInputRef = useRef<HTMLInputElement>(null);
    const queueImageInputRef = useRef<HTMLInputElement>(null);

    // Reload presets from IndexedDB
    const refresh = async () => {
        const loaded = await loadPresets();
        setPresets(loaded);
    };

    useEffect(() => {
        let isMounted = true;

        loadPresets().then(loaded => {
            if (isMounted) setPresets(loaded);
        });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleSave = async () => {
        const name = saveName.trim() || `Preset ${presets.length + 1}`;
        await savePreset(name, state);
        setSaveName('');
        await refresh();
    };

    const handleExport = async () => {
        const json = await exportPresets();
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
        reader.onload = async () => {
            try {
                const count = await importPresets(reader.result as string);
                await refresh();
                onFeedback({ tone: 'success', message: `${count}개 프리셋을 가져왔습니다.` });
            } catch {
                onFeedback({ tone: 'error', message: '잘못된 프리셋 파일입니다.' });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleImportPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        try {
            const result = await parseNovelAIImageFiles(files);
            if (result.mergedState) {
                onImportRequest(result.mergedState);
                onFeedback({
                    tone: 'success',
                    message: `${result.patches.length}개 이미지에서 NovelAI 메타데이터를 찾았습니다.`,
                    detail: result.failedFiles.length > 0 ? `실패: ${result.failedFiles.join(', ')}` : undefined,
                });
            } else {
                onFeedback({ tone: 'warning', message: '가져온 이미지에서 NovelAI 메타데이터를 찾지 못했습니다.' });
            }
        } catch (err) {
            console.error('Error parsing image metadata:', err);
            onFeedback({ tone: 'error', message: '이미지 메타데이터를 읽지 못했습니다.' });
        }
        e.target.value = '';
    };

    const createUniquePresetNames = (fileNames: string[]): string[] => {
        const usedNames = new Set(presets.map(preset => preset.name));

        return fileNames.map((fileName) => {
            const baseName = fileName.replace(/\.[^/.]+$/, '').trim() || 'Imported image';
            let candidate = baseName;
            let suffix = 2;

            while (usedNames.has(candidate)) {
                candidate = `${baseName} (${suffix})`;
                suffix += 1;
            }

            usedNames.add(candidate);
            return candidate;
        });
    };

    const handleAddImagesToQueue = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;

        try {
            const result = await parseNovelAIImageFiles(files);
            if (result.patches.length === 0) {
                onFeedback({ tone: 'warning', message: '가져온 이미지에서 NovelAI 메타데이터를 찾지 못했습니다.' });
                return;
            }

            const names = createUniquePresetNames(result.patches.map(patch => patch.fileName));
            const createdPresets = await savePresetsBatch(result.patches.map((patch, index) => ({
                name: names[index],
                state: patch.state,
            })));

            setQueue(current => [...current, ...createdPresets.map(preset => preset.id)]);
            await refresh();
            onFeedback({
                tone: 'success',
                message: `${createdPresets.length}개 이미지에서 프리셋을 만들고 Queue에 추가했습니다.`,
                detail: result.failedFiles.length > 0 ? `실패: ${result.failedFiles.join(', ')}` : undefined,
            });
        } catch (err) {
            console.error('Error adding image metadata to queue:', err);
            onFeedback({ tone: 'error', message: '이미지를 Queue 프리셋으로 추가하지 못했습니다.' });
        }

        e.target.value = '';
    };

    const handleDelete = async (id: string) => {
        await deletePreset(id);
        setQueue(q => q.filter(qid => qid !== id));
        await refresh();
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
        <CollapsibleSection title="Presets" testId="presets-section">
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                />
                <input
                    ref={pngInputRef}
                    data-testid="load-image-input"
                    type="file"
                    accept="image/png,image/webp,image/*"
                    multiple
                    onChange={handleImportPng}
                    style={{ display: 'none' }}
                />
                <input
                    ref={queueImageInputRef}
                    data-testid="queue-images-input"
                    type="file"
                    accept="image/png,image/webp,image/*"
                    multiple
                    onChange={handleAddImagesToQueue}
                    style={{ display: 'none' }}
                />
                <button onClick={() => fileInputRef.current?.click()} style={{ ...smallBtnStyle, flex: '1 1 42%', color: theme.blue }}>
                    📥 JSON
                </button>
                <button onClick={handleExport} style={{ ...smallBtnStyle, flex: '1 1 42%', color: theme.yellow }}>
                    📤 JSON
                </button>
                <button
                    data-testid="load-image-button"
                    onClick={() => pngInputRef.current?.click()}
                    style={{ ...smallBtnStyle, flex: '1 1 42%', color: theme.text }}
                >
                    🖼️ Load Image
                </button>
                <button
                    data-testid="queue-images-button"
                    onClick={() => queueImageInputRef.current?.click()}
                    style={{ ...smallBtnStyle, flex: '1 1 42%', color: theme.green }}
                >
                    Queue Images
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
                            style={{ ...smallBtnStyle, fontSize: '11px', padding: '2px 6px', color: theme.warningError }}
                        >
                            ✕
                        </button>
                    </div>
                );
            })}

            {/* Queue section */}
            {queue.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <div data-testid="queued-presets-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {queuedPresets.map((p, idx) => (
                            <span key={p.id} data-testid={`queued-preset-${idx}`} style={chipStyle}>
                                <span style={{ color: theme.overlay0, fontSize: '10px' }}>{idx + 1}.</span>
                                {p.name}
                                <button onClick={() => moveInQueue(p.id, -1)} style={tinyBtn} title="Move up">▲</button>
                                <button onClick={() => moveInQueue(p.id, 1)} style={tinyBtn} title="Move down">▼</button>
                                <button onClick={() => toggleQueue(p.id)} style={{ ...tinyBtn, color: theme.warningError }} title="Remove">✕</button>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </CollapsibleSection>
    );
}
