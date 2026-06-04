import { useRef, useState } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import type { MetadataState } from './types/metadata';
import { runApplyPipeline } from './automation/applyPipeline';
import type { ApplyPipelinePhase } from './automation/applyPipeline';
import { formatApplyErrorDetail } from './automation/applyStatusText';
import { useAutoGenerator } from './hooks/useAutoGenerator';
import { useEdgeResize } from './hooks/useEdgeResize';
import type { QueueMode } from './types/preset';
import { ThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/themeContextCore';
import PromptSection from './components/PromptSection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import NegativePrompt from './components/NegativePrompt';
import AdvancedParams from './components/AdvancedParams';
import PresetManager from './components/PresetManager';
import AutoGeneratePanel from './components/AutoGeneratePanel';
import ImportModal from './components/ImportModal';
import StatusBanner from './components/StatusBanner';
import OverlayFooter from './components/OverlayFooter';
import OverlayHeader from './components/OverlayHeader';
import { parseNovelAIPng } from './utils/pngParser';
import { translateNovelAiMetadata } from './utils/metadataTranslator';
import type { StatusFeedback } from './types/feedback';
import type {
  PromptInsertTarget,
  PromptSelection,
  PromptSelectionAfterRender,
} from './prompt/promptInsertTarget';
import { promptTargetKey } from './prompt/promptInsertTarget';
import type { CoreCatalogEntry } from './prompt/catalog/catalogTypes';
import { toggleCatalogTagWithSelection } from './prompt/catalog/promptTagText';

const CONTAINER_ID = 'nai-tag-builder-root';
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

function AppContent() {
  const theme = useTheme();
  const [state, dispatch] = useMetadataState();
  const [isApplying, setIsApplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { overlayWidth, startResize } = useEdgeResize(320);

  // Preset queue state
  const [queue, setQueue] = useState<string[]>([]);
  const [queueMode, setQueueMode] = useState<QueueMode>('progression');

  // Import Modal state
  const [pendingImport, setPendingImport] = useState<MetadataState | null>(null);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedback, setFeedback] = useState<StatusFeedback | null>(null);
  const [currentApplyPhase, setCurrentApplyPhase] = useState<ApplyPipelinePhase | null>(null);
  const applyInFlightRef = useRef(false);
  const [activePromptTarget, setActivePromptTarget] = useState<PromptInsertTarget>({ kind: 'base' });
  const [promptSelections, setPromptSelections] = useState<Record<string, PromptSelection>>({});
  const [selectionAfterRenderByTarget, setSelectionAfterRenderByTarget] = useState<
    Record<string, PromptSelectionAfterRender | undefined>
  >({});

  const showFeedback = (nextFeedback: StatusFeedback) => {
    setFeedback(nextFeedback);
    if (nextFeedback.tone === 'error' || nextFeedback.tone === 'warning') {
      setIsCollapsed(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setFeedback(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'image/png') {
        try {
          const buffer = await file.arrayBuffer();
          const jsonMeta = parseNovelAIPng(buffer);
          if (jsonMeta && jsonMeta.data) {
            const newState = translateNovelAiMetadata(jsonMeta.data, jsonMeta.source);
            setPendingImport(newState);
          } else {
            showFeedback({ tone: 'warning', message: 'NovelAI 메타데이터가 없는 PNG입니다.' });
          }
        } catch (err) {
          console.error('Error parsing PNG:', err);
          showFeedback({ tone: 'error', message: 'PNG 파일을 읽지 못했습니다.' });
        }
      } else {
        showFeedback({ tone: 'warning', message: 'NovelAI에서 생성한 PNG 파일만 가져올 수 있습니다.' });
      }
    }
  };

  // Auto-generation logic
  const {
    autoGenerate, setAutoGenerate,
    seedRule, setSeedRule,
    intervalSec, targetCount, targetMin, adjustStep, setAdjustStep,
    isLooping, loopCount,
    startLoop, stopLoop,
    handleIntervalChange, handleCountChange, handleMinChange, adjustValue,
  } = useAutoGenerator({ state, queue, queueMode, onFeedback: showFeedback });

  const handleClose = () => {
    stopLoop();
    document.getElementById(CONTAINER_ID)?.remove();
  };

  const recordPromptSelection = (target: PromptInsertTarget, selection: PromptSelection) => {
    const key = promptTargetKey(target);
    setActivePromptTarget(target);
    setPromptSelections((current) => ({
      ...current,
      [key]: selection,
    }));
  };

  const getTargetPromptValue = (target: PromptInsertTarget): string => {
    switch (target.kind) {
      case 'base':
        return state.prompt.basePrompt;
      case 'negativeBase':
        return state.prompt.negativeBase;
      case 'character':
        return state.prompt.characters.find((character) => character.id === target.id)?.caption ?? '';
      case 'negativeCharacter':
        return state.prompt.negativeCharacters.find((character) => character.id === target.id)?.caption ?? '';
    }
  };

  const dispatchPromptTargetValue = (target: PromptInsertTarget, value: string) => {
    switch (target.kind) {
      case 'base':
        dispatch({ type: 'SET_PROMPT', field: 'basePrompt', value });
        return;
      case 'negativeBase':
        dispatch({ type: 'SET_PROMPT', field: 'negativeBase', value });
        return;
      case 'character':
        dispatch({ type: 'UPDATE_CHARACTER', id: target.id, field: 'caption', value });
        return;
      case 'negativeCharacter':
        dispatch({ type: 'UPDATE_NEG_CHARACTER', id: target.id, field: 'caption', value });
        return;
    }
  };

  const resolveCatalogTarget = (entry: CoreCatalogEntry): PromptInsertTarget => {
    if (entry.target === 'negative' && activePromptTarget.kind === 'base') {
      return { kind: 'negativeBase' };
    }

    return activePromptTarget;
  };

  const handleCatalogToggle = (entry: CoreCatalogEntry) => {
    const target = resolveCatalogTarget(entry);
    const targetKey = promptTargetKey(target);
    const promptValue = getTargetPromptValue(target);
    const selection = promptSelections[targetKey] ?? { start: promptValue.length, end: promptValue.length };
    const result = toggleCatalogTagWithSelection(promptValue, entry, selection.start);

    dispatchPromptTargetValue(target, result.value);

    if (result.nextCursorIndex != null) {
      const nextSelection = {
        start: result.nextCursorIndex,
        end: result.nextCursorIndex,
        version: Date.now(),
      };
      setPromptSelections((current) => ({
        ...current,
        [targetKey]: nextSelection,
      }));
      setSelectionAfterRenderByTarget((current) => ({
        ...current,
        [targetKey]: nextSelection,
      }));
    }
  };



  const handleApply = async () => {
    if (applyInFlightRef.current) {
      showFeedback({ tone: 'warning', message: '이미 NovelAI 적용이 진행 중입니다.' });
      return;
    }

    applyInFlightRef.current = true;
    setCurrentApplyPhase('planning');
    setIsApplying(true);
    showFeedback({ tone: 'info', message: 'NovelAI 적용을 시작합니다.' });
    try {
      const result = await runApplyPipeline({
        state,
        autoGenerate,
        onPhase: (phase) => {
          setCurrentApplyPhase(phase.phase);
          showFeedback({ tone: 'info', message: phase.message, detail: phase.detail });
        },
      });
      if (result.effect.status === 'failed') {
        console.error('Apply effect failed:', result.effect);
        showFeedback({
          tone: 'error',
          message: result.effect.message,
          detail: formatApplyErrorDetail(result.effect.code, result.effect.detail),
        });
        return;
      }

      showFeedback({
        tone: 'success',
        message: result.effect.message,
        detail: result.plan.seed.seedWasRandomized
          ? `Seed 0이 실제 seed ${result.plan.seed.appliedSeed}로 기록되었습니다.`
          : undefined,
      });
      setIsCollapsed(false);

      if (autoGenerate && Number(intervalSec) > 0 && Number(targetCount) > 0) {
        startLoop();
      }
    } catch (error) {
      console.error('Error applying preset:', error);
      showFeedback({ tone: 'error', message: '적용 중 오류가 발생했습니다.' });
    } finally {
      applyInFlightRef.current = false;
      setCurrentApplyPhase(null);
      setIsApplying(false);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: `${overlayWidth}px`,
        minWidth: '280px',
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: isCollapsed ? 'none' : '80vh',
        overflow: 'hidden',
        backgroundColor: theme.base,
        color: theme.text,
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        fontFamily: 'sans-serif',
        border: `1px solid ${theme.surface0}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative', // Relative for absolute components like the handle
      }}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: theme.mantle,
          opacity: 0.9,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: `2px dashed ${theme.intensityHigh}`,
          color: theme.text,
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Drop PNG Image Here</h2>
          <p style={{ fontSize: '12px', color: theme.subtext0 }}>Extract NovelAI metadata into Tag Builder</p>
        </div>
      )}

      {/* Right Edge Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={(e) => { e.preventDefault(); startResize(e.clientX); }}
          onTouchStart={(e) => { e.preventDefault(); startResize(e.touches[0].clientX); }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '12px',
            height: '100%',
            cursor: 'ew-resize',
            zIndex: 10,
            touchAction: 'none',
            borderRight: `3px solid ${theme.surface1}`,
            opacity: 0.75,
          }}
        />
      )}

      <OverlayHeader
        isCollapsed={isCollapsed}
        isLooping={isLooping}
        loopCount={loopCount}
        targetCount={targetCount}
        onClose={handleClose}
        onStopLoop={stopLoop}
        onToggleCollapsed={() => setIsCollapsed(c => !c)}
        onStartDrag={startDrag}
      />

      {/* Body */}
      {!isCollapsed && (
        <div
          data-testid="overlay-body"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            padding: '12px 12px 0',
          }}
        >
          <PresetManager
            state={state}
            dispatch={dispatch}
            queue={queue}
            setQueue={setQueue}
            queueMode={queueMode}
            setQueueMode={setQueueMode}
            onImportRequest={setPendingImport}
            onFeedback={showFeedback}
          />
          {feedback && (
            <StatusBanner
              feedback={feedback}
              onDismiss={() => setFeedback(null)}
            />
          )}
          <PromptSection
            state={state}
            dispatch={dispatch}
            activePromptTarget={activePromptTarget}
            selectionAfterRender={selectionAfterRenderByTarget.base}
            onPromptSelection={recordPromptSelection}
            onToggleCatalogEntry={handleCatalogToggle}
          />
          <GenerationParams state={state} dispatch={dispatch} />
          <CharacterCaptions
            characters={state.prompt.characters}
            dispatch={dispatch}
            getSelectionAfterRender={(target) => selectionAfterRenderByTarget[promptTargetKey(target)]}
            onPromptSelection={recordPromptSelection}
          />
          <NegativePrompt
            state={state}
            dispatch={dispatch}
            getSelectionAfterRender={(target) => selectionAfterRenderByTarget[promptTargetKey(target)]}
            onPromptSelection={recordPromptSelection}
          />
          <AdvancedParams state={state} dispatch={dispatch} />

          <AutoGeneratePanel
            autoGenerate={autoGenerate}
            setAutoGenerate={setAutoGenerate}
            seedRule={seedRule}
            setSeedRule={setSeedRule}
            adjustStep={adjustStep}
            setAdjustStep={setAdjustStep}
            intervalSec={intervalSec}
            handleIntervalChange={handleIntervalChange}
            targetCount={targetCount}
            handleCountChange={handleCountChange}
            targetMin={targetMin}
            handleMinChange={handleMinChange}
            adjustValue={adjustValue}
            queueLength={queue.length}
          />
        </div>
      )}

      {!isCollapsed && (
        <OverlayFooter
          feedback={feedback}
          isApplying={isApplying}
          applyPhase={currentApplyPhase}
          isLooping={isLooping}
          loopCount={loopCount}
          targetCount={targetCount}
          onApply={handleApply}
          onStopLoop={stopLoop}
        />
      )}

      {pendingImport && (
        <ImportModal
          importedState={pendingImport}
          onConfirm={(partial) => {
            const merged: MetadataState = {
              ...state,
              ...partial,
              prompt: { ...state.prompt, ...partial.prompt },
              params: { ...state.params, ...partial.params },
              advanced: { ...state.advanced, ...partial.advanced },
            };
            dispatch({ type: 'LOAD_PRESET', state: merged });
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
