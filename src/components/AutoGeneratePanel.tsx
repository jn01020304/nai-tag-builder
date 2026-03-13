import React from 'react';
import { theme, inputStyle, labelStyle } from '../styles/theme';
import type { SeedRule } from '../types/preset';

interface AutoGeneratePanelProps {
    autoGenerate: boolean;
    setAutoGenerate: (val: boolean) => void;
    seedRule: SeedRule;
    setSeedRule: (val: SeedRule) => void;
    adjustStep: number | string;
    setAdjustStep: (val: number | string) => void;
    intervalSec: number | string;
    handleIntervalChange: (val: string) => void;
    targetCount: number | string;
    handleCountChange: (val: string) => void;
    targetMin: number | string;
    handleMinChange: (val: string) => void;
    adjustValue: (type: 'interval' | 'count', dir: 1 | -1) => void;
    queueLength: number;
}

export default function AutoGeneratePanel({
    autoGenerate, setAutoGenerate,
    seedRule, setSeedRule,
    adjustStep, setAdjustStep,
    intervalSec, handleIntervalChange,
    targetCount, handleCountChange,
    targetMin, handleMinChange,
    adjustValue,
    queueLength,
}: AutoGeneratePanelProps) {
    const smallNumInput: React.CSSProperties = {
        ...inputStyle,
        width: '60px',
        textAlign: 'center',
        padding: '4px',
    };

    const miniBtn: React.CSSProperties = {
        background: theme.surface1, color: theme.text, border: 'none', borderRadius: '4px',
        width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
    };

    return (
        <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.subtext0, cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={autoGenerate}
                    onChange={(e) => setAutoGenerate(e.target.checked)}
                    style={{ accentColor: theme.blue }} // check box color (use blue / lowInt)
                />
                적용 후 자동 생성
            </label>

            {autoGenerate && (
                <div style={{ marginLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                    {/* Seed Rule Selection (only relevant when queue is empty) */}
                    {queueLength === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                            <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>시드 규칙</label>
                            <select
                                value={seedRule}
                                onChange={(e) => setSeedRule(e.target.value as SeedRule)}
                                style={{ ...inputStyle, padding: '2px 4px', fontSize: '11px' }}
                            >
                                <option value="none">일반 (버튼만 클릭)</option>
                                <option value="random">랜덤 (매번 다른 시드 주입)</option>
                                <option value="increment">1씩 증가 (+1)</option>
                                <option value="decrement">1씩 감소 (-1)</option>
                            </select>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                        <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>조절 단위</label>
                        <input
                            type="number"
                            value={adjustStep}
                            onChange={(e) => setAdjustStep(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                            style={{ ...smallNumInput, width: '40px' }}
                        />
                        <span style={{ fontSize: '11px', color: theme.overlay0 }}>(+/- 버튼 클릭 시 변동량)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                        <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>간격(초)</label>
                        <button onClick={() => adjustValue('interval', -1)} style={miniBtn}>-</button>
                        <input
                            type="number"
                            value={intervalSec}
                            onChange={(e) => handleIntervalChange(e.target.value)}
                            style={smallNumInput}
                        />
                        <button onClick={() => adjustValue('interval', 1)} style={miniBtn}>+</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                        <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>목표 횟수</label>
                        <button onClick={() => adjustValue('count', -1)} style={miniBtn}>-</button>
                        <input
                            type="number"
                            value={targetCount}
                            onChange={(e) => handleCountChange(e.target.value)}
                            style={smallNumInput}
                        />
                        <button onClick={() => adjustValue('count', 1)} style={miniBtn}>+</button>
                        <span style={{ fontSize: '12px', color: theme.subtext0, marginLeft: '4px' }}>회</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                        <label style={{ ...labelStyle, marginBottom: 0, width: '60px' }}>목표 시간</label>
                        <div style={{ width: '24px' }} /> {/* alignment spacer */}
                        <input
                            type="number"
                            step="0.1"
                            value={targetMin}
                            onChange={(e) => handleMinChange(e.target.value)}
                            style={smallNumInput}
                        />
                        <div style={{ width: '24px' }} /> {/* alignment spacer */}
                        <span style={{ fontSize: '12px', color: theme.subtext0, marginLeft: '4px' }}>분</span>
                    </div>

                    {queueLength === 0 && seedRule === 'none' && (
                        <div style={{ fontSize: '10px', color: theme.yellow, marginTop: '2px' }}>
                            * 규칙이 '건드리지 않음'입니다. 끊기지 않게 연속 생성하려면 NAI의 Seed를 0으로 맞추세요.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
