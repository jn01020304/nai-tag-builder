import { useLayoutEffect, useRef, useState } from 'react';
import { useMetadataState } from './hooks/useMetadataState';
import type { MetadataState } from './types/metadata';
import { runApplyPipeline } from './automation/applyPipeline';
import type { ApplyPipelinePhase } from './automation/applyPipeline';
import { formatApplyErrorDetail } from './automation/applyStatusText';
import { useQueueDraftControls } from './hooks/useQueueDraftControls';
import { useEdgeResize } from './hooks/useEdgeResize';
import type { ResizeHandle } from './hooks/useEdgeResize';
import type { QueueMode } from './types/preset';
import { ThemeProvider } from './contexts/ThemeContext';
import { useTheme } from './contexts/themeContextCore';
import MainPromptSection from './components/MainPromptSection';
import TagDictionarySection from './components/TagDictionarySection';
import GenerationParams from './components/GenerationParams';
import CharacterCaptions from './components/CharacterCaptions';
import AdvancedParams from './components/AdvancedParams';
import PresetManager from './components/PresetManager';
import QueueWorkspace from './components/QueueWorkspace';
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
import { movePromptTag, toggleCatalogTagWithSelection } from './prompt/catalog/promptTagText';

export type AppMode = 'compose' | 'queue';

const CONTAINER_ID = 'nai-tag-builder-root';
const VIEWPORT_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTouchPoint(touches: { length: number; [index: number]: { clientX: number; clientY: number } }): {
  clientX: number;
  clientY: number;
} {
  const touchCount = Math.max(1, touches.length);
  let clientX = 0;
  let clientY = 0;

  for (let index = 0; index < touchCount; index += 1) {
    clientX += touches[index].clientX;
    clientY += touches[index].clientY;
  }

  return {
    clientX: clientX / touchCount,
    clientY: clientY / touchCount,
  };
}

function clampOverlayPosition(el: HTMLElement, left: number, top: number): { left: number; top: number } {
  const rect = el.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const minLeft = viewportLeft + VIEWPORT_MARGIN;
  const minTop = viewportTop + VIEWPORT_MARGIN;
  const maxLeft = Math.max(minLeft, viewportLeft + viewportWidth - rect.width - VIEWPORT_MARGIN);
  const maxTop = Math.max(minTop, viewportTop + viewportHeight - rect.height - VIEWPORT_MARGIN);

  return {
    left: clamp(left, minLeft, maxLeft),
    top: clamp(top, minTop, maxTop),
  };
}

function keepOverlayInViewport(rootId: string) {
  const root = document.getElementById(rootId) as HTMLElement | null;
  const overlay = root?.firstElementChild;
  if (!root || !(overlay instanceof HTMLElement)) return;

  const rect = overlay.getBoundingClientRect();
  const nextPosition = clampOverlayPosition(overlay, rect.left, rect.top);
  root.style.right = '';
  root.style.bottom = '';
  root.style.left = `${nextPosition.left}px`;
  root.style.top = `${nextPosition.top}px`;
}

function startDrag(clientX: number, clientY: number, onActualDrag?: () => void) {
  const el = document.getElementById(CONTAINER_ID) as HTMLElement | null;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const initialPosition = clampOverlayPosition(el, rect.left, rect.top);
  el.style.right = '';
  el.style.left = initialPosition.left + 'px';
  el.style.top = initialPosition.top + 'px';

  let lx = clientX, ly = clientY;
  let hasDragged = false;

  const move = (cx: number, cy: number) => {
    if (!hasDragged && Math.hypot(cx - clientX, cy - clientY) > 5) {
      hasDragged = true;
      if (onActualDrag) onActualDrag();
    }
    const nextPosition = clampOverlayPosition(
      el,
      parseFloat(el.style.left) + cx - lx,
      parseFloat(el.style.top) + cy - ly,
    );
    el.style.left = nextPosition.left + 'px';
    el.style.top = nextPosition.top + 'px';
    lx = cx;
    ly = cy;
  };

  const onMM = (e: MouseEvent) => move(e.clientX, e.clientY);
  const onTM = (e: TouchEvent) => {
    e.preventDefault();
    const point = getTouchPoint(e.touches);
    move(point.clientX, point.clientY);
  };
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
  const [appMode, setAppMode] = useState<AppMode>('compose');
  const { overlayWidth, overlayHeight, startResize } = useEdgeResize(320, CONTAINER_ID);
  const isLauncherDragged = useRef(false);
  const [viewportHeight, setViewportHeight] = useState(() => window.visualViewport?.height ?? window.innerHeight);

  // Preset queue state
  const [queue, setQueue] = useState<string[]>([]);
  const [queueMode, setQueueMode] = useState<QueueMode>('batched');

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

  useLayoutEffect(() => {
    keepOverlayInViewport(CONTAINER_ID);
  }, [isCollapsed, overlayWidth, overlayHeight, viewportHeight]);

  useLayoutEffect(() => {
    const handleViewportChange = () => {
      setViewportHeight(window.visualViewport?.height ?? window.innerHeight);
      keepOverlayInViewport(CONTAINER_ID);
    };
    window.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

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

  const handleTwoFingerDragStart = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return;
    if ((e.target as Element).closest("[data-overlay-resize-handle='true']")) return;

    e.preventDefault();
    e.stopPropagation();
    const point = getTouchPoint(e.touches);
    startDrag(point.clientX, point.clientY);
  };

  // Auto-generation logic
  const {
    queueEnabled,
    setQueueEnabled,
    seedRule,
    setSeedRule,
    runsPerPreset,
    setRunsPerPreset,
    intervalSec,
    targetCount,
    targetMin,
    adjustStep,
    setAdjustStep,
    isLooping,
    loopCount,
    queueSession,
    startLoop,
    stopLoop,
    handleIntervalChange,
    handleCountChange,
    handleMinChange,
    adjustValue,
  } = useQueueDraftControls({ state, queue, queueMode, onFeedback: showFeedback });

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

  const handleInsertDictionaryTag = (tag: string, dictTarget: "prompt" | "negative") => {
    let target = activePromptTarget;
    if (dictTarget === 'negative' && activePromptTarget.kind === 'base') {
      target = { kind: 'negativeBase' };
    } else if (dictTarget === 'negative' && activePromptTarget.kind === 'character') {
      target = getPairedNegativeCharacterTarget(activePromptTarget.id) ?? activePromptTarget;
    }

    const targetKey = promptTargetKey(target);
    const promptValue = getTargetPromptValue(target);
    const selection = promptSelections[targetKey] ?? { start: promptValue.length, end: promptValue.length };

    const fakeEntry = { tag } as CoreCatalogEntry;
    const result = toggleCatalogTagWithSelection(promptValue, fakeEntry, selection.start);

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

  const handleReorderBasePrompt = (fromIndex: number, toIndex: number) => {
    dispatch({
      type: "SET_PROMPT",
      field: "basePrompt",
      value: movePromptTag(state.prompt.basePrompt, fromIndex, toIndex),
    });
  };

  const handleRemoveCharacter = (id: string) => {
    if (activePromptTarget.kind === 'character' && activePromptTarget.id === id) {
      setActivePromptTarget({ kind: 'base' });
    }
    const index = state.prompt.characters.findIndex(c => c.id === id);
    if (index >= 0) {
      const negChar = state.prompt.negativeCharacters[index];
      if (activePromptTarget.kind === 'negativeCharacter' && activePromptTarget.id === (negChar?.id ?? id)) {
        setActivePromptTarget({ kind: 'base' });
      }
    }
    dispatch({ type: 'REMOVE_CHARACTER', id });
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
        autoGenerate: false,
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
    } catch (error) {
      console.error('Error applying preset:', error);
      showFeedback({ tone: 'error', message: '적용 중 오류가 발생했습니다.' });
    } finally {
      applyInFlightRef.current = false;
      setCurrentApplyPhase(null);
      setIsApplying(false);
    }
  };

  const handleStartQueue = () => {
    if (!queueEnabled) {
      showFeedback({
        tone: "warning",
        message: "Auto-Queue가 꺼져 있습니다.",
        detail: "Queue 모드에서 자동화를 켜고 다시 시작하세요.",
      });
      setAppMode("queue");
      return;
    }
  
    startLoop();
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
        data-overlay-resize-handle="true"
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
        title={shouldShowRemainingCount ? `자동화 남은 이미지 ${remainingText}장` : 'Easy-to Studio 펼치기'}
        aria-label={shouldShowRemainingCount ? `자동화 남은 이미지 ${remainingText}장` : 'Easy-to Studio 펼치기'}
        onClick={(e) => {
          if (isLauncherDragged.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          setIsCollapsed(false);
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          isLauncherDragged.current = false;
          startDrag(e.clientX, e.clientY, () => {
            isLauncherDragged.current = true;
          });
        }}
        onTouchStart={(e) => {
          isLauncherDragged.current = false;
          startDrag(e.touches[0].clientX, e.touches[0].clientY, () => {
            isLauncherDragged.current = true;
          });
        }}
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
      onTouchStartCapture={handleTwoFingerDragStart}
      style={{
        width: isCollapsed ? '56px' : `${overlayWidth}px`,
        height: isCollapsed ? '56px' : overlayHeight == null ? undefined : `${overlayHeight}px`,
        minWidth: isCollapsed ? '56px' : '280px',
        maxWidth: isCollapsed ? '56px' : 'calc(100vw - 16px)',
        maxHeight: isCollapsed ? 'none' : overlayHeight == null ? `${Math.floor(viewportHeight * 0.8)}px` : `${Math.max(200, viewportHeight - 16)}px`,
        overflow: 'hidden',
        backgroundColor: theme.base,
        color: theme.text,
        borderRadius: isCollapsed ? '999px' : '16px', // Slightly larger border-radius
        boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.4)', // Deeper shadow for premium feel
        boxSizing: 'border-box',
        fontFamily: 'sans-serif',
        border: 'none', // Remove solid border, let shadow do the work
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
        <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
          <OverlayHeader
            isCollapsed={isCollapsed}
            onClose={handleClose}
            onToggleCollapsed={() => setIsCollapsed(c => !c)}
            onStartDrag={startDrag}
          />
          <div
            data-testid="mode-tabs"
            style={{
              display: 'flex',
              borderBottom: `1px solid ${theme.surface1}`,
              backgroundColor: theme.mantle,
            }}
          >
            <button
              type="button"
              data-testid="mode-tab-compose"
              aria-pressed={appMode === "compose"}
              onClick={() => setAppMode('compose')}
              style={{
                flex: 1,
                padding: '10px 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: appMode === 'compose' ? `2px solid ${theme.actionAccent}` : '2px solid transparent',
                color: appMode === 'compose' ? theme.actionAccent : theme.subtext0,
                fontWeight: appMode === 'compose' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Compose
            </button>
            <button
              type="button"
              data-testid="mode-tab-queue"
              aria-pressed={appMode === "queue"}
              onClick={() => setAppMode('queue')}
              style={{
                flex: 1,
                padding: '10px 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: appMode === 'queue' ? `2px solid ${theme.actionAccent}` : '2px solid transparent',
                color: appMode === 'queue' ? theme.actionAccent : theme.subtext0,
                fontWeight: appMode === 'queue' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Presets & Queue
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div
        data-testid="overlay-body"
        style={{
          display: isCollapsed ? 'none' : 'block',
          flex: '1 1 auto',
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          padding: '16px 16px 0',
        }}
      >

          {feedback && (
            <StatusBanner
              feedback={feedback}
              onDismiss={() => setFeedback(null)}
            />
          )}

          <PresetManager
            state={state}
            dispatch={dispatch}
            queue={queue}
            setQueue={setQueue}
            onImportRequest={setPendingImport}
            onFeedback={showFeedback}
          />

          {appMode === 'compose' ? (
            <>

              <MainPromptSection
                prompt={state.prompt}
                dispatch={dispatch}
                activePromptTarget={activePromptTarget}
                getSelectionAfterRender={(target) => selectionAfterRenderByTarget[promptTargetKey(target)]}
                onPromptSelection={recordPromptSelection}
              />
              <CharacterCaptions
                characters={state.prompt.characters}
                negativeCharacters={state.prompt.negativeCharacters}
                activePromptTarget={activePromptTarget}
                dispatch={dispatch}
                getSelectionAfterRender={(target) => selectionAfterRenderByTarget[promptTargetKey(target)]}
                onPromptSelection={recordPromptSelection}
                onRemoveCharacter={handleRemoveCharacter}
              />
              <TagDictionarySection
                prompt={state.prompt}
                activePromptTarget={activePromptTarget}
                onToggleCatalogEntry={handleCatalogToggle}
                onReorderBasePrompt={handleReorderBasePrompt}
                onInsertDictionaryTag={handleInsertDictionaryTag}
              />
              <GenerationParams state={state} dispatch={dispatch} />
              <AdvancedParams state={state} dispatch={dispatch} />
            </>
          ) : (
            <>
              <QueueWorkspace
                queueEnabled={queueEnabled}
                setQueueEnabled={setQueueEnabled}
                seedRule={seedRule}
                setSeedRule={setSeedRule}
                queueMode={queueMode}
                setQueueMode={setQueueMode}
                runsPerPreset={runsPerPreset}
                setRunsPerPreset={setRunsPerPreset}
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
            </>
          )}
      </div>

      {!isCollapsed && (
        <OverlayFooter
          appMode={appMode}
          queueEnabled={queueEnabled}
          feedback={feedback}
          isApplying={isApplying}
          applyPhase={currentApplyPhase}
          isLooping={isLooping}
          loopCount={loopCount}
          targetCount={targetCount}
          onApply={handleApply}
          onStartLoop={handleStartQueue}
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
