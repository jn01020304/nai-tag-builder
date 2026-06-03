import { useState } from 'react';
import type { MetadataState } from '../types/metadata';
import { theme, smallBtnStyle } from '../styles/theme';

interface Props {
    importedState: MetadataState;
    onConfirm: (partial: Partial<MetadataState>) => void;
    onCancel: () => void;
}

export default function ImportModal({ importedState, onConfirm, onCancel }: Props) {
    const [importBasePrompt, setImportBasePrompt] = useState(true);
    const [selectedChars, setSelectedChars] = useState<string[]>(
        importedState.prompt.characters.map(c => c.id)
    );

    const [importNegative, setImportNegative] = useState(true);
    const [selectedNegChars, setSelectedNegChars] = useState<string[]>(
        importedState.prompt.negativeCharacters.map(c => c.id)
    );

    const [importSeed, setImportSeed] = useState(true);
    const [importSettings, setImportSettings] = useState(true);

    const handleApply = () => {
        const partial: Partial<MetadataState> = {};

        // prompt 그룹 구성
        const promptPatch: Partial<MetadataState['prompt']> = {};
        if (importBasePrompt) {
            promptPatch.basePrompt = importedState.prompt.basePrompt;
        }
        promptPatch.characters = importedState.prompt.characters.filter(c => selectedChars.includes(c.id));
        if (importNegative) {
            promptPatch.negativeBase = importedState.prompt.negativeBase;
        }
        promptPatch.negativeCharacters = importedState.prompt.negativeCharacters.filter(c => selectedNegChars.includes(c.id));
        partial.prompt = promptPatch as MetadataState['prompt'];

        if (importSeed) {
            partial.params = { ...importedState.params, seed: importedState.params.seed };
        }

        if (importSettings) {
            const paramsWithoutSeed: Partial<MetadataState['params']> = { ...importedState.params };
            delete paramsWithoutSeed.seed;
            partial.params = importSeed
                ? { ...importedState.params }
                : paramsWithoutSeed as MetadataState['params'];
            partial.advanced = { ...importedState.advanced };
            partial.useCoords = importedState.useCoords;
            partial.useOrder = importedState.useOrder;
        }

        // seed만 import (settings 없이)
        if (importSeed && !importSettings) {
            partial.params = { seed: importedState.params.seed } as MetadataState['params'];
        }

        // Always import the source model hash.
        if (importedState.source) {
            partial.source = importedState.source;
        }

        onConfirm(partial);
    };

    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const modalStyle: React.CSSProperties = {
        backgroundColor: theme.mantle,
        border: `1px solid ${theme.surface0}`,
        borderRadius: '12px',
        padding: '24px',
        width: '320px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: theme.text,
        fontFamily: theme.fontFamily,
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        fontSize: '14px',
        cursor: 'pointer',
    };

    return (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div style={modalStyle}>
                <h2 style={{ fontSize: '18px', margin: '0 0 8px 0', color: theme.text }}>선택 항목 가져오기</h2>
                <p style={{ fontSize: '12px', color: theme.subtext0, margin: '0 0 16px 0' }}>
                    이미지에서 가져올 항목을 선택하세요.<br />(선택한 항목만 기존 값을 덮어씁니다.)
                </p>

                <label style={rowStyle}>
                    <input style={{ marginTop: '4px' }} type="checkbox" checked={importBasePrompt} onChange={e => setImportBasePrompt(e.target.checked)} />
                    메인 프롬프트 (Base Prompt)
                </label>

                {importedState.prompt.characters.length > 0 && (
                    <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                        {importedState.prompt.characters.map((c, idx) => (
                            <label key={c.id} style={{ ...rowStyle, fontSize: '12px', color: theme.subtext1 }}>
                                <input
                                    style={{ marginTop: '2px' }}
                                    type="checkbox"
                                    checked={selectedChars.includes(c.id)}
                                    onChange={e => {
                                        if (e.target.checked) setSelectedChars([...selectedChars, c.id]);
                                        else setSelectedChars(selectedChars.filter(id => id !== c.id));
                                    }}
                                />
                                캐릭터 {idx + 1}: {c.caption.substring(0, 30)}{c.caption.length > 30 && '...'}
                            </label>
                        ))}
                    </div>
                )}

                <label style={rowStyle}>
                    <input style={{ marginTop: '4px' }} type="checkbox" checked={importNegative} onChange={e => setImportNegative(e.target.checked)} />
                    부정 프롬프트 (Negative Prompt)
                </label>

                {importedState.prompt.negativeCharacters.length > 0 && (
                    <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                        {importedState.prompt.negativeCharacters.map((c, idx) => (
                            <label key={c.id} style={{ ...rowStyle, fontSize: '12px', color: theme.subtext1 }}>
                                <input
                                    style={{ marginTop: '2px' }}
                                    type="checkbox"
                                    checked={selectedNegChars.includes(c.id)}
                                    onChange={e => {
                                        if (e.target.checked) setSelectedNegChars([...selectedNegChars, c.id]);
                                        else setSelectedNegChars(selectedNegChars.filter(id => id !== c.id));
                                    }}
                                />
                                부정 캐릭터 {idx + 1}: {c.caption.substring(0, 30)}{c.caption.length > 30 && '...'}
                            </label>
                        ))}
                    </div>
                )}

                <label style={rowStyle}>
                    <input style={{ marginTop: '4px' }} type="checkbox" checked={importSeed} onChange={e => setImportSeed(e.target.checked)} />
                    시드 (Seed)
                </label>
                <label style={rowStyle}>
                    <input style={{ marginTop: '4px' }} type="checkbox" checked={importSettings} onChange={e => setImportSettings(e.target.checked)} />
                    나머지 세부 설정 전체
                </label>

                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button onClick={onCancel} style={{ ...smallBtnStyle, flex: 1, backgroundColor: theme.surface0, color: theme.text, border: `1px solid ${theme.surface1}` }}>
                        취소
                    </button>
                    <button onClick={handleApply} style={{ ...smallBtnStyle, flex: 1, backgroundColor: theme.green, color: theme.crust, fontWeight: 'bold' }}>
                        가져오기
                    </button>
                </div>
            </div>
        </div>
    );
}
