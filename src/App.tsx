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

export default function App() {
  const [state, dispatch] = useMetadataState();
  const [isApplying, setIsApplying] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const comment = buildCommentJson(state);
      const blob = await generatePngWithMetadata(comment);
      dispatchPasteEvent(blob);
      console.log('✅ 메타데이터 주입 완료 및 Paste 이벤트 발생!');
      setIsVisible(false);
    } catch (error) {
      console.error('Error applying preset:', error);
      alert('적용 중 오류가 발생했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div style={{
      width: '320px',
      maxHeight: '80vh',
      overflowY: 'auto',
      backgroundColor: theme.base,
      color: theme.text,
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
      fontFamily: 'sans-serif',
      border: `1px solid ${theme.surface0}`,
      paddingBottom: '12px',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: theme.crust,
        padding: '10px 16px',
        fontWeight: 'bold',
        fontSize: '14px',
        borderBottom: `1px solid ${theme.surface0}`,
        marginBottom: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}>
        <span>NAI Tag Builder v2.0</span>
        <button
          onClick={() => setIsVisible(false)}
          style={{ background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
        >
          &#10005;
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '0 12px' }}>
        <PromptSection value={state.basePrompt} dispatch={dispatch} />
        <GenerationParams state={state} dispatch={dispatch} />
        <CharacterCaptions characters={state.characters} dispatch={dispatch} />
        <NegativePrompt state={state} dispatch={dispatch} />
        <AdvancedParams state={state} dispatch={dispatch} />
        <ApplyButton isApplying={isApplying} onApply={handleApply} />
      </div>
    </div>
  );
}
