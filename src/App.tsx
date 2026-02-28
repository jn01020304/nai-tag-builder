import { useState, useRef, useEffect } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import { buildCommentJson } from './model/buildCommentJson';
import { generatePngWithMetadata } from './encoding/pngEncoder';
import { dispatchPasteEvent } from './encoding/pasteDispatch';
import { theme, inputStyle, labelStyle } from './styles/theme';
import PromptSection from './components/PromptSection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import NegativePrompt from './components/NegativePrompt';
import AdvancedParams from './components/AdvancedParams';
import ApplyButton from './components/ApplyButton';

const CONTAINER_ID = 'nai-tag-builder-root';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function startDrag(clientX: number, clientY: number) {
  const el = document.getElementById(CONTAINER_ID) as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  el.style.right = '';
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';

  let lx = clientX, ly = clientY;

  const move = (cx: number, cy: number) => {
    el.style.left = (parseFloat(el.style.left) + cx - lx) + 'px';
    el.style.top = (parseFloat(el.style.top) + cy - ly) + 'px';
    lx = cx;
    ly = cy;
  };

  const onMM = (e: MouseEvent) => move(e.clientX, e.clientY);
  const onTM = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
  const up = () => {
    document.removeEventListener('mousemove', onMM);
    document.removeEventListener('mouseup', up);
    document.removeEventListener('touchmove', onTM);
    document.removeEventListener('touchend', up);
  };

  document.addEventListener('mousemove', onMM);
  document.addEventListener('mouseup', up);
  document.addEventListener('touchmove', onTM, { passive: false });
  document.addEventListener('touchend', up);
}

export default function App() {
  const [state, dispatch] = useMetadataState();
  const [isApplying, setIsApplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState<number | string>(30);
  const [minInterval, setMinInterval] = useState<number | string>(3);
  const [maxInterval, setMaxInterval] = useState<number | string>(1800);
  const [isLooping, setIsLooping] = useState(false);
  const loopRef = useRef<number | null>(null);

  const stopLoop = () => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    setIsLooping(false);
  };

  useEffect(() => () => { if (loopRef.current) clearInterval(loopRef.current); }, []);

  const handleClose = () => {
    stopLoop();
    document.getElementById(CONTAINER_ID)?.remove();
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const comment = buildCommentJson(state);
      const blob = await generatePngWithMetadata(comment);
      dispatchPasteEvent(blob, autoGenerate);
      setIsCollapsed(true);

      if (autoGenerate && Number(repeatInterval) > 0) {
        const sec = clamp(Number(repeatInterval), Number(minInterval), Number(maxInterval));
        setIsLooping(true);
        loopRef.current = window.setInterval(() => {
          const genBtn = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent?.includes('Generate')) as HTMLButtonElement | undefined;
          genBtn?.click();
        }, sec * 1000);
      }
    } catch (error) {
      console.error('Error applying preset:', error);
      alert('적용 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const headerBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    padding: '0 2px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '16px',
    lineHeight: 1,
  };

  const smallNumInput: React.CSSProperties = {
    ...inputStyle,
    width: '60px',
    textAlign: 'center',
  };

  return (
    <div style={{
      width: '320px',
      maxHeight: isCollapsed ? 'none' : '80vh',
      overflowY: isCollapsed ? 'visible' : 'auto',
      backgroundColor: theme.base,
      color: theme.text,
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      fontFamily: 'sans-serif',
      border: `1px solid ${theme.surface0}`,
      paddingBottom: isCollapsed ? '0' : '12px',
    }}>
      {/* Header — drag handle */}
      <div
        onMouseDown={(e) => {
          if ((e.target as Element).closest('button')) return;
          if (e.button === 0) startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if ((e.target as Element).closest('button')) return;
          startDrag(e.touches[0].clientX, e.touches[0].clientY);
        }}
        style={{
          backgroundColor: theme.crust,
          padding: '10px 16px',
          fontWeight: 'bold',
          fontSize: '14px',
          borderBottom: isCollapsed ? 'none' : `1px solid ${theme.surface0}`,
          marginBottom: isCollapsed ? '0' : '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          cursor: 'grab',
          borderRadius: isCollapsed ? '12px' : '12px 12px 0 0',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <span>NAI Tag Builder v2.0</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Stop button — visible only when looping */}
          {isLooping && (
            <button
              onClick={stopLoop}
              title="반복 중지"
              style={{ ...headerBtnStyle, color: theme.yellow }}
            >
              &#9632;
            </button>
          )}
          {/* Collapse button */}
          <button
            onClick={() => setIsCollapsed(c => !c)}
            title={isCollapsed ? '펼치기' : '접기'}
            style={{ ...headerBtnStyle, color: theme.subtext0 }}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
          {/* Close button */}
          <button
            onClick={handleClose}
            title="닫기"
            style={{ ...headerBtnStyle, color: theme.red }}
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div style={{ padding: '0 12px' }}>
          <PromptSection value={state.basePrompt} dispatch={dispatch} />
          <GenerationParams state={state} dispatch={dispatch} />
          <CharacterCaptions characters={state.characters} dispatch={dispatch} />
          <NegativePrompt state={state} dispatch={dispatch} />
          <AdvancedParams state={state} dispatch={dispatch} />

          {/* Auto-generate section */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.subtext0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
                style={{ accentColor: theme.blue }}
              />
              적용 후 자동 생성
            </label>

            {autoGenerate && (
              <div style={{ marginLeft: '20px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* Repeat interval */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: theme.text }}>
                  <label style={labelStyle}>반복 간격</label>
                  <input
                    type="number"
                    value={repeatInterval}
                    min={minInterval}
                    max={maxInterval}
                    onChange={(e) => setRepeatInterval(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={() => setRepeatInterval(clamp(Number(repeatInterval) || 0, Number(minInterval), Number(maxInterval)))}
                    style={smallNumInput}
                  />
                  <span style={{ fontSize: '12px', color: theme.subtext0 }}>초 ({minInterval}~{maxInterval})</span>
                </div>
                {/* Limits */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: theme.overlay0 }}>
                  <span>한도:</span>
                  <input
                    type="number"
                    value={minInterval}
                    min={1}
                    onChange={(e) => setMinInterval(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={() => setMinInterval(Math.max(1, Number(minInterval) || 1))}
                    style={{ ...smallNumInput, width: '48px', fontSize: '11px' }}
                  />
                  <span>~</span>
                  <input
                    type="number"
                    value={maxInterval}
                    min={minInterval}
                    onChange={(e) => setMaxInterval(e.target.value === '' ? '' : Number(e.target.value))}
                    onBlur={() => setMaxInterval(Math.max(Number(minInterval) || 1, Number(maxInterval) || 1))}
                    style={{ ...smallNumInput, width: '48px', fontSize: '11px' }}
                  />
                  <span>초</span>
                </div>
              </div>
            )}
          </div>

          <ApplyButton isApplying={isApplying} onApply={handleApply} />
        </div>
      )}
    </div>
  );
}
