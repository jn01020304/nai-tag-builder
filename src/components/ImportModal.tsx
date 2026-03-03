import { useState } from 'react';
import type { MetadataState } from '../types/metadata';
import { theme, smallBtnStyle } from '../styles/theme';

interface Props {
    importedState: MetadataState;
    onConfirm: (partial: Partial<MetadataState>) => void;
    onCancel: () => void;
}

export default function ImportModal({ importedState, onConfirm, onCancel }: Props) {
    const [importPrompt, setImportPrompt] = useState(true);
    const [importNegative, setImportNegative] = useState(true);
    const [importSeed, setImportSeed] = useState(true);
    const [importSettings, setImportSettings] = useState(true);

    const handleApply = () => {
        const partial: Partial<MetadataState> = {};

        if (importPrompt) {
            partial.basePrompt = importedState.basePrompt;
            partial.characters = importedState.characters;
        }

        if (importNegative) {
            partial.negativeBase = importedState.negativeBase;
            partial.negativeCharacters = importedState.negativeCharacters;
        }

        if (importSeed) {
            partial.seed = importedState.seed;
        }

        if (importSettings) {
            partial.steps = importedState.steps;
            partial.sampler = importedState.sampler;
            partial.scale = importedState.scale;
            partial.width = importedState.width;
            partial.height = importedState.height;
            partial.smea = importedState.smea;
            partial.smeaDyn = importedState.smeaDyn;
            partial.noiseSchedule = importedState.noiseSchedule;
            partial.nSamples = importedState.nSamples;
            partial.cfgRescale = importedState.cfgRescale;
            partial.uncondScale = importedState.uncondScale;
            partial.dynamicThresholding = importedState.dynamicThresholding;
            partial.skipCfgAboveSigma = importedState.skipCfgAboveSigma;
            partial.skipCfgBelowSigma = importedState.skipCfgBelowSigma;
            partial.preferBrownian = importedState.preferBrownian;
            partial.cfgSchedEligibility = importedState.cfgSchedEligibility;
            partial.uncondPerVibe = importedState.uncondPerVibe;
            partial.wonkyVibeCorrelation = importedState.wonkyVibeCorrelation;
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
        boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        color: theme.text,
        fontFamily: theme.fontFamily,
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
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
                    <input type="checkbox" checked={importPrompt} onChange={e => setImportPrompt(e.target.checked)} />
                    프롬프트 (Prompt)
                </label>
                <label style={rowStyle}>
                    <input type="checkbox" checked={importNegative} onChange={e => setImportNegative(e.target.checked)} />
                    부정 프롬프트 (Negative Prompt)
                </label>
                <label style={rowStyle}>
                    <input type="checkbox" checked={importSeed} onChange={e => setImportSeed(e.target.checked)} />
                    시드 (Seed)
                </label>
                <label style={rowStyle}>
                    <input type="checkbox" checked={importSettings} onChange={e => setImportSettings(e.target.checked)} />
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
