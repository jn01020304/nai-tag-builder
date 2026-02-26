import { useState } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import { buildCommentJson } from './model/buildCommentJson';
import { generatePngWithMetadata } from './encoding/pngEncoder';
import { dispatchPasteEvent } from './encoding/pasteDispatch';
import { theme } from './styles/theme';
import PromptSection from './components/PromptSection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import NegativePrompt from './components/NegativePrompt';
import AdvancedParams from './components/AdvancedParams';
import ApplyButton from './components/ApplyButton';

const CONTAINER_ID = 'nai-tag-builder-root';

function closeOverlay() {
  document.getElementById(CONTAINER_ID)?.remove();
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

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const comment = buildCommentJson(state);
      const blob = await generatePngWithMetadata(comment);
      dispatchPasteEvent(blob);
      console.log('✅ 메타데이터 주입 완료 및 Paste 이벤트 발생!');
      closeOverlay();
    } catch (error) {
      console.error('Error applying preset:', error);
      alert('적용 중 오류가 발생했습니다.');
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
            onClick={closeOverlay}
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
          <ApplyButton isApplying={isApplying} onApply={handleApply} />
        </div>
      )}
    </div>
  );
}
