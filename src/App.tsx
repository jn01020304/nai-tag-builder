import { useRef, useState } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import type { MetadataState } from './types/metadata';
import { runApplyPipeline } from './automation/applyPipeline';
import type { ApplyPipelinePhase } from './automation/applyPipeline';
import { formatApplyErrorDetail } from './automation/applyStatusText';
import { useAutoGenerator } from './hooks/useAutoGenerator';
import { useEdgeResize } from './hooks/useEdgeResize';
import type { ResizeHandle } from './hooks/useEdgeResize';
import type { QueueMode } from './types/preset';
import { ThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/themeContextCore';
import PromptSection from './components/PromptSection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import AdvancedParams from './components/AdvancedParams';
import PresetManager from './components/PresetManager';
import QueuePanel from './components/QueuePanel';
import ImportModal from './components/ImportModal';
import StatusBanner from './components/StatusBanner';
import OverlayFooter from './components/OverlayFooter';
import OverlayHeader from './components/OverlayHeader';
import { parseNovelAIImageFiles } from './utils/pngParser';
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
  const { overlayWidth, overlayHeight, startResize } = useEdgeResize(320, CONTAINER_ID);

  // Preset queue state
  const [queue, setQueue] = useState<string[]>([]);
  const queueMode: QueueMode = 'progression';

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
      const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'));
      if (files.length === 0) {
        showFeedback({ tone: 'warning', message: '이미지 파일만 가져올 수 있습니다.' });
        return;
      }

      try {
        const result = await parseNovelAIImageFiles(files);
        if (result.mergedState) {
          setPendingImport(result.mergedState);
          showFeedback({
            tone: 'success',
            message: `${result.patches.length}개 이미지에서 NovelAI 메타데이터를 찾았습니다.`,
            detail: result.failedFiles.length > 0 ? `실패: ${result.failedFiles.join(', ')}` : undefined,
          });
        } else {
          showFeedback({ tone: 'warning', message: '가져온 이미지에서 NovelAI 메타데이터를 찾지 못했습니다.' });
        }
      } catch (err) {
        console.error('Error parsing image metadata:', err);
        showFeedback({ tone: 'error', message: '이미지 메타데이터를 읽지 못했습니다.' });
      }
    }
  };

  // Auto-generation logic
  const {
    autoGenerate, setAutoGenerate,
    seedRule, setSeedRule,
    intervalSec, targetCount, targetMin, adjustStep, setAdjustStep,
    isLooping, loopCount, queueSession,
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

  const getPairedNegativeCharacterTarget = (characterId: string): PromptInsertTarget | null => {
    const index = state.prompt.characters.findIndex((character) => character.id === characterId);
    const negativeCharacter = index >= 0 ? state.prompt.negativeCharacters[index] : undefined;
    return negativeCharacter ? { kind: 'negativeCharacter', id: negativeCharacter.id } : null;
  };

  const resolveCatalogTarget = (entry: CoreCatalogEntry): PromptInsertTarget => {
    if (entry.target === 'negative' && activePromptTarget.kind === 'base') {
      return { kind: 'negativeBase' };
    }

    if (entry.target === 'negative' && activePromptTarget.kind === 'character') {
      return getPairedNegativeCharacterTarget(activePromptTarget.id) ?? activePromptTarget;
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

  const renderResizeHandle = (handle: ResizeHandle) => {
    if (isCollapsed) return null;
    const pullsLeft = handle.includes('left');
    const pullsRight = handle.includes('right');
    const pullsTop = handle.includes('top');
    const pullsBottom = handle.includes('bottom');
    const isCorner = handle.includes('-');
    const isHorizontalEdge = handle === 'left' || handle === 'right';
    const cursor = (() => {
      if (handle === 'top-left' || handle === 'bottom-right') return 'nwse-resize';
      if (handle === 'top-right' || handle === 'bottom-left') return 'nesw-resize';
      if (isHorizontalEdge) return 'ew-resize';
      return 'ns-resize';
    })();

    return (
      <div
        data-testid={`overlay-resize-${handle}`}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startResize(handle, e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
          startResize(handle, e.touches[0].clientX, e.touches[0].clientY);
        }}
        style={{
          position: 'absolute',
          top: pullsBottom ? undefined : 0,
          right: pullsLeft ? undefined : 0,
          bottom: pullsTop ? undefined : 0,
          left: pullsRight ? undefined : 0,
          width: isCorner ? '16px' : isHorizontalEdge ? '12px' : '100%',
          height: isCorner ? '16px' : isHorizontalEdge ? '100%' : '12px',
          cursor,
          zIndex: isCorner ? 12 : isHorizontalEdge ? 10 : 11,
          touchAction: 'none',
          borderLeft: pullsLeft ? `3px solid ${theme.surface1}` : undefined,
          borderRight: pullsRight ? `3px solid ${theme.surface1}` : undefined,
          borderTop: pullsTop ? `3px solid ${theme.surface1}` : undefined,
          borderBottom: pullsBottom ? `3px solid ${theme.surface1}` : undefined,
          opacity: 0.75,
        }}
      />
    );
  };

  const renderCollapsedLauncher = () => {
    const normalizedTargetCount = Number(targetCount);
    const remainingCount = Number.isFinite(normalizedTargetCount)
      ? Math.max(0, Math.ceil(normalizedTargetCount) - loopCount)
      : null;
    const remainingText = remainingCount == null ? String(targetCount) : String(remainingCount);
    const shouldShowRemainingCount = isLooping && remainingText.length > 0;
    const remainingFontSize = remainingText.length >= 4 ? '15px' : remainingText.length >= 3 ? '18px' : '22px';

    return (
      <button
        type="button"
        data-testid="overlay-collapsed-launcher"
        title={shouldShowRemainingCount ? `자동화 남은 이미지 ${remainingText}장` : 'NAI Tag Builder 펼치기'}
        aria-label={shouldShowRemainingCount ? `자동화 남은 이미지 ${remainingText}장` : 'NAI Tag Builder 펼치기'}
        onClick={() => setIsCollapsed(false)}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        style={{
          alignItems: 'center',
          backgroundColor: theme.crust,
          border: shouldShowRemainingCount
            ? `2px solid ${theme.actionAccent}`
            : `1px solid ${theme.surface1}`,
          borderRadius: '999px',
          boxShadow: shouldShowRemainingCount
            ? `0 8px 22px rgba(0,0,0,0.35), 0 0 0 3px ${theme.surface0}`
            : '0 8px 22px rgba(0,0,0,0.35)',
          color: shouldShowRemainingCount ? theme.actionAccent : theme.text,
          cursor: 'grab',
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          fontFamily: theme.fontFamily,
          fontSize: '11px',
          fontWeight: 900,
          height: '100%',
          justifyContent: 'center',
          letterSpacing: 0,
          lineHeight: 1,
          padding: 0,
          textShadow: shouldShowRemainingCount ? `0 1px 0 ${theme.base}` : undefined,
          touchAction: 'none',
          userSelect: 'none',
          width: '100%',
          WebkitUserSelect: 'none',
        }}
      >
        {shouldShowRemainingCount ? (
          <span
            data-testid="overlay-collapsed-remaining-count"
            style={{
              color: theme.actionAccent,
              fontSize: remainingFontSize,
              lineHeight: 1,
              maxWidth: '46px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {remainingText}
          </span>
        ) : (
          <>
            <span
              aria-hidden="true"
              style={{
                color: theme.actionAccent,
                fontSize: '17px',
                lineHeight: 1,
                marginBottom: '3px',
              }}
            >
              N
            </span>
            <span style={{ fontSize: '9px', lineHeight: 1 }}>AI</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: isCollapsed ? '56px' : `${overlayWidth}px`,
        height: isCollapsed ? '56px' : overlayHeight == null ? undefined : `${overlayHeight}px`,
        minWidth: isCollapsed ? '56px' : '280px',
        maxWidth: isCollapsed ? '56px' : 'calc(100vw - 16px)',
        maxHeight: isCollapsed ? 'none' : overlayHeight == null ? '80vh' : 'calc(100vh - 16px)',
        overflow: 'hidden',
        backgroundColor: theme.base,
        color: theme.text,
        borderRadius: isCollapsed ? '999px' : '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        boxSizing: 'border-box',
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
          <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Drop Image Here</h2>
          <p style={{ fontSize: '12px', color: theme.subtext0 }}>Extract NovelAI metadata into Tag Builder</p>
        </div>
      )}

      {/* Right Edge Resize Handle */}
      {renderResizeHandle('left')}
      {renderResizeHandle('right')}
      {renderResizeHandle('top')}
      {renderResizeHandle('bottom')}
      {renderResizeHandle('top-left')}
      {renderResizeHandle('top-right')}
      {renderResizeHandle('bottom-left')}
      {renderResizeHandle('bottom-right')}

      {isCollapsed ? (
        renderCollapsedLauncher()
      ) : (
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
      )}

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
            getSelectionAfterRender={(target) => selectionAfterRenderByTarget[promptTargetKey(target)]}
            onPromptSelection={recordPromptSelection}
            onToggleCatalogEntry={handleCatalogToggle}
          />
          <CharacterCaptions
            characters={state.prompt.characters}
            negativeCharacters={state.prompt.negativeCharacters}
            activePromptTarget={activePromptTarget}
            dispatch={dispatch}
            getSelectionAfterRender={(target) => selectionAfterRenderByTarget[promptTargetKey(target)]}
            onPromptSelection={recordPromptSelection}
          />
          <GenerationParams state={state} dispatch={dispatch} />
          <AdvancedParams state={state} dispatch={dispatch} />

          <QueuePanel
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
            queueSession={queueSession}
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
